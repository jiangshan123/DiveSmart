import React, { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { isGoogleHostedUiConfigured, redirectToGoogleSignIn } from '../cognito/cognitoHostedUi';
import './Auth.css';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Login</h1>
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
              {googleLoading ? 'Redirecting…' : 'Sign in with Google'}
            </button>
            <div className="auth-or-divider">
              <span>Or sign in with email</span>
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
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={isLoading}
            />
            <div style={{ textAlign: 'right', marginTop: 6 }}>
              <Link
                to="/forgot-password"
                style={{ fontSize: 13, color: '#667eea', fontWeight: 600, textDecoration: 'none' }}
              >
                Forgot password?
              </Link>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className="submit-btn"
            disabled={isLoading}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="auth-link">
          <p>Don't have an account? <Link to="/register">Register</Link></p>
        </div>
      </div>
    </div>
  );
};
