import azure.functions as func
import logging
import json
import os
from datetime import datetime
from azure.storage.blob import BlobServiceClient
from azure.core.exceptions import ResourceNotFoundError

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Login function called')

    # Enable CORS
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    }

    # Handle preflight requests
    if req.method == 'OPTIONS':
        return func.HttpResponse(status_code=200, headers=headers)

    # Only allow POST requests
    if req.method != 'POST':
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
            return func.HttpResponse(
                json.dumps({'error': 'Storage connection string not configured'}),
                status_code=500,
                headers=headers,
                mimetype='application/json'
            )

        # Get request body
        req_body = req.get_json()
        
        # Validate request
        if not req_body or 'accountName' not in req_body:
            logging.error('Invalid request: accountName is required')
            return func.HttpResponse(
                json.dumps({'error': 'accountName is required'}),
                status_code=400,
                headers=headers,
                mimetype='application/json'
            )

        account_name = req_body['accountName'].strip()
        
        # Validate account name
        if not account_name:
            return func.HttpResponse(
                json.dumps({'error': 'Account name cannot be empty'}),
                status_code=400,
                headers=headers,
                mimetype='application/json'
            )

        # Create blob service client
        blob_service_client = BlobServiceClient.from_connection_string(connection_string)
        container_client = blob_service_client.get_container_client(container_name)

        # Get account list
        account_list_blob_name = "account-list.json"
        account_list_blob = container_client.get_blob_client(account_list_blob_name)
        
        try:
            download_stream = account_list_blob.download_blob()
            account_list_json = download_stream.readall().decode('utf-8')
            existing_accounts = json.loads(account_list_json)
        except ResourceNotFoundError:
            return func.HttpResponse(
                json.dumps({'error': 'Account not found'}),
                status_code=404,
                headers=headers,
                mimetype='application/json'
            )
        
        # Find the account (case-insensitive)
        account_name_lower = account_name.lower()
        found_account = None
        for account in existing_accounts:
            if account['name'].lower() == account_name_lower:
                found_account = account
                break
        
        if not found_account:
            return func.HttpResponse(
                json.dumps({'error': 'Account not found'}),
                status_code=404,
                headers=headers,
                mimetype='application/json'
            )
        
        # Update last login time
        found_account['lastLogin'] = datetime.utcnow().isoformat()
        
        # Save updated account list
        account_list_content = json.dumps(existing_accounts, indent=2, ensure_ascii=False)
        account_list_blob.upload_blob(account_list_content, overwrite=True, content_settings=None)
        
        # Get user's game state
        user_id = found_account['id']
        game_state_blob_name = f"user-{user_id}.json"
        game_state_blob = container_client.get_blob_client(game_state_blob_name)
        
        try:
            download_stream = game_state_blob.download_blob()
            game_state_json = download_stream.readall().decode('utf-8')
            game_state = json.loads(game_state_json)
        except ResourceNotFoundError:
            # Create default game state if not found
            game_state = {
                'userId': user_id,
                'accountName': found_account['name'],
                'currentChapter': 1,
                'lifePoints': 5,
                'backtrackPoints': 3,
                'visitedNodes': [],
                'playerChoices': [],
                'previousNode': None,
                'gameOver': False,
                'lastSaved': datetime.utcnow().isoformat(),
                'version': '1.0'
            }
            
            # Save the default game state
            game_state_content = json.dumps(game_state, indent=2, ensure_ascii=False)
            game_state_blob.upload_blob(game_state_content, overwrite=True, content_settings=None)

        response_data = {
            'success': True,
            'message': 'Login successful',
            'userId': user_id,
            'accountName': found_account['name'],
            'gameState': game_state
        }
        
        return func.HttpResponse(
            json.dumps(response_data, ensure_ascii=False),
            status_code=200,
            headers=headers,
            mimetype='application/json'
        )

    except Exception as e:
        logging.error(f'Error during login: {str(e)}')
        return func.HttpResponse(
            json.dumps({'error': 'Failed to login'}),
            status_code=500,
            headers=headers,
            mimetype='application/json'
        ) 