import azure.functions as func
import logging
import json
import os
from datetime import datetime
from azure.storage.blob import BlobServiceClient

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Report bug function called')

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
            return func.HttpResponse(
                json.dumps({'error': 'Storage connection string not configured'}),
                status_code=500,
                headers=headers,
                mimetype='application/json'
            )

        # Get request body
        req_body = req.get_json()
        
        # Validate request
        if not req_body or 'userId' not in req_body or 'issue' not in req_body:
            logging.error('Invalid request: userId and issue are required')
            return func.HttpResponse(
                json.dumps({'error': 'userId and issue are required'}),
                status_code=400,
                headers=headers,
                mimetype='application/json'
            )

        userId = req_body['userId']
        issue = req_body['issue']
        gameState = req_body.get('gameState', {})
        
        # Create timestamp for the bug report
        timestamp = datetime.utcnow().isoformat()
        
        # Prepare bug report data
        bug_report = {
            'userId': userId,
            'timestamp': timestamp,
            'issue': issue,
            'gameState': gameState,
            'userAgent': req.headers.get('User-Agent', ''),
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

        # Create bug-reports directory structure and upload file
        # Format: bug-reports/YYYY-MM-DD/userId_timestamp.json
        date_str = datetime.utcnow().strftime('%Y-%m-%d')
        time_str = datetime.utcnow().strftime('%H-%M-%S')
        blob_name = f"bug-reports/{date_str}/{userId}_{time_str}.json"
        
        blob_client = container_client.get_blob_client(blob_name)
        json_content = json.dumps(bug_report, indent=2, ensure_ascii=False)
        blob_client.upload_blob(json_content, overwrite=True, content_settings=None)

        response_data = {
            'success': True,
            'message': 'Bug report submitted successfully',
            'userId': userId,
            'timestamp': timestamp,
            'reportId': f"{userId}_{time_str}"
        }
        
        return func.HttpResponse(
            json.dumps(response_data),
            status_code=200,
            headers=headers,
            mimetype='application/json'
        )

    except Exception as e:
        logging.error(f'Error submitting bug report: {str(e)}')
        return func.HttpResponse(
            json.dumps({'error': 'Failed to submit bug report'}),
            status_code=500,
            headers=headers,
            mimetype='application/json'
        ) 