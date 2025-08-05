// Save/Load Integration for Junyoujifou Game
// This module handles communication with Azure Static Web Apps API for game state persistence

class GameSaveManager {
    constructor() {
        // Azure Static Web Apps automatically provides the API URL
        this.baseUrl = '/api'; // This will be automatically resolved by Static Web Apps
        this.userId = this.getOrCreateUserId();
    }

    // Generate or retrieve user ID
    getOrCreateUserId() {
        let userId = localStorage.getItem('junyoujifou_user_id');
        if (!userId) {
            userId = 'user-' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('junyoujifou_user_id', userId);
        }
        return userId;
    }

    // Save game state to Azure Static Web Apps API
    async saveGame(gameState) {
        try {
            const saveData = {
                userId: this.userId,
                currentChapter: gameState.currentChapter,
                lifePoints: gameState.lifePoints,
                backtrackPoints: gameState.backtrackPoints,
                visitedNodes: Array.from(gameState.visitedNodes),
                playerChoices: gameState.playerChoices,
                previousNode: gameState.previousNode,
                gameOver: gameState.gameOver
            };

            const response = await fetch(`${this.baseUrl}/save-game`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(saveData)
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

    // Load game state from Azure Static Web Apps API
    async loadGame() {
        try {
            const response = await fetch(`${this.baseUrl}/load-game?userId=${this.userId}`, {
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

    // Auto-save game state
    async autoSave(gameState) {
        try {
            await this.saveGame(gameState);
            console.log('Auto-save completed');
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    }

    // Load game state and apply to game
    async loadAndApply(gameInstance) {
        try {
            const savedState = await this.loadGame();
            
            // Apply saved state to game
            gameInstance.currentChapter = savedState.currentChapter;
            gameInstance.lifePoints = savedState.lifePoints;
            gameInstance.backtrackPoints = savedState.backtrackPoints;
            gameInstance.visitedNodes = new Set(savedState.visitedNodes);
            gameInstance.playerChoices = savedState.playerChoices;
            gameInstance.previousNode = savedState.previousNode;
            gameInstance.gameOver = savedState.gameOver;

            // Update UI
            gameInstance.updateLifeCounter();
            gameInstance.updateBacktrackCounter();
            gameInstance.showCurrentNode();

            console.log('Game state loaded and applied');
            return true;

        } catch (error) {
            console.error('Failed to load and apply game state:', error);
            return false;
        }
    }
}

// Export for use in the game
window.GameSaveManager = GameSaveManager; 