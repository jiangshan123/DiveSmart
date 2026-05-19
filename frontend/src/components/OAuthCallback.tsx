import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import {
  COGNITO_OAUTH_STATE_KEY,
  exchangeCodeForIdToken,
  isGoogleHostedUiConfigured,
} from '../cognito/cognitoHostedUi';
import './Auth.css';

/** Pairs already handled (React Strict Mode mounts twice with the same code+state). */
const handledOAuthPairs = new Set<string>();

export const OAuthCallback: React.FC = () => {
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { loginWithIdToken } = useAuth();

  useEffect(() => {
    if (!isGoogleHostedUiConfigured()) {
      setError('Google sign-in is not configured on this build.');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('error');
    if (oauthError) {
      setError(params.get('error_description') || oauthError);
      return;
    }

    const code = params.get('code');
    const state = params.get('state');
    if (!code) {
      setError('Missing authorization code.');
      return;
    }
    if (!state) {
      setError('Missing OAuth state.');
      return;
    }

    const pairKey = `${code}:${state}`;
    if (handledOAuthPairs.has(pairKey)) {
      return;
    }

    const expected = sessionStorage.getItem(COGNITO_OAUTH_STATE_KEY);
    if (!expected || expected !== state) {
      setError('Invalid or expired sign-in state. Please try again from the login page.');
      return;
    }

    handledOAuthPairs.add(pairKey);
    sessionStorage.removeItem(COGNITO_OAUTH_STATE_KEY);

    void (async () => {
      try {
        const idToken = await exchangeCodeForIdToken(code);
        await loginWithIdToken(idToken);
        navigate('/', { replace: true });
      } catch (e) {
        handledOAuthPairs.delete(pairKey);
        setError(e instanceof Error ? e.message : 'Sign-in failed');
      }
    })();
  }, [loginWithIdToken, navigate]);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Signing you in…</h1>
        {error ? (
          <>
            <div className="error-message">{error}</div>
            <p className="auth-link" style={{ marginTop: 16 }}>
              <Link to="/login">Back to login</Link>
            </p>
          </>
        ) : (
          <p style={{ color: '#64748b', fontSize: 14 }}>Completing Google sign-in…</p>
        )}
      </div>
    </div>
  );
};
