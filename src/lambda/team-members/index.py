import json
import boto3
import os
import base64
import uuid
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['TABLE_NAME'])
s3 = boto3.client('s3')
BUCKET_NAME = os.environ.get('BUCKET_NAME', '')
ALLOWED_ORIGIN = os.environ.get('ALLOWED_ORIGIN', '')


def decimal_to_native(obj):
    if isinstance(obj, list):
        return [decimal_to_native(i) for i in obj]
    if isinstance(obj, dict):
        return {k: decimal_to_native(v) for k, v in obj.items()}
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    return obj


def handler(event, context):
    headers = event.get('headers', {})
    origin = headers.get('origin', '')
    referer = headers.get('referer', '')

    if ALLOWED_ORIGIN and origin != ALLOWED_ORIGIN and not referer.startswith(ALLOWED_ORIGIN):
        return {
            "statusCode": 401,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Forbidden"})
        }

    method = event['requestContext']['http']['method']

    try:
        if method == 'GET':
            return get_team_members()
        elif method == 'POST':
            return create_team_member(event)
        elif method in ('PUT', 'DELETE'):
            return {
                "statusCode": 200,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps("Hello world")
            }
        else:
            return {
                "statusCode": 405,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "Method not allowed"})
            }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(e)})
        }


def get_team_members():
    response = table.scan()
    members = sorted(response['Items'], key=lambda x: x.get('memberOrder', 0))
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
        "body": json.dumps(decimal_to_native(members))
    }


def create_team_member(event):
    body = json.loads(event.get('body') or '{}')

    image_url = body.get('image') or ''
    if image_url.startswith('data:'):
        header, encoded = image_url.split(',', 1)
        ext = header.split('/')[1].split(';')[0]
        key = f"About_us/{uuid.uuid4()}.{ext}"
        s3.put_object(Bucket=BUCKET_NAME, Key=key, Body=base64.b64decode(encoded), ContentType=f"image/{ext}")
        image_url = f"https://{BUCKET_NAME}.s3.amazonaws.com/{key}"

    item = {
        'id': str(uuid.uuid4()),
        'memberOrder': int(body.get('memberOrder', 0)),
        'name': body.get('name', 'Name'),
        'title': body.get('title', 'Title'),
        'details': body.get('details') or [],
        'veteranLogo': body.get('veteranLogo'),
        'image': image_url,
    }
    table.put_item(Item=item)

    return {
        "statusCode": 201,
        "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
        "body": json.dumps(item)
    }
