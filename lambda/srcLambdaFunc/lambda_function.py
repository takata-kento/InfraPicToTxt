from langchain_community.llms.bedrock import Bedrock
import boto3
import json

bedrock = boto3.client(
    service_name='bedrock-runtime',
    region_name='us-east-1',
)

llm = Bedrock(
    model_id='anthropic.claude-3-5-sonnet-20240620-v1:0',
    client = bedrock,
    model_kwargs={
        "max_tokens_to_sample": 4096,
        "temperature": 0,
        "stop_sequences": []
    },
    region_name='us-east-1',
)

def lambda_handler(event, context):
    if 'base64' not in event:
        return {
            'statusCode': 400,
            'body': json.dumps('Error: "base64" key not found in the event')
        }

    base64_data = event['base64']
    question = 'Base64でエンコードされた画像を添付するのでそこに記載されている文字を抽出してください。'

    try:
        response = llm.predict(question + '\n' + base64_data)
        return {
            'statusCode': 200,
            'body': response
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps(f'Error occurred: {str(e)}')
        }
