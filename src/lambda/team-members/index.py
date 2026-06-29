import json
import boto3
import os
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['TABLE_NAME'])
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
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Forbidden"})
        }

    method = event['requestContext']['http']['method']

    try:
        if method == 'GET':
            return get_team_members()
        elif method in ('POST', 'PUT', 'DELETE'):
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
