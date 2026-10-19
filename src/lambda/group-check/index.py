"""
Cognito pre-token-generation trigger — Google Group membership check.

Behaviour
---------
ALLOWED_GROUP_EMAIL is empty (dev):
    Pass through — any @vegafederal.com user that Cognito accepted is allowed.

ALLOWED_GROUP_EMAIL is set (prod):
    Call the Google Workspace Directory API using a service account to verify
    the authenticating user is a member of the configured group.
    On failure → raise an exception so Cognito blocks token issuance.

Environment variables
---------------------
ALLOWED_GROUP_EMAIL
    Google Group email to check (e.g. admin-team@vegafederal.com).
    Empty = pass-through (dev).

SERVICE_ACCOUNT_SECRET_ARN
    ARN of the Secrets Manager secret containing the Google service-account JSON.
    The JSON must include an extra field "admin_email" — a Workspace admin account
    used for domain-wide delegation impersonation.

Dependencies (installed into the ZIP by CI via requirements.txt)
----------------------------------------------------------------
google-auth==2.38.0
google-api-python-client==2.165.0
"""

import json
import logging
import os

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

ALLOWED_GROUP_EMAIL = os.environ.get("ALLOWED_GROUP_EMAIL", "").strip()
SERVICE_ACCOUNT_SECRET_ARN = os.environ.get("SERVICE_ACCOUNT_SECRET_ARN", "")

# Module-level cache — survives warm Lambda invocations
_cached_service_account_info = None


def _get_service_account_info() -> dict:
    """Retrieve and cache the Google service-account JSON from Secrets Manager."""
    global _cached_service_account_info
    if _cached_service_account_info is not None:
        return _cached_service_account_info

    sm = boto3.client("secretsmanager")
    try:
        response = sm.get_secret_value(SecretId=SERVICE_ACCOUNT_SECRET_ARN)
    except ClientError as exc:
        logger.error("Failed to retrieve service-account secret: %s", exc)
        raise

    _cached_service_account_info = json.loads(response["SecretString"])
    return _cached_service_account_info


def _is_group_member(user_email: str, group_email: str) -> bool:
    """
    Return True if user_email is a direct or transitive member of group_email
    using the Google Workspace Directory API.
    """
    try:
        from google.oauth2 import service_account  # type: ignore
        from googleapiclient.discovery import build  # type: ignore
    except ImportError as exc:
        logger.error(
            "google-auth / google-api-python-client not available. "
            "Ensure requirements.txt dependencies are bundled. Error: %s",
            exc,
        )
        raise

    service_account_info = _get_service_account_info()

    # The service account must have domain-wide delegation granted in the
    # Google Workspace Admin console for this scope.
    scopes = ["https://www.googleapis.com/auth/admin.directory.group.member.readonly"]

    # admin_email is added manually to the service-account JSON in Secrets Manager
    # after downloading the key from GCP — it is NOT part of the downloaded JSON.
    admin_email = service_account_info.get("admin_email")
    if not admin_email:
        raise ValueError(
            "Service-account JSON is missing 'admin_email'. "
            "Add the Workspace admin email to the secret value after initial deploy."
        )

    credentials = service_account.Credentials.from_service_account_info(
        service_account_info, scopes=scopes
    ).with_subject(admin_email)

    service = build(
        "admin", "directory_v1", credentials=credentials, cache_discovery=False
    )

    try:
        result = (
            service.members()
            .hasMember(groupKey=group_email, memberKey=user_email)
            .execute()
        )
        return result.get("isMember", False)
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Directory API error checking %s in %s: %s",
            user_email,
            group_email,
            exc,
        )
        raise


def handler(event: dict, context) -> dict:
    """
    Cognito pre-token-generation trigger.

    Docs:
    https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-token-generation.html
    """
    user_attributes = event.get("request", {}).get("userAttributes", {})
    user_email = user_attributes.get("email", "")

    logger.info("Pre-token-generation trigger for: %s", user_email)

    # ── Dev / pass-through mode ───────────────────────────────────────────────
    if not ALLOWED_GROUP_EMAIL:
        logger.info("ALLOWED_GROUP_EMAIL not set — pass-through mode.")
        return event

    # ── Prod / group-check mode ───────────────────────────────────────────────
    if not user_email:
        raise Exception("Access denied: user email missing from token attributes.")

    logger.info(
        "Checking membership of %s in group %s", user_email, ALLOWED_GROUP_EMAIL
    )

    try:
        is_member = _is_group_member(user_email, ALLOWED_GROUP_EMAIL)
    except Exception as exc:
        # Fail closed — any error blocks the token
        logger.error("Group membership check failed: %s", exc)
        raise Exception(
            f"Access denied: unable to verify group membership for {user_email}."
        ) from exc

    if not is_member:
        logger.warning(
            "Access denied: %s is not a member of %s", user_email, ALLOWED_GROUP_EMAIL
        )
        raise Exception(
            f"Access denied: {user_email} is not a member of the required group."
        )

    logger.info("Access granted: %s", user_email)
    return event
