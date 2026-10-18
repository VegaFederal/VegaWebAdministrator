'use strict';

/**
 * Lambda@Edge — CloudFront viewer-request auth guard.
 *
 * CONFIG values are substituted at deploy time by the CI packaging step
 * (scripts/package-auth-edge.sh) because Lambda@Edge has no runtime env vars.
 *
 * Flow
 * ────
 * /callback  → exchange the Cognito auth code for tokens, set an HttpOnly cookie,
 *              then redirect to the original URI encoded in `state`.
 * all others → read the CognitoToken cookie, validate the JWT against the Cognito
 *              JWKS. Valid → forward to origin. Missing/invalid → 302 to the
 *              Cognito Hosted UI (Google login) with the original URI in `state`.
 */

// ── CONFIG — replaced by sed during CI packaging (do not edit the tokens) ──
const USER_POOL_ID = '@@USER_POOL_ID@@';
const APP_CLIENT_ID = '@@APP_CLIENT_ID@@';
const COGNITO_DOMAIN = '@@COGNITO_DOMAIN@@'; // e.g. https://pool.auth.us-east-1.amazoncognito.com
const CALLBACK_URL = '@@CALLBACK_URL@@';     // e.g. https://xxxx.cloudfront.net/callback
const AWS_REGION = '@@AWS_REGION@@';

const JWKS_URL = `https://cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`;
const COOKIE_NAME = 'CognitoToken';

// JWKS cached in module scope so it survives warm invocations.
let cachedJwks = null;

exports.handler = async (event) => {
  const request = event.Records[0].cf.request;
  const uri = request.uri;
  const cookies = parseCookies(request.headers);

  // ── /callback ────────────────────────────────────────────────────────────
  if (uri === '/callback') {
    const params = parseQueryString(request.querystring || '');
    const code = params.code;
    const state = params.state ? decodeURIComponent(params.state) : '/';

    if (!code) {
      return redirectToCognito('/');
    }

    try {
      const tokens = await exchangeCodeForTokens(code);
      // Use the id_token as the session cookie (it carries email + aud we validate).
      return redirectResponse(state || '/', [
        `${COOKIE_NAME}=${tokens.id_token}; HttpOnly; Secure; SameSite=Lax; Path=/`,
      ]);
    } catch (err) {
      console.error('Token exchange failed:', err && err.message ? err.message : err);
      // Exchange failed — bounce back to login rather than exposing an error.
      return redirectToCognito('/');
    }
  }

  // ── all other paths ────────────────────────────────────────────────────────
  const token = cookies[COOKIE_NAME];

  if (!token) {
    return redirectToCognito(uri);
  }

  const valid = await validateJwt(token);
  if (!valid) {
    return redirectToCognito(uri, [clearCookieHeader()]);
  }

  // Authenticated — let the request continue to the origin unchanged.
  return request;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse the Cookie header(s) into a { name: value } map. */
function parseCookies(headers) {
  const out = {};
  const cookieHeaders = headers && headers.cookie;
  if (!cookieHeaders) return out;
  for (const header of cookieHeaders) {
    for (const pair of header.value.split(';')) {
      const idx = pair.indexOf('=');
      if (idx === -1) continue;
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      if (key) out[key] = val;
    }
  }
  return out;
}

/** Parse a query string "a=1&b=2" into a { a: "1", b: "2" } map (values stay encoded). */
function parseQueryString(qs) {
  const out = {};
  if (!qs) return out;
  for (const pair of qs.split('&')) {
    const idx = pair.indexOf('=');
    if (idx === -1) {
      out[decodeURIComponent(pair)] = '';
    } else {
      out[decodeURIComponent(pair.slice(0, idx))] = pair.slice(idx + 1);
    }
  }
  return out;
}

/** Fetch and cache the Cognito JWKS. */
async function getJwks() {
  if (!cachedJwks) {
    const res = await fetch(JWKS_URL);
    if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
    const body = await res.json();
    cachedJwks = body.keys || [];
  }
  return cachedJwks;
}

/**
 * Validate the JWT: RS256 signature against the matching JWKS key,
 * exp not passed, aud matches APP_CLIENT_ID, token_use is "id".
 * Returns true/false; never throws.
 */
async function validateJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const header = JSON.parse(base64UrlDecode(parts[0]).toString('utf8'));
    const payload = JSON.parse(base64UrlDecode(parts[1]).toString('utf8'));

    if (header.alg !== 'RS256') return false;

    // Expiry
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) return false;

    // Audience — id tokens carry aud = app client id
    if (payload.aud !== APP_CLIENT_ID) return false;

    // Token use
    if (payload.token_use && payload.token_use !== 'id') return false;

    // Issuer
    const expectedIss = `https://cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}`;
    if (payload.iss !== expectedIss) return false;

    // Signature
    const keys = await getJwks();
    const jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) return false;

    const crypto = require('crypto');
    const pubKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    verifier.end();
    const signature = base64UrlDecode(parts[2]);
    return verifier.verify(pubKey, signature);
  } catch (err) {
    console.error('JWT validation error:', err && err.message ? err.message : err);
    return false;
  }
}

/** POST the auth code to the Cognito token endpoint; returns the token JSON. */
async function exchangeCodeForTokens(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: APP_CLIENT_ID,
    code: code,
    redirect_uri: CALLBACK_URL,
  });

  const res = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token endpoint ${res.status}: ${text}`);
  }
  return res.json();
}

/** Build a 302 to the Cognito Hosted UI (Google), encoding the original URI in state. */
function redirectToCognito(originalUri, extraCookies = []) {
  const authorizeUrl =
    `${COGNITO_DOMAIN}/oauth2/authorize` +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(APP_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(CALLBACK_URL)}` +
    `&scope=${encodeURIComponent('openid email profile')}` +
    `&identity_provider=Google` +
    `&state=${encodeURIComponent(originalUri || '/')}`;
  return redirectResponse(authorizeUrl, extraCookies);
}

/** Build a CloudFront 302 response with an optional set of Set-Cookie headers. */
function redirectResponse(location, setCookies = []) {
  const headers = {
    location: [{ key: 'Location', value: location }],
    'cache-control': [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
  };
  if (setCookies.length) {
    headers['set-cookie'] = setCookies.map((v) => ({ key: 'Set-Cookie', value: v }));
  }
  return {
    status: '302',
    statusDescription: 'Found',
    headers,
  };
}

/** A Set-Cookie value that clears the session cookie. */
function clearCookieHeader() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/** Decode a base64url string to a Buffer. */
function base64UrlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64');
}
