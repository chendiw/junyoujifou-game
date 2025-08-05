#!/bin/bash

echo "Creating Azure Service Principal for GitHub Actions..."
echo "This will create credentials that GitHub Actions can use to deploy to Azure."

# Create service principal
SP_OUTPUT=$(az ad sp create-for-rbac --name "junyoujifou-game-deploy" --role contributor --scopes /subscriptions/$(az account show --query id -o tsv)/resourceGroups/junyoujifou-game-rg --sdk-auth)

echo ""
echo "✅ Service Principal created successfully!"
echo ""
echo "📋 Copy the following JSON and add it as a GitHub Secret named 'AZURE_CREDENTIALS':"
echo ""
echo "$SP_OUTPUT"
echo ""
echo "🔐 To add this as a GitHub Secret:"
echo "1. Go to your GitHub repository"
echo "2. Click Settings → Secrets and variables → Actions"
echo "3. Click 'New repository secret'"
echo "4. Name: AZURE_CREDENTIALS"
echo "5. Value: (paste the JSON above)"
echo ""
echo "⚠️  Keep these credentials secure and don't share them!" 