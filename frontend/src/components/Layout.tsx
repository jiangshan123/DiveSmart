import { type ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { ChatAssistant } from './ChatAssistant';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { isLoggedIn, user, logout, isLoading } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
  };

  return (
    <div className="layout-container">
      {/* Header */}
      <header className="layout-header">
        <div className="header-bg-layer" aria-hidden="true">
          <div
            className="header-bg-photo header-bg-photo--1"
            style={{
              backgroundImage:
                "url(https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=900&q=80&auto=format&fit=crop)",
            }}
          />
          <div
            className="header-bg-photo header-bg-photo--2"
            style={{
              backgroundImage:
                "url(https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=900&q=80&auto=format&fit=crop)",
            }}
          />
          <div
            className="header-bg-photo header-bg-photo--3"
            style={{
              backgroundImage:
                "url(https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=900&q=80&auto=format&fit=crop)",
            }}
          />
        </div>
        <div className="header-bg-scrim" aria-hidden="true" />
        <div className="header-content">
          <div className="logo-section">
            <div className="logo-icon">🌊</div>
            <h1 className="logo-text">SmartDive</h1>
          </div>
          <nav className="header-nav">
            <Link to="/" className="nav-link">Dive Spots</Link>
            <Link to="/forum" className="nav-link">Community</Link>
            <a href="#about" className="nav-link">About</a>
          </nav>
          
          {/* User Auth Section */}
          <div className="auth-section">
            {isLoading ? (
              <div className="auth-loading">Loading...</div>
            ) : isLoggedIn ? (
              <div className="user-menu-container">
                <button 
                  className="user-menu-btn"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                >
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt=""
                      className="user-avatar-thumb"
                    />
                  ) : (
                    <span className="user-icon">👤</span>
                  )}
                  <span>{user?.username || user?.email}</span>
                </button>
                
                {showUserMenu && (
                  <div className="user-menu-dropdown">
                    <div className="user-info">
                      <p className="user-email">{user?.email}</p>
                    </div>
                    <Link
                      to="/profile"
                      className="profile-menu-link"
                      onClick={() => setShowUserMenu(false)}
                    >
                      Profile & avatar
                    </Link>
                    <button 
                      className="logout-btn"
                      onClick={handleLogout}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="auth-links">
                <Link to="/login" className="auth-link login-link">Login</Link>
                <Link to="/register" className="auth-link register-link">Register</Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="layout-main">
        {children}
      </main>

      {/* Footer */}
      <footer className="layout-footer">
        <div className="footer-content">
          <div className="footer-section">
            <h3>SmartDive</h3>
            <p>Explore New Zealand's most beautiful dive sites</p>
          </div>
          <div className="footer-section">
            <h4>Information</h4>
            <ul>
              <li><a href="#tide">Tide Alerts</a></li>
              <li><a href="#weather">Weather</a></li>
              <a href="/">Dive Spots</a>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Contact</h4>
            <p>Email: info@smartdive.com</p>
            <p>Phone: +64 1234 5678</p>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 SmartDive. All rights reserved.</p>
        </div>
      </footer>

      <ChatAssistant />
    </div>
  );
}
