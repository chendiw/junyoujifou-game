// Hybrid Storage Service - localStorage + Azure Backend
class StorageService {
  constructor() {
    this.azureBaseUrl = CONFIG.AZURE_BASE_URL;
    this.syncInterval = CONFIG.SYNC_INTERVAL;
    this.lastSyncTime = 0;
    this.pendingChanges = false;
    this.currentUser = null;

    // Map temp IDs to canonical server IDs
    this.userIdMapping = {};
    
    // New: protect against overlapping syncs and track retries
    this.isSyncInProgress = false;
    this.maxRetryAttempts = 3;
    
    // Start sync timer (fallback)
    this.startSyncTimer();
  }

  // New: generate cryptographically strong random user ID
  static generateRandomId() {
    const array = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(array);
    } else {
      // Fallback: not cryptographically strong
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    // URL-safe base64 without padding
    const base64 = btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    // Ensure it matches server regex [A-Za-z0-9_-]{6,128}
    return base64;
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

      // Server-side availability check BEFORE creating local account
      try {
        const checkResp = await fetch(`${this.azureBaseUrl}/check-account`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountName })
        });

        if (!checkResp.ok) {
          const text = await checkResp.text().catch(() => '');
          if (checkResp.status === 409) {
            throw new Error('Account name already exists, please choose a different name');
          }
          throw new Error(text || 'Failed to verify account name availability');
        }

        const checkData = await checkResp.json().catch(() => ({}));
        if (checkData && checkData.available === false) {
          throw new Error('Account name already exists, please choose a different name');
        }
      } catch (checkErr) {
        console.warn('Availability check failed or name taken:', checkErr?.message || checkErr);
        throw checkErr instanceof Error ? checkErr : new Error('Failed to verify account name availability');
      }
      
      console.log('No duplicates found remotely, proceeding with account creation');
      
      // Create user object with secure random ID generated on client
      const tempUserId = StorageService.generateRandomId();
      console.log('Generated client userId:', tempUserId);
      const user = {
        id: tempUserId,
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
      
      // Save to localStorage immediately for fast UX
      users[accountName] = user;
      this.saveToLocal(CONFIG.STORAGE_KEYS.USERS, users);
      this.saveToLocal(`${CONFIG.STORAGE_KEYS.GAME_STATE_PREFIX}${user.id}`, gameState);
      this.currentUser = user;
      this.pendingChanges = false;

      // Fire-and-forget: complete server creation in background using client-generated userId (no server-generated ID)
      this._completeAccountCreationInBackground({ user, gameState, accountName }).catch(err => {
        console.warn('Background account creation failed:', err?.message || err);
      });

      // Return immediately using the local temp user
      return { user, gameState };
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  // Complete creation with Azure in background using client-generated userId
  async _completeAccountCreationInBackground({ user, gameState, accountName }) {
    try {
      const payload = { accountName, userId: user.id };
      console.log('Calling create-account with payload:', payload);
      const userResponse = await fetch(`${this.azureBaseUrl}/create-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!userResponse.ok) {
        const msg = await userResponse.text().catch(() => '');
        console.warn('Failed to create user in Azure:', userResponse.status, msg);
        return;
      }

      const serverData = await userResponse.json().catch(() => ({}));
      console.log('create-account response:', serverData);
      const serverGameState = serverData?.gameState;

      // Persist any returned server game state under the same client-generated userId
      if (serverGameState && typeof serverGameState === 'object') {
        const normalizedServer = this._normalizeServerGameState(serverGameState);
        if (normalizedServer) {
          this.saveToLocal(`${CONFIG.STORAGE_KEYS.GAME_STATE_PREFIX}${user.id}`, { ...normalizedServer, ...gameState });
        }
      }

      // Ensure we use the same ID going forward
      this.saveGameState(user.id, this.loadFromLocal(`${CONFIG.STORAGE_KEYS.GAME_STATE_PREFIX}${user.id}`) || gameState);
    } catch (e) {
      console.warn('Error during background account creation:', e?.message || e);
    }
  }

  // No-op since userId is client-assigned and canonical from creation time
  async _adoptCanonicalUserId() {
    return;
  }

  async loginUser(accountName) {
    try {
      // First try localStorage
      const users = this.loadFromLocal(CONFIG.STORAGE_KEYS.USERS) || {};
      let user = users[accountName];

      // If user not found locally, fall back to Azure login to fetch canonical userId and game state
      if (!user) {
        const canonical = await this.fetchCanonicalUserFromAzure(accountName);
        if (!canonical || !canonical.userId) {
          throw new Error('Account not found');
        }
        user = { id: canonical.userId, accountName };

        // Normalize server game state to client format
        let gameState = this._normalizeServerGameState(canonical.gameState);

        // Persist locally
        users[accountName] = user;
        this.saveToLocal(CONFIG.STORAGE_KEYS.USERS, users);
        this.saveToLocal(`${CONFIG.STORAGE_KEYS.GAME_STATE_PREFIX}${user.id}`, gameState);

        this.currentUser = user;
        this.pendingChanges = false;
        return { user, gameState };
      }

      // Load game state from localStorage
      let gameState = this.loadFromLocal(`${CONFIG.STORAGE_KEYS.GAME_STATE_PREFIX}${user.id}`);

      // If local game state missing, attempt to load from Azure as fallback
      if (!gameState) {
        const azureGameState = await this.loadGameStateFromAzure(user.id);
        if (azureGameState) {
          gameState = azureGameState;
          this.saveToLocal(`${CONFIG.STORAGE_KEYS.GAME_STATE_PREFIX}${user.id}`, gameState);
        } else {
          throw new Error('Game state not found');
        }
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
    // Rewrite userId if we already know canonical mapping
    const mappedId = this.userIdMapping[userId] || userId;

    // Save to localStorage immediately
    this.saveToLocal(`${CONFIG.STORAGE_KEYS.GAME_STATE_PREFIX}${mappedId}`, gameState);
    
    // Mark for Azure sync and capture user context for payload
    this.pendingChanges = true;
    this.currentUser = { 
      id: mappedId, 
      accountName: (gameState && gameState.user && gameState.user.accountName) ? gameState.user.accountName : (this.currentUser ? this.currentUser.accountName : undefined)
    };

    // If caller passed an outdated temp ID, update their object to canonical to avoid future mismatches
    if (gameState && gameState.user && gameState.user.id && gameState.user.id !== mappedId) {
      try { gameState.user.id = mappedId; } catch (_) {}
    }

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
          unlockedEndings: Array.isArray(gameState.unlockedEndings) ? gameState.unlockedEndings : [],
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
          unlockedEndings: Array.isArray(gameState.unlockedEndings) ? gameState.unlockedEndings : [],
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
      const response = await fetch(`${this.azureBaseUrl}/load-game?userId=${encodeURIComponent(userId)}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.success && data.gameState) {
          return this._normalizeServerGameState(data.gameState);
        }
        return null;
      } else {
        console.warn('Failed to load game state from Azure:', response.status);
        return null;
      }
    } catch (error) {
      console.error('Error loading from Azure:', error);
      return null;
    }
  }

  // NEW: normalize server-side game state to client-side shape
  _normalizeServerGameState(serverState) {
    if (!serverState || typeof serverState !== 'object') return null;
    return {
      currentChapter: String(serverState.currentChapter ?? CONFIG.STARTING_CHAPTER),
      lifePoints: Number.isFinite(serverState.lifePoints) ? serverState.lifePoints : CONFIG.INITIAL_LIFE_POINTS,
      transportCards: Number.isFinite(serverState.backtrackPoints) ? serverState.backtrackPoints : CONFIG.INITIAL_TRANSPORT_CARDS,
      visitedNodes: Array.isArray(serverState.visitedNodes) ? serverState.visitedNodes.map(String) : [CONFIG.STARTING_CHAPTER],
      playerChoices: Array.isArray(serverState.playerChoices) ? serverState.playerChoices : [],
      unlockedEndings: Array.isArray(serverState.unlockedEndings) ? serverState.unlockedEndings : [],
      previousNode: (typeof serverState.previousNode === 'undefined' || serverState.previousNode === null) ? null : String(serverState.previousNode),
      gameOver: !!serverState.gameOver,
      version: serverState.version || '1.0'
    };
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