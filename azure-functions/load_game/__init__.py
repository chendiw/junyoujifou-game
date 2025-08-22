import azure.functions as func
import logging
import json
import os
from datetime import datetime
from azure.storage.blob import BlobServiceClient
from azure.core.exceptions import ResourceNotFoundError

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request.')

    # Enable CORS
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    }

    # Handle preflight requests
    if req.method == 'OPTIONS':
        return func.HttpResponse(status_code=200, headers=headers)

    # Only allow GET requests
    if req.method != 'GET':
        return func.HttpResponse(
            json.dumps({'error': 'Method not allowed'}),
            status_code=405,
            headers=headers,
            mimetype='application/json'
        )

    try:
        # Get connection string from environment variables
        connection_string = os.environ.get('STORAGE_CONNECTION_STRING')
        container_name = os.environ.get('SAVE_CONTAINER_NAME', 'game-saves')

        if not connection_string:
            return func.HttpResponse(
                json.dumps({'error': 'Storage connection string not configured'}),
                status_code=500,
                headers=headers,
                mimetype='application/json'
            )

        # Get userId from query parameters
        user_id = req.params.get('userId')

        if not user_id:
            return func.HttpResponse(
                json.dumps({'error': 'userId is required'}),
                status_code=400,
                headers=headers,
                mimetype='application/json'
            )

        # Create blob service client
        blob_service_client = BlobServiceClient.from_connection_string(connection_string)
        container_client = blob_service_client.get_container_client(container_name)

        # Create blob client
        blob_name = f"user-{user_id}.json"
        blob_client = container_client.get_blob_client(blob_name)

        try:
            # Download the game state
            download_stream = blob_client.download_blob()
            game_state_json = download_stream.readall().decode('utf-8')
            game_state = json.loads(game_state_json)

            return func.HttpResponse(
                json.dumps({
                    'success': True,
                    'gameState': game_state
                }),
                status_code=200,
                headers=headers,
                mimetype='application/json'
            )

        except ResourceNotFoundError:
            # If blob doesn't exist, return default game state
            default_game_state = {
                'userId': user_id,
                'currentChapter': 1,
                'lifePoints': 5,
                'backtrackPoints': 3,
                'visitedNodes': [],
                'playerChoices': [],
                'unlockedEndings': [],
                'tools': [],
                'claimedBonus': [],
                'previousNode': None,
                'gameOver': False,
                'lastSaved': datetime.utcnow().isoformat(),
                'version': '1.0'
            }

            return func.HttpResponse(
                json.dumps({
                    'success': True,
                    'gameState': default_game_state,
                    'message': 'No saved game found, returning default state'
                }),
                status_code=200,
                headers=headers,
                mimetype='application/json'
            )

    except Exception as e:
        logging.error(f"Error loading game: {str(e)}")
        return func.HttpResponse(
            json.dumps({'error': 'Failed to load game'}),
            status_code=500,
            headers=headers,
            mimetype='application/json'
        ) 