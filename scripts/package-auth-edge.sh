#!/usr/bin/env bash
#
# package-auth-edge.sh
#
# Bakes Cognito config into the auth edge source, zips it, and uploads to the 
# deployment bucket under a content-hashed key so each config/code change produces 
# a new Lambda version.
#
# Required env vars:
#   USER_POOL_ID        Cognito User Pool ID            (from SSM)
#   APP_CLIENT_ID       Cognito App Client ID           (from SSM)
#   COGNITO_DOMAIN      Cognito Hosted UI base URL       (from SSM, no trailing slash)
#   CALLBACK_URL        This branch's https://<cf>/callback
#   AWS_REGION          Region of the Cognito pool (us-east-1)
#   DEPLOYMENT_BUCKET   S3 bucket for the ZIP
#   ENVIRONMENT         Branch/environment slug
#   TEMPLATE_BUCKET     S3 bucket holding the nested CloudFormation templates
#
# Echoes:
#   AUTH_EDGE_S3_KEY=<key>      S3 key of the uploaded Lambda ZIP
#   AUTH_EDGE_VERSION_HASH=<h>  Hash used in the Version resource logical ID

set -euo pipefail

: "${USER_POOL_ID:?}"
: "${APP_CLIENT_ID:?}"
: "${COGNITO_DOMAIN:?}"
: "${CALLBACK_URL:?}"
: "${AWS_REGION:?}"
: "${DEPLOYMENT_BUCKET:?}"
: "${ENVIRONMENT:?}"
: "${TEMPLATE_BUCKET:?}"

SRC_DIR="src/lambda/auth-edge"
BUILD_DIR="$(mktemp -d)"
cp "$SRC_DIR/index.js" "$BUILD_DIR/index.js"

# Substitute the @@TOKEN@@ placeholders with real values.
# Use | as the sed delimiter since values contain / and :
sed -i.bak \
  -e "s|@@USER_POOL_ID@@|${USER_POOL_ID}|g" \
  -e "s|@@APP_CLIENT_ID@@|${APP_CLIENT_ID}|g" \
  -e "s|@@COGNITO_DOMAIN@@|${COGNITO_DOMAIN}|g" \
  -e "s|@@CALLBACK_URL@@|${CALLBACK_URL}|g" \
  -e "s|@@AWS_REGION@@|${AWS_REGION}|g" \
  "$BUILD_DIR/index.js"
rm -f "$BUILD_DIR/index.js.bak"

# Fail loudly if any placeholder survived substitution.
if grep -q '@@' "$BUILD_DIR/index.js"; then
  echo "ERROR: unsubstituted placeholder remains in packaged index.js" >&2
  grep '@@' "$BUILD_DIR/index.js" >&2
  exit 1
fi

# Content hash drives the S3 key so a changed function => new object => new version.
# Use hex-only (alnum) chars so it is valid inside a CloudFormation logical ID.
HASH="$(shasum -a 256 "$BUILD_DIR/index.js" | cut -c1-12)"
ZIP_PATH="$BUILD_DIR/auth-edge.zip"
( cd "$BUILD_DIR" && zip -q "auth-edge.zip" index.js )

S3_KEY="${ENVIRONMENT}/lambda/auth-edge/index-${HASH}.zip"
aws s3 cp "$ZIP_PATH" "s3://${DEPLOYMENT_BUCKET}/${S3_KEY}"

# Render auth-edge.yaml with the hash baked into the Version resource's logical ID.
# A new hash => new logical ID => CloudFormation CREATES a new version and leaves
# the old one in place (Retain), avoiding the replicated-function delete error.
# Upload the rendered template directly to the template bucket so the auth-edge
# nested stack deploy picks it up (overwrites the placeholder synced earlier).
RENDERED_TEMPLATE="$BUILD_DIR/auth-edge.yaml"
sed "s|@@VERSION_HASH@@|${HASH}|g" \
  infrastructure/cloudformation/templates/auth-edge.yaml > "$RENDERED_TEMPLATE"

if grep -q '@@VERSION_HASH@@' "$RENDERED_TEMPLATE"; then
  echo "ERROR: @@VERSION_HASH@@ was not substituted in auth-edge.yaml" >&2
  exit 1
fi

aws s3 cp "$RENDERED_TEMPLATE" "s3://${TEMPLATE_BUCKET}/templates/auth-edge.yaml"

echo "AUTH_EDGE_S3_KEY=${S3_KEY}"
echo "AUTH_EDGE_VERSION_HASH=${HASH}"
