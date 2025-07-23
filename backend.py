from flask import Flask, request, jsonify
from flask_cors import CORS
import boto3
import json

app = Flask(__name__)
CORS(app)

lambda_client = boto3.client("lambda")

@app.route('/api/agent', methods=['POST'])
def agent():
    data = request.get_json()
    message = data.get('message', '')
    if not message:
        return jsonify({'error': 'No message provided'}), 400
    try:
        response = lambda_client.invoke(
            FunctionName='agent_lambda',
            InvocationType='RequestResponse',
            Payload=json.dumps({'message': message})
        )
        result = json.loads(response["Payload"].read())
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True) 
