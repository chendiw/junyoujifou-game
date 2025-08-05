const { BlobServiceClient } = require('@azure/storage-blob');

module.exports = async function (req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        // Get connection string from environment variables
        const connectionString = process.env.STORAGE_CONNECTION_STRING;
        const containerName = process.env.SAVE_CONTAINER_NAME || "game-saves";

        if (!connectionString) {
            res.status(500).json({ error: "Storage connection string not configured" });
            return;
        }

        // Validate request
        if (!req.body || !req.body.userId) {
            res.status(400).json({ error: "userId is required" });
            return;
        }

        const gameState = {
            userId: req.body.userId,
            currentChapter: req.body.currentChapter || 1,
            lifePoints: req.body.lifePoints || 5,
            backtrackPoints: req.body.backtrackPoints || 3,
            visitedNodes: req.body.visitedNodes || [],
            playerChoices: req.body.playerChoices || [],
            previousNode: req.body.previousNode || null,
            gameOver: req.body.gameOver || false,
            lastSaved: new Date().toISOString(),
            version: "1.0"
        };

        // Create blob service client
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(containerName);

        // Ensure container exists
        await containerClient.createIfNotExists();

        // Create blob client
        const blobName = `user-${gameState.userId}.json`;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        // Upload the game state
        const jsonContent = JSON.stringify(gameState, null, 2);
        await blockBlobClient.upload(jsonContent, jsonContent.length, {
            blobHTTPHeaders: {
                blobContentType: "application/json"
            }
        });

        res.status(200).json({
            success: true,
            message: "Game saved successfully",
            userId: gameState.userId,
            lastSaved: gameState.lastSaved
        });

    } catch (error) {
        console.error("Error saving game:", error);
        res.status(500).json({ error: "Failed to save game" });
    }
}; 