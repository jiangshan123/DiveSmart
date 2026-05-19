import React, { useState, type FormEvent, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import './Auth.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
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
      const res = await axios.post(`${API_BASE_URL}/api/auth/reset-password`, {
        token,
        password,
      });
      if (res.data.success) {
        setInfo(res.data.data?.message || 'Password updated.');
        setTimeout(() => navigate('/login'), 1500);
      } else {
        throw new Error(res.data.error || 'Reset failed');
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.error || err.message;
        setError(typeof msg === 'string' ? msg : 'Reset failed');
      } else {
        const e = err as { message?: string };
        setError(e.message || 'Reset failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1>Reset password</h1>
          <div className="error-message">
            This link is missing a reset token. Request a new link from the forgot password page.
          </div>
          <p className="auth-link" style={{ marginTop: 16 }}>
            <Link to="/forgot-password">Forgot password</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Choose a new password</h1>
        {info && <div className="info-message">{info}</div>}
        {error && <div className="error-message">{error}</div>}
        {!info && (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="rp-pw">New password</label>
              <input
                id="rp-pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={isLoading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="rp-cp">Confirm password</label>
              <input
                id="rp-cp"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                disabled={isLoading}
              />
            </div>
            <button type="submit" className="submit-btn" disabled={isLoading}>
              {isLoading ? 'Saving…' : 'Update password'}
            </button>
          </form>
        )}
        <div className="auth-link">
          <Link to="/login">Back to login</Link>
        </div>
      </div>
    </div>
  );
};
