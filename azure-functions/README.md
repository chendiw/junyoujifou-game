# Azure Functions for Junyoujifou Game

This directory contains the Azure Functions for the game's save/load functionality.

## Setup

1. **Copy the template file:**
   ```bash
   cp local.settings.template.json local.settings.json
   ```

2. **Update `local.settings.json` with your Azure Storage connection string:**
   - Replace `YOUR_STORAGE_CONNECTION_STRING_HERE` with your actual connection string
   - Get the connection string from Azure Portal → Storage Account → Access Keys

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Deploy to Azure:**
   ```bash
   func azure functionapp publish YOUR_FUNCTION_APP_NAME
   ```

## Functions

- **save_game**: Saves game state to Azure Blob Storage
- **load_game**: Loads game state from Azure Blob Storage

## Environment Variables

- `STORAGE_CONNECTION_STRING`: Azure Storage connection string
- `SAVE_CONTAINER_NAME`: Container name for game saves (default: "game-saves")

## Security Note

The `local.settings.json` file contains sensitive information and is excluded from Git. Never commit this file to version control. 