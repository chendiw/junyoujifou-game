const { BlobServiceClient } = require('@azure/storage-blob');

module.exports = async function (req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
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

        // Get userId from query parameters
        const userId = req.query.userId;

        if (!userId) {
            res.status(400).json({ error: "userId is required" });
            return;
        }

        // Create blob service client
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(containerName);

        // Create blob client
        const blobName = `user-${userId}.json`;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        try {
            // Download the game state
            const downloadResponse = await blockBlobClient.download();
            const gameStateJson = await streamToString(downloadResponse.readableStreamBody);
            const gameState = JSON.parse(gameStateJson);

            res.status(200).json({
                success: true,
                gameState: gameState
            });

        } catch (downloadError) {
            // If blob doesn't exist, return default game state
            const defaultGameState = {
                userId: userId,
                currentChapter: 1,
                lifePoints: 5,
                backtrackPoints: 3,
                visitedNodes: [],
                playerChoices: [],
                previousNode: null,
                gameOver: false,
                lastSaved: new Date().toISOString(),
                version: "1.0"
            };

            res.status(200).json({
                success: true,
                gameState: defaultGameState,
                message: "No saved game found, returning default state"
            });
        }

    } catch (error) {
        console.error("Error loading game:", error);
        res.status(500).json({ error: "Failed to load game" });
    }
};

// Helper function to convert stream to string
async function streamToString(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on("data", (data) => {
            chunks.push(Buffer.from(data));
        });
        readableStream.on("end", () => {
            resolve(Buffer.concat(chunks).toString("utf8"));
        });
        readableStream.on("error", reject);
    });
} 