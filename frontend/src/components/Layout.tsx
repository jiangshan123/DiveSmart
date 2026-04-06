import { type ReactNode } from 'react';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="layout-container">
      {/* Header */}
      <header className="layout-header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo-icon">🌊</div>
            <h1 className="logo-text">SmartDive</h1>
          </div>
          <nav className="header-nav">
            <a href="/" className="nav-link">Dive Spots</a>
            <a href="#about" className="nav-link">About</a>
          </nav>
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
              <li><a href="#spots">Dive Spots</a></li>
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
    </div>
  );
}
