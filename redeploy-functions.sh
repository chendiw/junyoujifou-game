#!/bin/bash

# Redeploy Azure Functions for Junyoujifou Game with claimedBonus feature
echo "🚀 Redeploying Azure Functions with claimedBonus feature..."

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

# Check if Function App exists
echo "🔍 Checking if Function App exists..."
if ! az functionapp show --resource-group $RESOURCE_GROUP --name $FUNCTION_APP_NAME &> /dev/null; then
    echo "❌ Function App '$FUNCTION_APP_NAME' not found in resource group '$RESOURCE_GROUP'"
    echo "   Please run the original deploy-functions.sh script first to create the Function App"
    exit 1
fi

# Verify Azure Functions Core Tools is installed
if ! command -v func &> /dev/null; then
    echo "❌ Azure Functions Core Tools is not installed."
    echo "   Please install it: npm install -g azure-functions-core-tools@4 --unsafe-perm true"
    exit 1
fi

# Deploy the functions
echo "📦 Deploying updated functions..."
cd azure-functions

# Show what functions will be deployed
echo "📋 Functions to be deployed:"
ls -la */function.json | sed 's|/function.json||' | sed 's|^|   - |'

# Deploy
echo "🚀 Publishing to Azure..."
func azure functionapp publish $FUNCTION_APP_NAME

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo "🌐 Function App URL: https://$FUNCTION_APP_NAME.azurewebsites.net"
    echo "📝 Functions deployed:"
    echo "   - create-account (with claimedBonus support)"
    echo "   - login (with claimedBonus support)"
    echo "   - save-game (with claimedBonus support)"
    echo "   - load-game (with claimedBonus support)"
    echo "   - check-account"
    echo ""
    echo "🎉 All functions now support the claimedBonus feature!"
else
    echo "❌ Deployment failed!"
    exit 1
fi 