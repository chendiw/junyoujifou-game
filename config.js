// Configuration for the game
const CONFIG = {
  // Azure Function App URL - Update this with your actual Azure function URL
  AZURE_BASE_URL: 'https://your-azure-function-app.azurewebsites.net/api',
  
  // Sync interval in milliseconds (5 minutes)
  SYNC_INTERVAL: 5 * 60 * 1000,
  
  // Game settings
  INITIAL_LIFE_POINTS: 5,
  INITIAL_TRANSPORT_CARDS: 3,
  STARTING_CHAPTER: "1",
  
  // Storage keys
  STORAGE_KEYS: {
    CURRENT_GAME: 'junYouJiFouGame',
    USERS: 'gameUsers',
    GAME_STATE_PREFIX: 'gameState_'
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
} 