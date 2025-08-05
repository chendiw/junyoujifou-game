// Save/Load Integration for Junyoujifou Game
// This module handles communication with Azure Functions for game state persistence

class GameSaveManager {
    constructor() {
        // Azure Functions URL
        this.baseUrl = 'https://junyoujifou-game-functions.azurewebsites.net';
        this.userId = this.getUserId();
        this.accountName = this.getAccountName();
    }

    // Get user ID from localStorage (should be set by login)
    getUserId() {
        const userId = localStorage.getItem('junyoujifou_userId');
        if (!userId) {
            // Redirect to login if no user ID
            window.location.href = 'login.html';
            return null;
        }
        return userId;
    }

    // Get account name from localStorage
    getAccountName() {
        return localStorage.getItem('junyoujifou_accountName') || '';
    }

    // Save game state to Azure Functions
    async saveGame(gameInstance) {
        try {
            const gameState = {
                userId: this.userId,
                accountName: this.accountName,
                currentChapter: gameInstance.currentChapter,
                lifePoints: gameInstance.lifePoints,
                backtrackPoints: gameInstance.backtrackPoints,
                visitedNodes: gameInstance.visitedNodes,
                playerChoices: gameInstance.playerChoices,
                previousNode: gameInstance.previousNode,
                gameOver: gameInstance.gameOver
            };

            const response = await fetch(`${this.baseUrl}/api/save-game`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(gameState)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Game saved successfully:', result);
            return result;

        } catch (error) {
            console.error('Error saving game:', error);
            throw error;
        }
    }

    // Load game state from Azure Functions
    async loadGame() {
        try {
            const response = await fetch(`${this.baseUrl}/api/load-game?userId=${this.userId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Game loaded successfully:', result);
            return result.gameState;

        } catch (error) {
            console.error('Error loading game:', error);
            throw error;
        }
    }

    // Apply loaded game state to game instance
    applyGameState(gameInstance, gameState) {
        if (gameState && gameState.currentChapter) {
            gameInstance.currentChapter = gameState.currentChapter;
            gameInstance.lifePoints = gameState.lifePoints;
            gameInstance.backtrackPoints = gameState.backtrackPoints;
            gameInstance.visitedNodes = gameState.visitedNodes || [];
            gameInstance.playerChoices = gameState.playerChoices || [];
            gameInstance.previousNode = gameState.previousNode;
            gameInstance.gameOver = gameState.gameOver || false;

            // Update UI to reflect loaded state
            gameInstance.updateUI();
            console.log('Game state applied successfully');
        }
    }

    // Load and apply game state
    async loadAndApply(gameInstance) {
        try {
            const gameState = await this.loadGame();
            this.applyGameState(gameInstance, gameState);
        } catch (error) {
            console.error('Failed to load and apply game state:', error);
            // Continue with default game state if loading fails
        }
    }

    // Auto-save game state
    async autoSave(gameInstance) {
        try {
            await this.saveGame(gameInstance);
        } catch (error) {
            console.error('Auto-save failed:', error);
            throw error;
        }
    }
}

// Export for use in the game
window.GameSaveManager = GameSaveManager; 