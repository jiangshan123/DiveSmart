/**
 * Cognito Hosted UI OAuth2 (PKCE) — direct "Sign in with Google" via federated IdP.
 *
 * AWS setup (summary):
 * 1. User pool → Sign-in experience → Add Google identity provider (Client ID + secret from Google Cloud).
 * 2. Google Cloud Console → OAuth client → Authorized redirect URI:
 *    https://<your-cognito-domain>/oauth2/idpresponse
 * 3. App client → Hosted UI: enable Google; callback URLs must include the SPA redirect (e.g. http://localhost:5173/auth/callback).
 * 4. User pool → Domain: create Cognito domain → use it as VITE_COGNITO_HOSTED_UI_DOMAIN (host only, no https://).
 *
 * Google account picker (`prompt=select_account`):
 * Amazon Cognito only honors OIDC `prompt` when the user pool domain uses Managed login branding.
 * Classic Hosted UI ignores `prompt`, so Google may sign in with the browser's current account with no chooser.
 * Fix: Cognito console → your user pool → Domain → set Branding version to "Managed login" (Essentials/Plus plans),
 * then assign managed-login branding. Lite plan only supports classic Hosted UI — upgrade to use `prompt`.
 * @see https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html (parameter: prompt)
 *
 * Default `prompt` is `select_account`. Set VITE_COGNITO_OAUTH_PROMPT=none to omit it (managed login only).
 * Optional: `select_account consent` for stricter re-consent (more Google screens).
 */

import { isCognitoAuthEnabled } from './cognitoClient';

const PKCE_VERIFIER_KEY = 'smartdive_cognito_pkce_verifier';
export const COGNITO_OAUTH_STATE_KEY = 'smartdive_cognito_oauth_state';

function getHostedUiHost(): string | null {
  const h = import.meta.env.VITE_COGNITO_HOSTED_UI_DOMAIN as string | undefined;
  if (!h || !String(h).trim()) return null;
  // Host only: no https://, no path, no spaces (common .env mistake)
  const host = String(h).trim().replace(/^https?:\/\//i, '').split('/')[0].replace(/\s+/g, '');
  return host || null;
}

export function isGoogleHostedUiConfigured(): boolean {
  return isCognitoAuthEnabled() && !!getHostedUiHost();
}

function getRedirectUri(): string {
  const explicit = import.meta.env.VITE_OAUTH_REDIRECT_URI as string | undefined;
  if (explicit && String(explicit).trim()) return String(explicit).trim();
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`;
  }
  return '/auth/callback';
}

function randomVerifier(): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = crypto.getRandomValues(new Uint8Array(64));
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += charset[bytes[i] % charset.length];
  }
  return out;
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hash);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * PKCE redirect to Google via identity_provider (or Cognito login first if VITE_COGNITO_HOSTED_UI_DIRECT_GOOGLE=false).
 * If the IdP name in Cognito is not "Google", set VITE_COGNITO_GOOGLE_IDP_NAME.
 */
export async function redirectToGoogleSignIn(): Promise<void> {
  const host = getHostedUiHost();
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID as string | undefined;
  if (!host || !clientId) {
    throw new Error('Hosted UI is not configured (VITE_COGNITO_HOSTED_UI_DOMAIN + VITE_COGNITO_CLIENT_ID).');
  }

  const redirectUri = getRedirectUri();
  const directGoogle =
    import.meta.env.VITE_COGNITO_HOSTED_UI_DIRECT_GOOGLE !== 'false';
  const idp = (import.meta.env.VITE_COGNITO_GOOGLE_IDP_NAME as string | undefined)?.trim() || 'Google';

  const verifier = randomVerifier();
  const challenge = await sha256Base64Url(verifier);
  const state = randomVerifier().slice(0, 32);

  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(COGNITO_OAUTH_STATE_KEY, state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid email profile',
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  });
  if (directGoogle) {
    params.set('identity_provider', idp);
  }

  // Forwarded to Google only under Cognito Managed login (ignored by classic Hosted UI).
  const promptEnv = import.meta.env.VITE_COGNITO_OAUTH_PROMPT as string | undefined;
  const prompt =
    promptEnv === undefined ? 'select_account' : String(promptEnv).trim();
  if (prompt && prompt.toLowerCase() !== 'none') {
    params.set('prompt', prompt);
  }

  window.location.assign(`https://${host}/oauth2/authorize?${params.toString()}`);
}

let tokenExchangeInFlight: { code: string; promise: Promise<string> } | null = null;

async function performTokenExchange(code: string): Promise<string> {
  const host = getHostedUiHost();
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID as string | undefined;
  if (!host || !clientId) {
    throw new Error('Cognito client is not configured.');
  }

  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  if (!verifier) {
    throw new Error('Missing PKCE verifier. Start sign-in again from the login page.');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: verifier,
  });

  const res = await fetch(`https://${host}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const raw = await res.text();
  if (!res.ok) {
    let detail = raw;
    try {
      const j = JSON.parse(raw) as { error?: string; error_description?: string };
      detail = j.error_description || j.error || raw;
    } catch {
      /* use raw */
    }
    throw new Error(detail || `Token exchange failed (${res.status})`);
  }

  const data = JSON.parse(raw) as { id_token?: string };
  if (!data.id_token) {
    throw new Error('No id_token in token response');
  }
  return data.id_token;
}

/**
 * Exchange authorization code for id_token (public client). Single-flight so React Strict Mode
 * does not consume the PKCE verifier / auth code twice.
 */
export function exchangeCodeForIdToken(code: string): Promise<string> {
  if (tokenExchangeInFlight?.code === code) {
    return tokenExchangeInFlight.promise;
  }
  const promise = performTokenExchange(code).finally(() => {
    tokenExchangeInFlight = null;
  });
  tokenExchangeInFlight = { code, promise };
  return promise;
}
