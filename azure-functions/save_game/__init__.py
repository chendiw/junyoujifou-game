import azure.functions as func
import logging
import json
import os
from datetime import datetime
from azure.storage.blob import BlobServiceClient

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Save game function called')

    # Enable CORS
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    }

    # Handle preflight requests
    if req.method == 'OPTIONS':
        logging.info('Handling OPTIONS preflight request')
        return func.HttpResponse(status_code=200, headers=headers)

    # Only allow POST requests
    if req.method != 'POST':
        logging.error(f'Invalid method: {req.method}')
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
            logging.error('STORAGE_CONNECTION_STRING is not set!')

        if not connection_string:
            logging.error('Storage connection string not configured')
            return func.HttpResponse(
                json.dumps({'error': 'Storage connection string not configured'}),
                status_code=500,
                headers=headers,
                mimetype='application/json'
            )

        # Get request body
        req_body = req.get_json()
        
        # Validate request
        if not req_body or 'userId' not in req_body:
            logging.error('Invalid request: userId is required')
            return func.HttpResponse(
                json.dumps({'error': 'userId is required'}),
                status_code=400,
                headers=headers,
                mimetype='application/json'
            )

        # Prepare game state
        game_state = {
            'userId': req_body['userId'],
            'currentChapter': req_body.get('currentChapter', 1),
            'lifePoints': req_body.get('lifePoints', 5),
            'backtrackPoints': req_body.get('backtrackPoints', 3),
            'visitedNodes': req_body.get('visitedNodes', []),
            'playerChoices': req_body.get('playerChoices', []),
            'previousNode': req_body.get('previousNode'),
            'gameOver': req_body.get('gameOver', False),
            'lastSaved': datetime.utcnow().isoformat(),
            'version': '1.0'
        }

        # Create blob service client
        blob_service_client = BlobServiceClient.from_connection_string(connection_string)
        container_client = blob_service_client.get_container_client(container_name)

        # Ensure container exists
        try:
            container_client.create_container()
        except Exception as container_error:
            if 'ContainerAlreadyExists' not in str(container_error):
                logging.warning(f'Container creation failed: {container_error}')

        # Create blob client and upload
        blob_name = f"user-{game_state['userId']}.json"
        blob_client = container_client.get_blob_client(blob_name)
        json_content = json.dumps(game_state, indent=2)
        blob_client.upload_blob(json_content, overwrite=True, content_settings=None)

        response_data = {
            'success': True,
            'message': 'Game saved successfully',
            'userId': game_state['userId'],
            'lastSaved': game_state['lastSaved']
        }
        
        return func.HttpResponse(
            json.dumps(response_data),
            status_code=200,
            headers=headers,
            mimetype='application/json'
        )

    except Exception as e:
        logging.error(f'Error saving game: {str(e)}')
        return func.HttpResponse(
            json.dumps({'error': 'Failed to save game'}),
            status_code=500,
            headers=headers,
            mimetype='application/json'
        ) 