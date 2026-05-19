import React, { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { confirmCognitoSignUp } from '../cognito/cognitoClient';
import { isGoogleHostedUiConfigured, redirectToGoogleSignIn } from '../cognito/cognitoHostedUi';
import './Auth.css';

export const Register: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [confirmPasswordSaved, setConfirmPasswordSaved] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const { register, login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      await register(email, password, username || undefined);
      navigate('/');
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === 'CONFIRMATION_REQUIRED') {
        setConfirmEmail(email.trim());
        setConfirmPasswordSaved(password);
        setAwaitingConfirm(true);
        setConfirmCode('');
        setError('');
      } else {
        setError(e.message || 'Registration failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!confirmCode.trim()) {
      setError('Enter the verification code');
      return;
    }
    setIsLoading(true);
    try {
      await confirmCognitoSignUp(confirmEmail, confirmCode);
      await login(confirmEmail, confirmPasswordSaved);
      navigate('/');
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (awaitingConfirm) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1>Verify email</h1>
          <p style={{ color: '#555', fontSize: 14, lineHeight: 1.5 }}>
            Enter the code sent to <strong>{confirmEmail}</strong> (check spam). After verification you will be signed in.
          </p>
          <form onSubmit={handleConfirm} className="auth-form">
            <div className="form-group">
              <label htmlFor="confirm-code">Verification code</label>
              <input
                id="confirm-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={confirmCode}
                onChange={(ev) => setConfirmCode(ev.target.value)}
                placeholder="6-digit code"
                required
                disabled={isLoading}
              />
            </div>
            {error && <div className="error-message">{error}</div>}
            <button type="submit" className="submit-btn" disabled={isLoading}>
              {isLoading ? 'Verifying…' : 'Verify and continue'}
            </button>
          </form>
          <div className="auth-link">
            <button
              type="button"
              className="submit-btn"
              style={{ background: '#64748b', marginTop: 8 }}
              onClick={() => {
                setAwaitingConfirm(false);
                setConfirmCode('');
                setError('');
              }}
            >
              Back to registration
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Register</h1>
        {isGoogleHostedUiConfigured() && (
          <>
            <button
              type="button"
              className="google-signin-btn"
              disabled={isLoading || googleLoading}
              onClick={async () => {
                setError('');
                setGoogleLoading(true);
                try {
                  await redirectToGoogleSignIn();
                } catch (e) {
                  setGoogleLoading(false);
                  setError(e instanceof Error ? e.message : 'Could not start Google sign-in');
                }
              }}
            >
              {googleLoading ? 'Redirecting…' : 'Continue with Google'}
            </button>
            <div className="auth-or-divider">
              <span>Or register with email</span>
            </div>
          </>
        )}
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="username">Display name (optional)</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Shown on your profile and forum"
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Set password (at least 6 characters)"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Enter password again"
              required
              disabled={isLoading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className="submit-btn"
            disabled={isLoading}
          >
            {isLoading ? 'Registering...' : 'Register'}
          </button>
        </form>

        <div className="auth-link">
          <p>Already have an account? <Link to="/login">Login</Link></p>
        </div>
      </div>
    </div>
  );
};
