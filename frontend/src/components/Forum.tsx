import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { spearPhotoRotatedPageStyle } from '../spear-page-background';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

interface ForumPost {
  post_id: string;
  body: string;
  author_username: string;
  author_user_id: string | null;
  author_avatar_url?: string | null;
  created_at: number;
}

const forumAvatarStyle: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: '50%',
  objectFit: 'cover',
  flexShrink: 0,
  border: '2px solid rgba(14, 148, 136, 0.35)',
};

const forumAvatarPlaceholderStyle: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: '50%',
  flexShrink: 0,
  background: 'linear-gradient(145deg, #e3f2f7 0%, #cfe8ef 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 20,
  border: '2px solid rgba(148, 163, 184, 0.35)',
};

function formatAgo(ms: number): string {
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 45) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function Forum() {
  const { user, token, isLoggedIn } = useAuth();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const loadPosts = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/forum/posts`);
      if (res.data?.success && Array.isArray(res.data.data?.posts)) {
        setPosts(res.data.data.posts);
        setError(null);
      }
    } catch (e) {
      console.error(e);
      setError('Could not load posts. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    const t = setInterval(loadPosts, 35000);
    return () => clearInterval(t);
  }, [loadPosts]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !token) return;
    setSending(true);
    setError(null);
    try {
      await axios.post(
        `${API_BASE}/api/forum/posts`,
        { content: text },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setDraft('');
      await loadPosts();
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.error
          ? String(err.response.data.error)
          : 'Failed to post. Try again.';
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{
        ...spearPhotoRotatedPageStyle,
        width: '100%',
        boxSizing: 'border-box',
        minHeight: 'min(100vh, 900px)',
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: '0 auto',
          padding: '24px 20px 48px',
          boxSizing: 'border-box',
        }}
      >
      <div
        style={{
          marginBottom: 28,
          padding: '22px 26px',
          borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(10, 92, 114, 0.12) 0%, rgba(14, 120, 140, 0.08) 100%)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          boxShadow: '0 4px 20px rgba(5, 50, 70, 0.08)',
        }}
      >
        <h1 style={{ margin: '0 0 8px', fontSize: 26, color: '#0c4a6e', fontWeight: 700 }}>
          Dive community
        </h1>
        <p style={{ margin: 0, fontSize: 15, color: '#475569', lineHeight: 1.55 }}>
          Share conditions, trips, and tips with other divers. Posts refresh automatically about every 35 seconds.
        </p>
      </div>

      {isLoggedIn && user ? (
        <form
          onSubmit={submit}
          style={{
            marginBottom: 28,
            padding: 20,
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 2px 12px rgba(15, 60, 80, 0.08)',
            border: '1px solid #e2e8f0',
          }}
        >
          <label htmlFor="forum-draft" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, fontSize: 13, color: '#64748b', fontWeight: 600 }}>
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" style={forumAvatarStyle} />
            ) : (
              <span style={forumAvatarPlaceholderStyle} aria-hidden>👤</span>
            )}
            <span>
              Post as <span style={{ color: '#0e7490' }}>{user.username}</span>
            </span>
          </label>
          <textarea
            id="forum-draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="What’s the viz like? Any boat space? Shore entry notes…"
            rows={4}
            maxLength={8000}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: 14,
              fontSize: 15,
              lineHeight: 1.5,
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{draft.length} / 8000</span>
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              style={{
                padding: '10px 22px',
                fontSize: 15,
                fontWeight: 600,
                color: '#fff',
                background: sending || !draft.trim() ? '#94a3b8' : 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                border: 'none',
                borderRadius: 8,
                cursor: sending || !draft.trim() ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(13, 148, 136, 0.35)',
              }}
            >
              {sending ? 'Posting…' : 'Share update'}
            </button>
          </div>
        </form>
      ) : (
        <div
          style={{
            marginBottom: 28,
            padding: 18,
            background: '#fffbeb',
            border: '1px solid #fcd34d',
            borderRadius: 12,
            fontSize: 14,
            color: '#92400e',
          }}
        >
          <strong>Log in</strong> to post an update.{' '}
          <Link to="/login" style={{ color: '#0e7490', fontWeight: 600 }}>
            Login
          </Link>{' '}
          or{' '}
          <Link to="/register" style={{ color: '#0e7490', fontWeight: 600 }}>
            Register
          </Link>
          .
        </div>
      )}

      {error && (
        <p style={{ color: '#b91c1c', marginBottom: 16, fontSize: 14 }}>{error}</p>
      )}

      <h2 style={{ fontSize: 17, color: '#334155', margin: '0 0 14px', fontWeight: 700 }}>
        Latest updates
      </h2>

      {loading && posts.length === 0 ? (
        <p style={{ color: '#64748b' }}>Loading…</p>
      ) : posts.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: 15 }}>No posts yet — be the first to share.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {posts.map((p) => (
            <li
              key={p.post_id}
              style={{
                padding: 18,
                background: '#fff',
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 8px rgba(15, 60, 80, 0.06)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                {p.author_avatar_url ? (
                  <img src={p.author_avatar_url} alt="" style={forumAvatarStyle} />
                ) : (
                  <span style={forumAvatarPlaceholderStyle} aria-hidden>👤</span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, color: '#0e7490', fontSize: 15 }}>{p.author_username}</span>
                    <time dateTime={new Date(p.created_at).toISOString()} style={{ fontSize: 12, color: '#94a3b8', flexShrink: 0 }}>
                      {formatAgo(p.created_at)}
                    </time>
                  </div>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.6, color: '#1e293b' }}>{p.body}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      </div>
    </div>
  );
}
