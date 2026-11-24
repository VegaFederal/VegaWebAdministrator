"""
Cognito pre-token-generation trigger — Google Group membership check.

Behaviour
---------
ALLOWED_GROUP_EMAIL is empty (dev):
    Pass through — any @vegafederal.com user that Cognito accepted is allowed.

ALLOWED_GROUP_EMAIL is set (prod):
    Ask the Google Workspace Directory API, using a service account with
    domain-wide delegation, whether the user is a member of the group.
    Any failure raises an exception so Cognito refuses to issue tokens (fail closed).

Timing
------
Cognito gives this trigger about 5 seconds, and in this app it runs during the
login function's token exchange, which also has a 5-second limit. To keep cold
starts fast this uses only the small google-auth library plus one direct HTTPS
call, instead of the much larger google-api-python-client.

Environment variables
---------------------
ALLOWED_GROUP_EMAIL
    Google Group email to check. Empty = pass-through (dev).

SERVICE_ACCOUNT_SECRET_ARN
    Secrets Manager secret holding the Google service-account key JSON, plus an
    extra "admin_email" field: the Workspace admin user the service account acts
    as (domain-wide delegation).

Dependencies (installed into the ZIP by CI from requirements.txt)
-----------------------------------------------------------------
google-auth
"""

import json
import logging
import os
import time
import urllib.error
import urllib.parse
import urllib.request

import boto3
import google.auth.exceptions
import google.auth.transport
from botocore.exceptions import ClientError
from google.oauth2 import service_account

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ALLOWED_GROUP_EMAIL = os.environ.get("ALLOWED_GROUP_EMAIL", "").strip()
SERVICE_ACCOUNT_SECRET_ARN = os.environ.get("SERVICE_ACCOUNT_SECRET_ARN", "")

SCOPES = ["https://www.googleapis.com/auth/admin.directory.group.member.readonly"]
DIRECTORY_API = "https://admin.googleapis.com/admin/directory/v1"

# Fields the secret must contain. A real key from Google has the first three;
# admin_email is added by hand.
REQUIRED_FIELDS = ("client_email", "private_key", "token_uri", "admin_email")

# Re-read the secret at most this often, so a corrected secret takes effect on
# its own without restarting the function.
SECRET_TTL_SECONDS = 300

# Per HTTP call. Two calls (token + membership) must fit well inside 5 seconds.
HTTP_TIMEOUT_SECONDS = 2

_secrets_client = None

# Only a complete, validated secret is ever cached. The credentials object also
# holds Google's access token, so warm invocations skip the token request.
_cache = {"info": None, "credentials": None, "loaded_at": 0.0}


class _Response(google.auth.transport.Response):
    def __init__(self, status, headers, data):
        self._status = status
        self._headers = headers
        self._data = data

    @property
    def status(self):
        return self._status

    @property
    def headers(self):
        return self._headers

    @property
    def data(self):
        return self._data


class _UrllibRequest(google.auth.transport.Request):
    """Minimal HTTP transport for google-auth using only the standard library."""

    def __call__(self, url, method="GET", body=None, headers=None, timeout=None, **kwargs):
        req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
        try:
            with urllib.request.urlopen(req, timeout=timeout or HTTP_TIMEOUT_SECONDS) as resp:
                return _Response(resp.status, dict(resp.headers), resp.read())
        except urllib.error.HTTPError as exc:
            return _Response(exc.code, dict(exc.headers or {}), exc.read())
        except (urllib.error.URLError, OSError) as exc:
            raise google.auth.exceptions.TransportError(exc) from exc


_REQUEST = _UrllibRequest()


def _reset_cache():
    _cache.update(info=None, credentials=None, loaded_at=0.0)


def _read_secret():
    global _secrets_client
    if _secrets_client is None:
        _secrets_client = boto3.client("secretsmanager")
    try:
        response = _secrets_client.get_secret_value(SecretId=SERVICE_ACCOUNT_SECRET_ARN)
    except ClientError as exc:
        raise RuntimeError(f"could not read the service-account secret: {exc}") from exc

    try:
        info = json.loads(response["SecretString"])
    except (KeyError, ValueError) as exc:
        raise ValueError("the service-account secret is not valid JSON") from exc

    problems = [
        field
        for field in REQUIRED_FIELDS
        if not info.get(field) or "REPLACE_ME" in str(info.get(field))
    ]
    if problems:
        raise ValueError(
            "the service-account secret is incomplete; missing or placeholder fields: "
            + ", ".join(problems)
        )
    return info


def _get_credentials():
    now = time.monotonic()
    if _cache["credentials"] is not None and now - _cache["loaded_at"] < SECRET_TTL_SECONDS:
        return _cache["credentials"]

    info = _read_secret()  # raises on a bad secret; nothing is cached in that case
    if info != _cache["info"] or _cache["credentials"] is None:
        _cache["credentials"] = service_account.Credentials.from_service_account_info(
            info, scopes=SCOPES
        ).with_subject(info["admin_email"])
        _cache["info"] = info
    _cache["loaded_at"] = now
    return _cache["credentials"]


def _is_group_member(user_email, group_email):
    credentials = _get_credentials()
    if not credentials.valid:
        credentials.refresh(_REQUEST)  # RefreshError explains delegation problems

    url = "{}/groups/{}/hasMember/{}".format(
        DIRECTORY_API,
        urllib.parse.quote(group_email, safe=""),
        urllib.parse.quote(user_email, safe=""),
    )
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {credentials.token}"})
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT_SECONDS) as resp:
            return bool(json.loads(resp.read()).get("isMember", False))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:500]
        raise RuntimeError(f"Directory API returned {exc.code}: {detail}") from exc


def handler(event, context):
    """
    Cognito pre-token-generation trigger.

    Docs:
    https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-token-generation.html
    """
    user_email = (event.get("request", {}).get("userAttributes", {}).get("email") or "").strip()
    logger.info("Pre-token-generation trigger for: %s", user_email)

    # ── Dev / pass-through mode ───────────────────────────────────────────────
    if not ALLOWED_GROUP_EMAIL:
        logger.info("ALLOWED_GROUP_EMAIL not set — pass-through mode.")
        return event

    # ── Prod / group-check mode ───────────────────────────────────────────────
    if not user_email:
        raise Exception("Access denied: user email missing from token attributes.")

    logger.info("Checking membership of %s in group %s", user_email, ALLOWED_GROUP_EMAIL)
    try:
        is_member = _is_group_member(user_email, ALLOWED_GROUP_EMAIL)
    except Exception as exc:
        # Forget the cached secret/credentials so the next sign-in re-reads them.
        _reset_cache()
        logger.error("Group membership check failed: %s", exc)
        raise Exception(
            f"Access denied: unable to verify group membership for {user_email}."
        ) from exc

    if not is_member:
        logger.warning("Access denied: %s is not a member of %s", user_email, ALLOWED_GROUP_EMAIL)
        raise Exception(f"Access denied: {user_email} is not a member of the required group.")

    logger.info("Access granted: %s", user_email)
    return event
