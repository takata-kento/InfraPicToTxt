from langchain_community.llms.bedrock import Bedrock
import boto3

def lambda_handler(event, context):
    base64 = event['base64']
    question = 'Base64でエンコードされた画像を添付するのでそこに記載されている文字を抽出してください。'
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

    response = llm.predict(question + '\n' + base64)
    return response