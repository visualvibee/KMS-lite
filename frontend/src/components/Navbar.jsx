import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS = {
  admin: 'System Administrator',
  hr: 'HR / Data Manager',
  analyst: 'Security Analyst',
  keymanager: 'Key Manager',
};

const ROLE_NAV = {
  admin: ['dashboard', 'employees', 'add-employee', 'audit-logs', 'key-management'],
  hr: ['dashboard', 'employees', 'add-employee'],
  analyst: ['dashboard', 'employees', 'audit-logs'],
  keymanager: ['dashboard', 'key-management'],
};

const NAV_ITEMS = {
  dashboard: { label: 'Dashboard', path: '/dashboard', icon: '🏠' },
  employees: { label: 'Employees', path: '/employees', icon: '👥' },
  'add-employee': { label: 'Add Employee', path: '/add-employee', icon: '➕' },
  'audit-logs': { label: 'Audit Logs', path: '/audit-logs', icon: '📋' },
  'key-management': { label: 'Key Management', path: '/key-management', icon: '🔑' },
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const allowedNav = ROLE_NAV[user?.role] || [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={styles.root}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <span style={styles.brandIcon}>🔐</span>
          <span style={styles.brandName}>KMS-Lite</span>
        </div>

        <nav style={styles.nav}>
          <div style={styles.navSection}>MENU</div>
          {allowedNav.map((key) => (
            <NavLink
              key={key}
              to={NAV_ITEMS[key].path}
              style={({ isActive }) => ({
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
              })}
            >
              <span style={styles.navIcon}>{NAV_ITEMS[key].icon}</span>
              {NAV_ITEMS[key].label}
            </NavLink>
          ))}
        </nav>

        <div style={styles.sidebarBottom}>
          <div style={styles.userBlock}>
            <div style={styles.userAvatar}>
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div style={styles.userInfo}>
              <div style={styles.userName}>{user?.username}</div>
              <div style={styles.userRole}>{ROLE_LABELS[user?.role]}</div>
            </div>
          </div>
          <button style={styles.logoutBtn} onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <div style={styles.main}>
        <div style={styles.content}>
          {children}
        </div>
        <footer style={styles.footer}>
          <span>KMS-Lite — Column-Level Encryption Gateway</span>
          <span>Built with FastAPI · React · MySQL · AES-256-GCM</span>
        </footer>
      </div>
    </div>
  );
}

const styles = {
  root: {
    display: 'flex',
    minHeight: '100vh',
  },
  sidebar: {
    width: 240,
    background: '#1e3a5f',
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 100,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '24px 20px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  brandIcon: { fontSize: 22 },
  brandName: {
    fontSize: 18,
    fontWeight: 800,
    color: 'white',
    letterSpacing: '-0.3px',
  },
  nav: {
    flex: 1,
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    overflowY: 'auto',
  },
  navSection: {
    fontSize: 10,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: '1px',
    padding: '8px 8px 4px',
    marginBottom: 4,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.7)',
    textDecoration: 'none',
    transition: 'all 0.15s',
  },
  navItemActive: {
    background: 'rgba(255,255,255,0.15)',
    color: 'white',
    fontWeight: 600,
  },
  navIcon: { fontSize: 16, width: 20, textAlign: 'center' },
  sidebarBottom: {
    padding: '16px 12px',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  userBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.2)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 700,
    flexShrink: 0,
  },
  userInfo: { overflow: 'hidden' },
  userName: {
    fontSize: 13,
    fontWeight: 600,
    color: 'white',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userRole: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  logoutBtn: {
    width: '100%',
    background: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.7)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 6,
    padding: '7px 12px',
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'center',
  },
  main: {
    marginLeft: 240,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  },
  content: {
    flex: 1,
    padding: '28px 32px',
  },
  footer: {
    padding: '16px 32px',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    color: '#94a3b8',
    background: 'white',
  },
};