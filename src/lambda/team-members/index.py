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
VETERAN_LOGO_URLS = {
    'US_Army': f'https://{BUCKET_NAME}.s3.amazonaws.com/About_us/US_Army.png',
    'US_Navy': f'https://{BUCKET_NAME}.s3.amazonaws.com/About_us/US_Navy.png',
}
VETERAN_LOGO_NAMES = {url: name for name, url in VETERAN_LOGO_URLS.items()}


def decimal_to_native(obj):
    if isinstance(obj, list):
        return [decimal_to_native(i) for i in obj]
    if isinstance(obj, dict):
        return {k: decimal_to_native(v) for k, v in obj.items()}
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    return obj


def veteran_logo_url(value):
    if value is None:
        return None
    return VETERAN_LOGO_URLS[value]


def team_member_for_response(member):
    response_member = dict(member)
    logo_url = response_member.get('veteranLogo')
    if logo_url in VETERAN_LOGO_NAMES:
        response_member['veteranLogo'] = VETERAN_LOGO_NAMES[logo_url]
    return decimal_to_native(response_member)


def upload_image_data_url(data_url):
    if not isinstance(data_url, str) or not data_url.startswith('data:'):
        raise ValueError('Invalid replacement image')

    try:
        header, encoded = data_url.split(',', 1)
        extension = header.split('/')[1].split(';')[0]
    except (ValueError, IndexError) as exc:
        raise ValueError('Invalid image data') from exc

    key = f"About_us/{uuid.uuid4()}.{extension}"
    s3.put_object(
        Bucket=BUCKET_NAME,
        Key=key,
        Body=base64.b64decode(encoded),
        ContentType=f"image/{extension}",
    )
    return key, f"https://{BUCKET_NAME}.s3.amazonaws.com/{key}"


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
    route_key = event.get('routeKey', '')

    try:
        if method == 'GET':
            return get_team_members()
        elif method == 'POST':
            return create_team_member(event)
        elif method == 'DELETE':
            return delete_team_member(event)
        elif method == 'PUT':
            if route_key == 'PUT /team-members/order':
                return update_card_order(event)
            if route_key == 'PUT /team-members/{id}':
                return update_team_member(event)
            return {
                "statusCode": 404,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                "body": json.dumps({"error": "Unknown PUT route"})
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
        "body": json.dumps([team_member_for_response(member) for member in members])
    }


def delete_team_member(event):
    path_params = event.get('pathParameters') or {}
    member_id = path_params.get('id')
    if not member_id:
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "ID is required"})
        }

    item = table.get_item(Key={'id': member_id}).get('Item')
    if not item:
        return {
            "statusCode": 404,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Team member not found"})
        }

    image_url = item.get('image') or ''
    if BUCKET_NAME and BUCKET_NAME in image_url and '.amazonaws.com/' in image_url:
        key = image_url.split('.amazonaws.com/', 1)[1]
        if key:
            s3.delete_object(Bucket=BUCKET_NAME, Key=key)

    table.delete_item(Key={'id': member_id})
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
        "body": json.dumps({"message": "Team member deleted"})
    }


def update_team_member(event):
    path_params = event.get('pathParameters') or {}
    member_id = path_params.get('id')
    if not member_id:
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "ID is required"})
        }

    existing = table.get_item(Key={'id': member_id}).get('Item')
    if not existing:
        return {
            "statusCode": 404,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Team member not found"})
        }

    body = json.loads(event.get('body') or '{}')
    member_order = body.get('memberOrder', existing.get('memberOrder', 0))

    old_image_url = existing.get('image', '')
    new_image_url = old_image_url
    new_image_key = None

    if 'image' in body:
        try:
            new_image_key, new_image_url = upload_image_data_url(body['image'])
        except ValueError as exc:
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": str(exc)})
            }

    item = {
        'id': member_id,
        'memberOrder': int(member_order),
        'name': body.get('name', existing.get('name', 'Name')),
        'title': body.get('title', existing.get('title', 'Title')),
        'details': body['details'] if 'details' in body else (existing.get('details') or []),
        'image': new_image_url,
    }

    if 'veteranLogo' in body:
        logo = veteran_logo_url(body['veteranLogo'])
    else:
        logo = existing.get('veteranLogo')

    if logo:
        item['veteranLogo'] = logo

    try:
        table.put_item(Item=item)
    except Exception:
        if new_image_key:
            try:
                s3.delete_object(Bucket=BUCKET_NAME, Key=new_image_key)
            except Exception as exc:
                print(f"Failed to clean up new image {new_image_key}: {exc}")
        raise

    if new_image_key:
        if BUCKET_NAME and BUCKET_NAME in old_image_url and '.amazonaws.com/' in old_image_url:
            old_image_key = old_image_url.split('.amazonaws.com/', 1)[1]
            if old_image_key and old_image_key != new_image_key:
                try:
                    s3.delete_object(Bucket=BUCKET_NAME, Key=old_image_key)
                except Exception as exc:
                    print(f"Failed to delete old image {old_image_key}: {exc}")

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
        "body": json.dumps(team_member_for_response(item))
    }


def create_team_member(event):
    body = json.loads(event.get('body') or '{}')

    logo = veteran_logo_url(body.get('veteranLogo'))

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
        'veteranLogo': logo,
        'image': image_url,
    }
    table.put_item(Item=item)

    return {
        "statusCode": 201,
        "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
        "body": json.dumps(team_member_for_response(item))
    }

def update_card_order(event):
    body = json.loads(event.get('body') or '{}')
    orders = body['orders']

    for card_order in orders:
        table.update_item(
            Key={
                'id': card_order['id']
            },
            UpdateExpression='SET #order = :order',
            ExpressionAttributeNames={
                '#order': 'memberOrder'
            },
            ExpressionAttributeValues={
                ':order': card_order['memberOrder']
            }
        )

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        },
        "body": json.dumps({
            "message": "Card order updated"
        })
    }
