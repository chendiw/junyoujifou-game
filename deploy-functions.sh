#!/bin/bash

# Deploy Azure Functions for Junyoujifou Game
echo "🚀 Deploying Azure Functions..."

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI is not installed. Please install it first."
    exit 1
fi

# Check if user is logged in
if ! az account show &> /dev/null; then
    echo "❌ Please log in to Azure first: az login"
    exit 1
fi

# Set variables
RESOURCE_GROUP="junyoujifou-game-rg"
STORAGE_ACCOUNT="junyoujifou20250804"
FUNCTION_APP_NAME="junyoujifou-game-functions"
LOCATION="eastasia"

echo "📋 Using:"
echo "   Resource Group: $RESOURCE_GROUP"
echo "   Storage Account: $STORAGE_ACCOUNT"
echo "   Function App: $FUNCTION_APP_NAME"
echo "   Location: $LOCATION"

# Create Function App if it doesn't exist
echo "🔧 Creating Function App..."
az functionapp create \
    --resource-group $RESOURCE_GROUP \
    --consumption-plan-location $LOCATION \
    --runtime python \
    --runtime-version 3.11 \
    --functions-version 4 \
    --name $FUNCTION_APP_NAME \
    --storage-account $STORAGE_ACCOUNT \
    --os-type Linux

# Configure app settings
echo "⚙️ Configuring app settings..."
az functionapp config appsettings set \
    --resource-group $RESOURCE_GROUP \
    --name $FUNCTION_APP_NAME \
    --settings \
    STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=junyoujifou20250804;AccountKey=jlzzGxpE61OgmdzM+KMMSQyy8ZBDe/fwnRC9KN7Flk8pXM68A+5Jgv3i9x6eQyBnA7pkbc608H7J+AStVXzFVA==;EndpointSuffix=core.windows.net" \
    SAVE_CONTAINER_NAME="game-saves"

# Deploy the functions
echo "📦 Deploying functions..."
cd azure-functions
func azure functionapp publish $FUNCTION_APP_NAME

echo "✅ Deployment complete!"
echo "🌐 Function App URL: https://$FUNCTION_APP_NAME.azurewebsites.net"
echo "📝 Update save-load-integration.js with the Function App URL" 