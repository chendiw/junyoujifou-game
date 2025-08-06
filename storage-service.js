// Hybrid Storage Service - localStorage + Azure Backend
class StorageService {
  constructor() {
    this.azureBaseUrl = CONFIG.AZURE_BASE_URL;
    this.syncInterval = CONFIG.SYNC_INTERVAL;
    this.lastSyncTime = 0;
    this.pendingChanges = false;
    this.currentUser = null;
    
    // Start sync timer
    this.startSyncTimer();
  }

  // Initialize with Azure function URL
  setAzureBaseUrl(url) {
    this.azureBaseUrl = url;
  }

  // Start periodic sync timer
  startSyncTimer() {
    setInterval(() => {
      if (this.pendingChanges && this.currentUser) {
        this.syncToAzure();
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
      
      // Try to sync to Azure (this will also check for duplicates on the server)
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
      
      // Save to localStorage for immediate access
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
    
    // Mark for Azure sync
    this.pendingChanges = true;
    this.currentUser = { id: userId };
  }

  loadGameState(userId) {
    return this.loadFromLocal(`${CONFIG.STORAGE_KEYS.GAME_STATE_PREFIX}${userId}`);
  }

  // Azure Backend Operations
  async syncUserToAzure(user, gameState) {
    try {
      // Create user in Azure
      const userResponse = await fetch(`${this.azureBaseUrl}/create_account`, {
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

      // Update game state in Azure
      const gameStateResponse = await fetch(`${this.azureBaseUrl}/game-state/${user.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gameState)
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

  async syncToAzure() {
    if (!this.currentUser) return;
    
    const gameState = this.loadGameState(this.currentUser.id);
    if (!gameState) return;
    
    try {
      const response = await fetch(`${this.azureBaseUrl}/game-state/${this.currentUser.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gameState)
      });

      if (response.ok) {
        this.lastSyncTime = Date.now();
        this.pendingChanges = false;
        console.log('Successfully synced game state to Azure');
      } else {
        console.warn('Failed to sync to Azure:', response.status);
      }
    } catch (error) {
      console.error('Error syncing to Azure:', error);
    }
  }

  async loadGameStateFromAzure(userId) {
    try {
      const response = await fetch(`${this.azureBaseUrl}/game-state/${userId}`);
      
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