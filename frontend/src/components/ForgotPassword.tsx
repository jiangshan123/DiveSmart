import React, { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  isCognitoAuthEnabled,
  forgotPasswordCognito,
  confirmForgotPasswordCognito,
} from '../cognito/cognitoClient';
import './Auth.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'email' | 'code'>('email');
  const navigate = useNavigate();
  const cognito = isCognitoAuthEnabled();

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setIsLoading(true);
    try {
      if (cognito) {
        await forgotPasswordCognito(email);
        setInfo(
          'If this email is registered, you will receive a verification code. Enter it below with a new password.',
        );
        setStep('code');
      } else {
        const res = await axios.post(`${API_BASE_URL}/api/auth/forgot-password`, { email });
        if (res.data.success) {
          setInfo(
            res.data.data?.message ||
              'If an account exists for that email, you will receive password reset instructions shortly.',
          );
        } else {
          throw new Error(res.data.error || 'Request failed');
        }
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.error || err.message;
        setError(typeof msg === 'string' ? msg : 'Request failed');
      } else {
        const e = err as { message?: string };
        setError(e.message || 'Request failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!cognito) return;
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setIsLoading(true);
    try {
      await confirmForgotPasswordCognito(email, code, newPassword);
      setInfo('Your password has been updated. You can sign in now.');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Could not reset password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Forgot password</h1>
        {cognito && step === 'email' && (
          <p style={{ fontSize: 13, color: '#64748b', marginTop: -8, marginBottom: 16 }}>
            We will email you a verification code if this address is registered.
          </p>
        )}

        {info && <div className="info-message">{info}</div>}
        {error && <div className="error-message">{error}</div>}

        {!cognito || step === 'email' ? (
          <form onSubmit={handleEmailSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="fp-email">Email</label>
              <input
                id="fp-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={isLoading}
              />
            </div>
            <button type="submit" className="submit-btn" disabled={isLoading}>
              {isLoading ? 'Sending…' : 'Send reset instructions'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleConfirmSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="fp-code">Verification code</label>
              <input
                id="fp-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="one-time-code"
              />
            </div>
            <div className="form-group">
              <label htmlFor="fp-np">New password</label>
              <input
                id="fp-np"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                disabled={isLoading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="fp-cp">Confirm password</label>
              <input
                id="fp-cp"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                disabled={isLoading}
              />
            </div>
            <button type="submit" className="submit-btn" disabled={isLoading}>
              {isLoading ? 'Updating…' : 'Set new password'}
            </button>
          </form>
        )}

        <div className="auth-link">
          <p>
            <Link to="/login">Back to login</Link>
          </p>
        </div>
      </div>
    </div>
  );
};
