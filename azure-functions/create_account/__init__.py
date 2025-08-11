import azure.functions as func
import logging
import json
import os
import re
from datetime import datetime
from azure.storage.blob import BlobServiceClient

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Create account function called')

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
        
        # Check for invalid characters (only allow letters, numbers, spaces, and Chinese characters)
        # if not re.match(r'^[\u4e00-\u9fff\w\s]+$', account_name):
        #     return func.HttpResponse(
        #         json.dumps({'error': 'Account name can only contain letters, numbers, spaces, and Chinese characters'}),
        #         status_code=400,
        #         headers=headers,
        #         mimetype='application/json'
        #     )
        
        # Length validation
        if len(account_name) < 2 or len(account_name) > 20:
            return func.HttpResponse(
                json.dumps({'error': 'Account name must be between 2 and 20 characters'}),
                status_code=400,
                headers=headers,
                mimetype='application/json'
            )

        # New: require userId from client and use it verbatim
        user_id = (req_body.get('userId') or '').strip()
        if not user_id:
            return func.HttpResponse(
                json.dumps({'error': 'userId is required'}),
                status_code=400,
                headers=headers,
                mimetype='application/json'
            )
        # Basic validation for blob-safe characters
        if not re.match(r'^[A-Za-z0-9_-]{6,128}$', user_id):
            return func.HttpResponse(
                json.dumps({'error': 'Invalid userId format'}),
                status_code=400,
                headers=headers,
                mimetype='application/json'
            )

        # Create blob service client
        blob_service_client = BlobServiceClient.from_connection_string(connection_string)
        container_client = blob_service_client.get_container_client(container_name)

        # Ensure container exists
        try:
            container_client.create_container()
        except Exception as container_error:
            if 'ContainerAlreadyExists' not in str(container_error):
                logging.warning(f'Container creation failed: {container_error}')

        # Check if account name already exists
        account_list_blob_name = "account-list.json"
        account_list_blob = container_client.get_blob_client(account_list_blob_name)
        
        existing_accounts = []
        try:
            download_stream = account_list_blob.download_blob()
            account_list_json = download_stream.readall().decode('utf-8')
            existing_accounts = json.loads(account_list_json)
        except Exception:
            # File doesn't exist, start with empty list
            existing_accounts = []
        
        # Check for exact match (case-insensitive)
        account_name_lower = account_name.lower()
        for existing_account in existing_accounts:
            if existing_account['name'].lower() == account_name_lower:
                return func.HttpResponse(
                    json.dumps({'error': 'Account name already exists, please choose a different name'}),
                    status_code=409,
                    headers=headers,
                    mimetype='application/json'
                )
        
        # Optional: ensure userId is not already used (should not happen under normal flow)
        for existing_account in existing_accounts:
            if str(existing_account.get('id', '')) == user_id:
                return func.HttpResponse(
                    json.dumps({'error': 'userId already exists'}),
                    status_code=409,
                    headers=headers,
                    mimetype='application/json'
                )
        
        # Create new account entry using client-provided userId
        new_account = {
            'id': user_id,
            'name': account_name,
            'createdAt': datetime.utcnow().isoformat(),
            'lastLogin': datetime.utcnow().isoformat()
        }
        
        # Add to account list
        existing_accounts.append(new_account)
        
        # Save updated account list
        account_list_content = json.dumps(existing_accounts, indent=2, ensure_ascii=False)
        account_list_blob.upload_blob(account_list_content, overwrite=True, content_settings=None)
        
        # Create initial game state for new account
        initial_game_state = {
            'userId': user_id,
            'accountName': account_name,
            'currentChapter': 1,
            'lifePoints': 5,
            'backtrackPoints': 3,
            'visitedNodes': [],
            'playerChoices': [],
            'unlockedEndings': [],
            'previousNode': None,
            'gameOver': False,
            'lastSaved': datetime.utcnow().isoformat(),
            'version': '1.0'
        }
        
        # Save initial game state
        game_state_blob_name = f"user-{user_id}.json"
        game_state_blob = container_client.get_blob_client(game_state_blob_name)
        game_state_content = json.dumps(initial_game_state, indent=2, ensure_ascii=False)
        game_state_blob.upload_blob(game_state_content, overwrite=True, content_settings=None)

        response_data = {
            'success': True,
            'message': 'Account created successfully',
            'userId': user_id,
            'accountName': account_name,
            'gameState': initial_game_state
        }
        
        return func.HttpResponse(
            json.dumps(response_data, ensure_ascii=False),
            status_code=200,
            headers=headers,
            mimetype='application/json'
        )

    except Exception as e:
        logging.error(f'Error creating account: {str(e)}')
        return func.HttpResponse(
            json.dumps({'error': 'Failed to create account'}),
            status_code=500,
            headers=headers,
            mimetype='application/json'
        ) 