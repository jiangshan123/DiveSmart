import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID as string | undefined,
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID as string | undefined,
};

export function isCognitoAuthEnabled(): boolean {
  return !!(poolData.UserPoolId && poolData.ClientId);
}

/**
 * Cognito username must match how the user was registered. We default to trim + lowercase
 * so login matches typical email sign-up (avoids "correct password" failures from case).
 * Set VITE_COGNITO_PRESERVE_EMAIL_CASE=true if your pool uses case-sensitive usernames.
 */
function cognitoUsernameFromEmail(email: string): string {
  const t = email.trim();
  if (import.meta.env.VITE_COGNITO_PRESERVE_EMAIL_CASE === 'true') {
    return t;
  }
  return t.toLowerCase();
}

function getUserPool(): CognitoUserPool {
  if (!poolData.UserPoolId || !poolData.ClientId) {
    throw new Error('Cognito is not configured (missing VITE_COGNITO_* env)');
  }
  return new CognitoUserPool({
    UserPoolId: poolData.UserPoolId,
    ClientId: poolData.ClientId,
  });
}

const mfaReject = (reject: (reason?: unknown) => void) => {
  const e = new Error('MFA_REQUIRED');
  (e as Error & { code?: string }).code = 'MFA_REQUIRED';
  reject(e);
};

function isNotAuthorizedLike(err: unknown): boolean {
  const e = err as { code?: string };
  return e.code === 'NotAuthorizedException' || e.code === 'UserNotFoundException';
}

/** When USER_PASSWORD_AUTH is not enabled on the app client, try SRP once. */
function shouldRetrySignInWithSrp(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  const msg = (e.message || '').toLowerCase();
  if (e.code === 'InvalidParameterException') return true;
  if (msg.includes('user_password_auth') && (msg.includes('not enabled') || msg.includes('disabled'))) {
    return true;
  }
  if (msg.includes('initiate auth') && msg.includes('not supported')) return true;
  if (msg.includes('auth flow') && (msg.includes('not enabled') || msg.includes('disabled'))) return true;
  return false;
}

function signInWithAuthFlow(
  username: string,
  password: string,
  flow: 'USER_PASSWORD_AUTH' | 'USER_SRP_AUTH',
): Promise<string> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({
      Username: username,
      Pool: getUserPool(),
    });
    user.setAuthenticationFlowType(flow);
    const authDetails = new AuthenticationDetails({
      Username: username,
      Password: password,
    });
    user.authenticateUser(authDetails, {
      onSuccess: (session) => {
        resolve(session.getIdToken().getJwtToken());
      },
      onFailure: (err) => {
        reject(err);
      },
      newPasswordRequired: () => {
        const e = new Error('NEW_PASSWORD_REQUIRED');
        (e as Error & { code?: string }).code = 'NEW_PASSWORD_REQUIRED';
        reject(e);
      },
      mfaRequired: () => mfaReject(reject),
      totpRequired: () => mfaReject(reject),
      selectMFAType: () => mfaReject(reject),
      mfaSetup: () => mfaReject(reject),
      customChallenge: () => {
        const e = new Error('CUSTOM_AUTH_NOT_SUPPORTED');
        (e as Error & { code?: string }).code = 'CUSTOM_AUTH_NOT_SUPPORTED';
        reject(e);
      },
    });
  });
}

async function signInSingleUsername(username: string, password: string): Promise<string> {
  const forced = import.meta.env.VITE_COGNITO_AUTH_FLOW as string | undefined;
  if (forced === 'USER_SRP_AUTH') {
    return signInWithAuthFlow(username, password, 'USER_SRP_AUTH');
  }
  if (forced === 'USER_PASSWORD_AUTH') {
    return signInWithAuthFlow(username, password, 'USER_PASSWORD_AUTH');
  }
  // Default: try USER_PASSWORD_AUTH first (many pools only enable this for SPAs), then SRP.
  try {
    return await signInWithAuthFlow(username, password, 'USER_PASSWORD_AUTH');
  } catch (err) {
    if (shouldRetrySignInWithSrp(err)) {
      return signInWithAuthFlow(username, password, 'USER_SRP_AUTH');
    }
    throw err;
  }
}

/**
 * Sign in with Cognito. Tries USER_PASSWORD_AUTH then SRP when needed, and retries with
 * original email casing when it differs from lowercase (fixes some case-sensitive pools).
 * Force one flow with VITE_COGNITO_AUTH_FLOW=USER_PASSWORD_AUTH or USER_SRP_AUTH.
 */
export async function signInCognito(email: string, password: string): Promise<string> {
  const rawTrimmed = email.trim();
  const normalized = cognitoUsernameFromEmail(email);
  const usernames =
    import.meta.env.VITE_COGNITO_PRESERVE_EMAIL_CASE === 'true'
      ? [normalized]
      : normalized !== rawTrimmed
        ? [normalized, rawTrimmed]
        : [normalized];

  let lastErr: unknown;
  for (const u of usernames) {
    try {
      return await signInSingleUsername(u, password);
    } catch (err) {
      lastErr = err;
      if (isNotAuthorizedLike(err) && usernames.length > 1 && u === usernames[0]) {
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export function signUpCognito(
  email: string,
  password: string,
  displayName?: string,
): Promise<{ userConfirmed: boolean }> {
  const username = cognitoUsernameFromEmail(email);
  const attrs: CognitoUserAttribute[] = [
    new CognitoUserAttribute({ Name: 'email', Value: username }),
  ];
  if (displayName?.trim()) {
    attrs.push(
      new CognitoUserAttribute({ Name: 'name', Value: displayName.trim().slice(0, 120) }),
    );
  }
  return new Promise((resolve, reject) => {
    getUserPool().signUp(username, password, attrs, [], (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({
        userConfirmed: result?.userConfirmed ?? false,
      });
    });
  });
}

export function confirmCognitoSignUp(email: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({
      Username: cognitoUsernameFromEmail(email),
      Pool: getUserPool(),
    });
    user.confirmRegistration(code.trim(), true, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function signOutCognito(): void {
  if (!isCognitoAuthEnabled()) return;
  const user = getUserPool().getCurrentUser();
  if (user) {
    user.signOut();
  }
}

export function forgotPasswordCognito(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({
      Username: cognitoUsernameFromEmail(email),
      Pool: getUserPool(),
    });
    user.forgotPassword({
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    });
  });
}

export function confirmForgotPasswordCognito(
  email: string,
  verificationCode: string,
  newPassword: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({
      Username: cognitoUsernameFromEmail(email),
      Pool: getUserPool(),
    });
    user.confirmPassword(verificationCode.trim(), newPassword, {
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    });
  });
}

/** Maps Cognito / SDK errors to clearer UI text (SDK often returns "Incorrect username or password."). */
export function getCognitoAppErrorMessage(err: unknown): string {
  const e = err as { code?: string; message?: string; name?: string };
  const code = e.code || e.name;
  switch (code) {
    case 'NEW_PASSWORD_REQUIRED':
      return 'Your account still has a temporary password. Use "Forgot password" to set a new password, or complete the administrator invite flow.';
    case 'MFA_REQUIRED':
      return 'This account has MFA enabled; this app does not support MFA sign-in yet.';
    case 'CUSTOM_AUTH_NOT_SUPPORTED':
      return 'This user pool uses custom authentication, which this app does not support.';
    case 'UserNotConfirmedException':
      return 'Please confirm your email with the verification code before signing in.';
    case 'PasswordResetRequiredException':
      return 'You must reset your password before signing in. Use "Forgot password".';
    case 'NotAuthorizedException':
    case 'UserNotFoundException':
      return 'Sign-in failed: Cognito still rejected this email/password. The app now tries USER_PASSWORD_AUTH then SRP, and both lowercase and original email casing. Confirm in AWS that the user exists, email is verified, and the password is for this same User Pool / App client. Try "Forgot password", or set VITE_COGNITO_AUTH_FLOW=USER_SRP_AUTH if only SRP is enabled.';
    default:
      if (typeof e.message === 'string' && e.message.length > 0) {
        return e.message;
      }
      return 'Sign-in failed';
  }
}
