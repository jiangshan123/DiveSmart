import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  isCognitoAuthEnabled,
  signInCognito,
  signUpCognito,
  signOutCognito,
  getCognitoAppErrorMessage,
} from '../cognito/cognitoClient';

interface User {
  id: string;
  email: string;
  username: string;
  avatarUrl?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Cognito ID token from Hosted UI / Google OAuth */
  loginWithIdToken: (idToken: string) => Promise<void>;
  register: (email: string, password: string, username?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

  const loadMe = async (t: string) => {
    const userResponse = await axios.get(`${API_BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${t}`,
      },
    });
    if (userResponse.data.success) {
      setUser(userResponse.data.data);
    }
  };

  const applySessionToken = async (accessToken: string) => {
    setToken(accessToken);
    localStorage.setItem('authToken', accessToken);
    await loadMe(accessToken);
  };

  const loginWithIdToken = useCallback(async (idToken: string) => {
    setToken(idToken);
    localStorage.setItem('authToken', idToken);
    try {
      const userResponse = await axios.get(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (userResponse.data.success) {
        setUser(userResponse.data.data);
      }
    } catch (e: unknown) {
      if (axios.isAxiosError(e)) {
        const body = e.response?.data as { error?: string } | undefined;
        const msg = body?.error || e.message;
        throw new Error(typeof msg === 'string' ? msg : 'Sign-in failed');
      }
      throw e;
    }
  }, [API_BASE_URL]);

  // Initialize: read token from local storage
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      setToken(storedToken);
      // Verify token
      verifyToken(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  // Verify token
  const verifyToken = async (token: string) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/verify`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setToken(token);
        await loadMe(token);
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      localStorage.removeItem('authToken');
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Login
  const login = async (email: string, password: string) => {
    try {
      if (isCognitoAuthEnabled()) {
        const idToken = await signInCognito(email, password);
        await applySessionToken(idToken);
        return;
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/auth/login`,
        { email, password }
      );

      if (response.data.success) {
        const { token, user } = response.data.data;
        setToken(token);
        setUser(user);
        localStorage.setItem('authToken', token);
      } else {
        throw new Error(response.data.error || 'Login failed');
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error || error.message || 'Login failed';
        throw new Error(typeof message === 'string' ? message : 'Login failed');
      }
      if (isCognitoAuthEnabled()) {
        throw new Error(getCognitoAppErrorMessage(error));
      }
      const err = error as { message?: string; code?: string };
      throw new Error(err.message || 'Login failed');
    }
  };

  // Register
  const register = async (email: string, password: string, username?: string) => {
    try {
      if (isCognitoAuthEnabled()) {
        const { userConfirmed } = await signUpCognito(email, password, username);
        if (!userConfirmed) {
          const e = new Error('CONFIRMATION_REQUIRED');
          (e as Error & { code?: string }).code = 'CONFIRMATION_REQUIRED';
          throw e;
        }
        const idToken = await signInCognito(email, password);
        await applySessionToken(idToken);
        return;
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/auth/register`,
        { email, password, username }
      );

      if (response.data.success) {
        const { token, user } = response.data.data;
        setToken(token);
        setUser(user);
        localStorage.setItem('authToken', token);
      } else {
        throw new Error(response.data.error || 'Registration failed');
      }
    } catch (error: unknown) {
      if (error instanceof Error && (error as Error & { code?: string }).code === 'CONFIRMATION_REQUIRED') {
        throw error;
      }
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error || error.message || 'Registration failed';
        throw new Error(typeof message === 'string' ? message : 'Registration failed');
      }
      if (isCognitoAuthEnabled()) {
        throw new Error(getCognitoAppErrorMessage(error));
      }
      const err = error as { message?: string };
      throw new Error(err.message || 'Registration failed');
    }
  };

  // Logout
  const logout = () => {
    if (isCognitoAuthEnabled()) {
      signOutCognito();
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
  };

  const refreshUser = async () => {
    const t = token || localStorage.getItem('authToken');
    if (!t) return;
    try {
      await loadMe(t);
    } catch (e) {
      console.error('refreshUser failed:', e);
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isLoggedIn: !!user,
    login,
    loginWithIdToken,
    register,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
