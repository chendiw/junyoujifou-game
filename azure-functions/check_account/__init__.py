import azure.functions as func
import logging
import json
import os
import re
from azure.storage.blob import BlobServiceClient
from azure.core.exceptions import ResourceNotFoundError


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Check account availability function called')

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
        if not re.match(r'^[\u4e00-\u9fff\w\s]+$', account_name):
            return func.HttpResponse(
                json.dumps({'error': 'Account name can only contain letters, numbers, spaces, and Chinese characters'}),
                status_code=400,
                headers=headers,
                mimetype='application/json'
            )

        # Length validation
        if len(account_name) < 2 or len(account_name) > 20:
            return func.HttpResponse(
                json.dumps({'error': 'Account name must be between 2 and 20 characters'}),
                status_code=400,
                headers=headers,
                mimetype='application/json'
            )

        # Create blob service client
        blob_service_client = BlobServiceClient.from_connection_string(connection_string)
        container_client = blob_service_client.get_container_client(container_name)

        # Get account list
        account_list_blob_name = 'account-list.json'
        account_list_blob = container_client.get_blob_client(account_list_blob_name)

        # Default: available when list not found
        existing_accounts = []
        try:
            download_stream = account_list_blob.download_blob()
            account_list_json = download_stream.readall().decode('utf-8')
            existing_accounts = json.loads(account_list_json)
        except ResourceNotFoundError:
            existing_accounts = []
        except Exception as e:
            # If other errors, log and still treat as no accounts found to avoid blocking
            logging.warning(f'Failed to read account list for availability check: {e}')
            existing_accounts = []

        # Case-insensitive match
        account_name_lower = account_name.lower()
        for acc in existing_accounts:
            try:
                if str(acc.get('name', '')).lower() == account_name_lower:
                    return func.HttpResponse(
                        json.dumps({'available': False, 'error': 'Account name already exists'}),
                        status_code=409,
                        headers=headers,
                        mimetype='application/json'
                    )
            except Exception:
                continue

        # Available
        return func.HttpResponse(
            json.dumps({'available': True}),
            status_code=200,
            headers=headers,
            mimetype='application/json'
        )

    except Exception as e:
        logging.error(f'Error checking account availability: {str(e)}')
        return func.HttpResponse(
            json.dumps({'error': 'Failed to check account availability'}),
            status_code=500,
            headers=headers,
            mimetype='application/json'
        ) 