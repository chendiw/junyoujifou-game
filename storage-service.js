// Hybrid Storage Service - localStorage + Azure Backend
class StorageService {
  constructor() {
    this.azureBaseUrl = CONFIG.AZURE_BASE_URL;
    this.syncInterval = CONFIG.SYNC_INTERVAL;
    this.lastSyncTime = 0;
    this.pendingChanges = false;
    this.currentUser = null;
    
    // New: protect against overlapping syncs and track retries
    this.isSyncInProgress = false;
    this.maxRetryAttempts = 3;
    
    // Start sync timer (fallback)
    this.startSyncTimer();
  }

  // Initialize with Azure function URL
  setAzureBaseUrl(url) {
    this.azureBaseUrl = url;
  }

  // Start periodic sync timer
  startSyncTimer() {
    setInterval(() => {
      // Only attempt when there are pending changes and we are not already syncing
      if (this.pendingChanges && this.currentUser && !this.isSyncInProgress) {
        // Use the same retry-capable path as immediate sync
        this.syncToAzureWithRetry();
      }
    }, this.syncInterval);
  }

  // Local Storage Operations
  saveToLocal(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      return false;
    }
  }

  loadFromLocal(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      return null;
    }
  }

  // User Management
  async createUser(accountName) {
    try {
      // Check for duplicate account name in local storage first (case-insensitive)
      const users = this.loadFromLocal(CONFIG.STORAGE_KEYS.USERS) || {};
      const accountNameLower = accountName.toLowerCase();
      
      console.log('Checking for duplicates. Existing users:', Object.keys(users));
      console.log('Attempting to create account:', accountName);
      
      // Check for exact match first
      if (users[accountName]) {
        console.log('Exact match found for:', accountName);
        throw new Error('Account name already exists, please choose a different name');
      }
      
      // Check for case-insensitive match
      for (const existingName in users) {
        if (existingName.toLowerCase() === accountNameLower) {
          console.log('Case-insensitive match found:', existingName, 'vs', accountName);
          throw new Error('Account name already exists, please choose a different name');
        }
      }
      
      console.log('No duplicates found, proceeding with account creation');
      
      // Create user object
      const user = {
        id: Date.now().toString(),
        accountName: accountName,
        createdAt: new Date().toISOString()
      };
      
      // Create initial game state
      const gameState = {
        currentChapter: CONFIG.STARTING_CHAPTER,
        lifePoints: CONFIG.INITIAL_LIFE_POINTS,
        transportCards: CONFIG.INITIAL_TRANSPORT_CARDS,
        visitedNodes: [CONFIG.STARTING_CHAPTER],
        playerChoices: [],
        previousNode: null,
        gameOver: false,
        version: "1.0"
      };
      
      // Try to sync to Azure (this will also create the account on the server)
      try {
        const syncResult = await this.syncUserToAzure(user, gameState);
        if (syncResult === false) {
          console.warn('Azure sync failed, but creating user locally');
        }
      } catch (azureError) {
        // If Azure sync fails due to duplicate account, throw the error
        if (azureError.message && azureError.message.includes('already exists')) {
          throw azureError;
        }
        // For other Azure errors, continue with local creation
        console.warn('Azure sync failed, but creating user locally:', azureError.message);
      }

      // NEW: Fetch canonical userId from backend (login) to ensure we always use server-assigned ID
      try {
        const canonical = await this.fetchCanonicalUserFromAzure(accountName);
        if (canonical && canonical.userId) {
          const oldId = user.id;
          user.id = canonical.userId;
          // Optionally adopt server-side game state fields if present
          if (canonical.gameState) {
            const s = canonical.gameState;
            gameState.currentChapter = String(s.currentChapter ?? gameState.currentChapter);
            gameState.lifePoints = s.lifePoints ?? gameState.lifePoints;
            // Server uses backtrackPoints, client uses transportCards
            if (typeof s.backtrackPoints !== 'undefined') {
              gameState.transportCards = s.backtrackPoints;
            }
            gameState.visitedNodes = Array.isArray(s.visitedNodes) ? s.visitedNodes.map(String) : gameState.visitedNodes;
            gameState.playerChoices = Array.isArray(s.playerChoices) ? s.playerChoices : gameState.playerChoices;
            gameState.previousNode = (typeof s.previousNode === 'undefined' || s.previousNode === null) ? null : String(s.previousNode);
            gameState.gameOver = !!s.gameOver;
          }

          // Migrate any locally stored game state from oldId to new canonical id
          if (oldId && oldId !== user.id) {
            try {
              const oldKey = `${CONFIG.STORAGE_KEYS.GAME_STATE_PREFIX}${oldId}`;
              const oldState = this.loadFromLocal(oldKey);
              if (oldState) {
                // Save under the new key and remove the old one
                this.saveToLocal(`${CONFIG.STORAGE_KEYS.GAME_STATE_PREFIX}${user.id}`, oldState);
                localStorage.removeItem(oldKey);
              }
            } catch (migrateErr) {
              console.warn('Failed to migrate local game state to canonical id:', migrateErr);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to fetch canonical user id from backend, continuing with current id:', e?.message || e);
      }
      
      // Persist locally using the canonical (server) user id
      users[accountName] = user;
      this.saveToLocal(CONFIG.STORAGE_KEYS.USERS, users);
      this.saveToLocal(`${CONFIG.STORAGE_KEYS.GAME_STATE_PREFIX}${user.id}`, gameState);
      
      return { user, gameState };
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async loginUser(accountName) {
    try {
      // First try localStorage
      const users = this.loadFromLocal(CONFIG.STORAGE_KEYS.USERS) || {};
      const user = users[accountName];
      
      if (!user) {
        throw new Error('Account not found');
      }
      
      // Load game state from localStorage
      const gameState = this.loadFromLocal(`${CONFIG.STORAGE_KEYS.GAME_STATE_PREFIX}${user.id}`);
      
      if (!gameState) {
        // Try to load from Azure as fallback
        const azureGameState = await this.loadGameStateFromAzure(user.id);
        if (azureGameState) {
          this.saveToLocal(`${CONFIG.STORAGE_KEYS.GAME_STATE_PREFIX}${user.id}`, azureGameState);
          return { user, gameState: azureGameState };
        }
        throw new Error('Game state not found');
      }
      
      this.currentUser = user;
      this.pendingChanges = false;
      
      return { user, gameState };
    } catch (error) {
      console.error('Error logging in user:', error);
      throw error;
    }
  }

  // Game State Management
  saveGameState(userId, gameState) {
    // Save to localStorage immediately
    this.saveToLocal(`${CONFIG.STORAGE_KEYS.GAME_STATE_PREFIX}${userId}`, gameState);
    
    // Mark for Azure sync and capture user context for payload
    this.pendingChanges = true;
    this.currentUser = { 
      id: userId, 
      accountName: (gameState && gameState.user && gameState.user.accountName) ? gameState.user.accountName : (this.currentUser ? this.currentUser.accountName : undefined)
    };

    // Trigger an immediate, non-blocking sync attempt with retry
    // Do not await here to keep UI responsive
    this.syncToAzureWithRetry();
  }

  loadGameState(userId) {
    return this.loadFromLocal(`${CONFIG.STORAGE_KEYS.GAME_STATE_PREFIX}${userId}`);
  }

  // Azure Backend Operations
  async syncUserToAzure(user, gameState) {
    try {
      // Create user in Azure
      const userResponse = await fetch(`${this.azureBaseUrl}/create-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountName: user.accountName
        })
      });

      if (!userResponse.ok) {
        const errorData = await userResponse.json();
        if (userResponse.status === 409) {
          // Duplicate account error
          throw new Error('Account name already exists, please choose a different name');
        }
        console.warn('Failed to create user in Azure:', userResponse.status);
        return false;
      }

      // Adopt server-assigned userId so we don't create a second, mismatched blob
      const serverData = await userResponse.json();
      if (serverData && serverData.userId) {
        user.id = serverData.userId;
      }

      // Update game state in Azure (will overwrite the same blob, not create a new one)
      const gameStateResponse = await fetch(`${this.azureBaseUrl}/save-game`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          accountName: user.accountName,
          currentChapter: gameState.currentChapter,
          lifePoints: gameState.lifePoints,
          backtrackPoints: gameState.transportCards,
          visitedNodes: gameState.visitedNodes,
          playerChoices: gameState.playerChoices,
          previousNode: gameState.previousNode,
          gameOver: gameState.gameOver
        })
      });

      if (!gameStateResponse.ok) {
        console.warn('Failed to sync game state to Azure:', gameStateResponse.status);
        return false;
      }

      this.lastSyncTime = Date.now();
      this.pendingChanges = false;
      console.log('Successfully synced to Azure');
      return true;
    } catch (error) {
      console.error('Error syncing to Azure:', error);
      return false;
    }
  }

  // New: single attempt sync used by retry wrapper
  async syncToAzureOnce() {
    if (!this.currentUser) return false;

    const gameState = this.loadGameState(this.currentUser.id);
    if (!gameState) return false;

    try {
      const response = await fetch(`${this.azureBaseUrl}/save-game`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: this.currentUser.id,
          accountName: this.currentUser.accountName,
          currentChapter: gameState.currentChapter,
          lifePoints: gameState.lifePoints,
          backtrackPoints: gameState.transportCards,
          visitedNodes: gameState.visitedNodes,
          playerChoices: gameState.playerChoices,
          previousNode: gameState.previousNode,
          gameOver: gameState.gameOver
        })
      });

      if (response.ok) {
        this.lastSyncTime = Date.now();
        this.pendingChanges = false;
        console.log('Successfully synced game state to Azure');
        return true;
      } else {
        console.warn('Failed to sync to Azure:', response.status);
        return false;
      }
    } catch (error) {
      console.error('Error syncing to Azure:', error);
      return false;
    }
  }

  // New: retrying, non-blocking sync entry point
  async syncToAzureWithRetry() {
    // Avoid overlapping sync attempts
    if (this.isSyncInProgress) return;

    this.isSyncInProgress = true;

    let attempt = 0;
    let success = false;

    while (attempt < this.maxRetryAttempts && !success && this.pendingChanges) {
      attempt += 1;
      success = await this.syncToAzureOnce();

      if (!success) {
        // Notify user we are retrying
        this._notifyRetry();

        // Exponential backoff: 1s, 2s, 4s
        const backoffMs = Math.pow(2, attempt - 1) * 1000;
        await this._sleep(backoffMs);
      }
    }

    if (!success) {
      // Keep pendingChanges = true so the periodic timer can try again later
      console.warn('All retry attempts to sync game state have failed. Will retry later.');
    }

    this.isSyncInProgress = false;
  }

  // New: simple sleep helper for backoff
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // New: show a toast if available, otherwise log
  _notifyRetry() {
    const title = '保存失败';
    const description = '进度保存失败，重试中';
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
      try {
        window.showToast(title, description, 'error');
      } catch (e) {
        console.warn('Failed to show toast notification:', e);
      }
    } else {
      console.warn(`${title}: ${description}`);
    }
  }

  async loadGameStateFromAzure(userId) {
    try {
      const response = await fetch(`${this.azureBaseUrl}/load-game`);
      
      if (response.ok) {
        const gameState = await response.json();
        return gameState;
      } else {
        console.warn('Failed to load game state from Azure:', response.status);
        return null;
      }
    } catch (error) {
      console.error('Error loading from Azure:', error);
      return null;
    }
  }

  // NEW: helper to fetch canonical user id (and server game state) via backend login
  async fetchCanonicalUserFromAzure(accountName) {
    const response = await fetch(`${this.azureBaseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accountName })
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.warn('Login fetch for canonical user failed:', response.status, text);
      return null;
    }

    const data = await response.json();
    return {
      userId: data.userId,
      gameState: data.gameState,
      accountName: data.accountName
    };
  }

  // Utility methods
  getLastSyncTime() {
    return this.lastSyncTime;
  }

  hasPendingChanges() {
    return this.pendingChanges;
  }

  // Manual sync trigger
  async forceSync() {
    if (this.currentUser) {
      await this.syncToAzure();
    }
  }
}

// Create global instance
const storageService = new StorageService();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageService;
} 