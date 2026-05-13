import React, { useRef, useState } from 'react';
import axios from 'axios';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { spearPhotoRotatedPageStyle } from '../spear-page-background';
import './Profile.css';

const MAX_BYTES = 2 * 1024 * 1024;

export const Profile: React.FC = () => {
  const { user, token, isLoading, isLoggedIn, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

  if (!isLoading && !isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  const displayAvatar = preview || user?.avatarUrl || null;

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Image must be 2MB or smaller.');
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
  };

  const uploadAvatar = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Choose an image first.');
      return;
    }
    const t = token || localStorage.getItem('authToken');
    if (!t) {
      setError('Not signed in.');
      return;
    }
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await axios.post(`${API_BASE_URL}/api/auth/avatar`, formData, {
        headers: {
          Authorization: `Bearer ${t}`,
        },
      });
      if (res.data.success && res.data.data?.avatarUrl) {
        if (preview) URL.revokeObjectURL(preview);
        setPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        await refreshUser();
      } else {
        setError(res.data.error || 'Upload failed');
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.error || err.message || 'Upload failed';
      setError(typeof msg === 'string' ? msg : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="profile-page" style={spearPhotoRotatedPageStyle}>
        <div className="profile-card profile-card--loading">Loading…</div>
      </div>
    );
  }

  return (
    <div className="profile-page" style={spearPhotoRotatedPageStyle}>
      <div className="profile-card">
        <h1 className="profile-title">Profile</h1>
        <p className="profile-sub">
          Update your display photo. JPEG, PNG, WebP or GIF, up to 2MB.
        </p>

        <div className="profile-avatar-block">
          {displayAvatar ? (
            <img
              src={displayAvatar}
              alt=""
              className="profile-avatar-preview"
            />
          ) : (
            <div className="profile-avatar-placeholder" aria-hidden>
              👤
            </div>
          )}
        </div>

        <div className="profile-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="profile-file-input"
            id="avatar-input"
            onChange={onFileChange}
          />
          <label htmlFor="avatar-input" className="profile-btn profile-btn--secondary">
            Choose image
          </label>
          <button
            type="button"
            className="profile-btn profile-btn--primary"
            onClick={uploadAvatar}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : 'Save avatar'}
          </button>
        </div>

        {error ? <div className="profile-error">{error}</div> : null}

        <div className="profile-meta">
          <div>
            <span className="profile-meta-label">Username</span>
            <span className="profile-meta-value">{user.username}</span>
          </div>
          <div>
            <span className="profile-meta-label">Email</span>
            <span className="profile-meta-value">{user.email}</span>
          </div>
        </div>

        <Link to="/" className="profile-back">
          ← Back to Dive Spots
        </Link>
      </div>
    </div>
  );
};
