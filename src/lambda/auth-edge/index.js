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

// CONFIG - replaced by sed during CI packaging (do not edit the tokens) 
const USER_POOL_ID = '@@USER_POOL_ID@@';
const APP_CLIENT_ID = '@@APP_CLIENT_ID@@';
const COGNITO_DOMAIN = '@@COGNITO_DOMAIN@@'; // e.g. https://pool.auth.us-east-1.amazoncognito.com
const AWS_REGION = '@@AWS_REGION@@';

const JWKS_URL = `https://cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`;
const COOKIE_NAME = 'CognitoToken';

// JWKS cached in module scope so it survives warm invocations.
let cachedJwks = null;

exports.handler = async (event) => {
  const request = event.Records[0].cf.request;
  const uri = request.uri;
  const cookies = parseCookies(request.headers);

  // Derive the callback URL from the host the viewer actually hit. In a
  // viewer-request trigger, request.headers.host carries the distribution
  // (or custom) domain, so one shared function works for every environment.
  const origin = deriveOrigin(request);
  const callbackUrl = `${origin}/callback`;

  // callback
  //
  // Every failure here ends on an error page, never a redirect back to the
  // login page: the user is still signed in to Cognito, so a redirect would
  // bounce straight back here and loop forever.
  if (uri === '/callback') {
    const params = parseQueryString(request.querystring || '');

    // Cognito reports sign-in failures by redirecting here with ?error=...
    if (params.error) {
      console.error('Sign-in returned an error:', safeDecode(params.error),
        safeDecode(params.error_description || ''));
      return signInErrorPage(origin);
    }

    const code = params.code;
    if (!code) {
      // Not a real sign-in response: start a normal login.
      return redirectToCognito(callbackUrl, '/');
    }
    const state = params.state ? safeDecode(params.state) : '/';

    let tokens;
    try {
      tokens = await exchangeCodeForTokens(code, callbackUrl);
    } catch (err) {
      // Most often the group check refused the user, or the group check failed.
      console.error('Token exchange failed:', err && err.message ? err.message : err);
      return signInErrorPage(origin);
    }

    // Check the new token before handing it out. If it would not pass the check
    // on the next request, setting it would start a login loop.
    if (!tokens || !tokens.id_token || !(await validateJwt(tokens.id_token))) {
      console.error('Token exchange returned a token that failed validation.');
      return signInErrorPage(origin);
    }

    return redirectResponse(safeRedirectPath(state), [
      `${COOKIE_NAME}=${tokens.id_token}; HttpOnly; Secure; SameSite=Lax; Path=/`,
    ]);
  }

  // non-login path
  const token = cookies[COOKIE_NAME];

  if (!token) {
    return redirectToCognito(callbackUrl, uri);
  }

  const valid = await validateJwt(token);
  if (!valid) {
    return redirectToCognito(callbackUrl, uri, [clearCookieHeader()]);
  }

  // Authenticated — let the request continue to the origin unchanged.
  return request;
};

/**
 * Build https://<host> from the viewer Host header.
 */
function deriveOrigin(request) {
  const hostHeader =
    request.headers && request.headers.host && request.headers.host[0]
      ? request.headers.host[0].value
      : '';
  return `https://${hostHeader}`;
}

/** decodeURIComponent that never throws on malformed input. */
function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch (err) {
    return '';
  }
}

/**
 * Only allow redirects back to a path on this site (e.g. "/team"). Anything
 * else (an absolute URL, "//other-site", a backslash trick) becomes "/", so the
 * state parameter can't be used to send a signed-in user to another website.
 */
function safeRedirectPath(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    return '/';
  }
  return path;
}

/** Escape text for safe use inside HTML. */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Page shown when sign-in can't be completed. The sign-out link ends the
 * Cognito session so the user can try a different Google account.
 *
 * Status 401 (not 403) on purpose: this distribution maps 403 responses to the
 * app's index.html, which would hide this page.
 */
function signInErrorPage(origin) {
  const logoutUrl =
    `${COGNITO_DOMAIN}/logout` +
    `?client_id=${encodeURIComponent(APP_CLIENT_ID)}` +
    `&logout_uri=${encodeURIComponent(`${origin}/`)}`;

  const body = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign-in failed</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; margin: 0; padding: 4rem 1.5rem; color: #1f2937; }
  main { max-width: 32rem; margin: 0 auto; }
  h1 { font-size: 1.5rem; margin: 0 0 1rem; }
  p { line-height: 1.5; }
  a { color: #1d4ed8; }
</style>
</head>
<body>
<main>
  <h1>You couldn't be signed in</h1>
  <p>Your account may not have access to this site, or sign-in couldn't be completed.
     If you think you should have access, contact the site administrator.</p>
  <p><a href="${escapeHtml(logoutUrl)}">Sign out and try a different account</a></p>
</main>
</body>
</html>`;

  return {
    status: '401',
    statusDescription: 'Unauthorized',
    headers: {
      'content-type': [{ key: 'Content-Type', value: 'text/html; charset=utf-8' }],
      'cache-control': [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      'set-cookie': [{ key: 'Set-Cookie', value: clearCookieHeader() }],
    },
    body,
  };
}

//  Helper Function

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

/** Parse a query string "a=1&b=2" into a { a: "1", b: "2" } . */
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
 * Validate the JWT: signature against the matching JWKS key,
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
async function exchangeCodeForTokens(code, callbackUrl) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: APP_CLIENT_ID,
    code: code,
    redirect_uri: callbackUrl,
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
function redirectToCognito(callbackUrl, originalUri, extraCookies = []) {
  const authorizeUrl =
    `${COGNITO_DOMAIN}/oauth2/authorize` +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(APP_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
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
