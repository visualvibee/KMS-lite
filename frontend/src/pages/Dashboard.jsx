import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Navbar';

const ROLE_CONFIG = {
  admin: {
    label: 'System Administrator',
    description: 'Full system access including user management, all employee records, audit logs, and key lifecycle management.',
    cards: [
      { title: 'Employees', desc: 'View, add, update and delete employee records', path: '/employees', color: '#1e3a5f' },
      { title: 'Add Employee', desc: 'Create new encrypted employee records', path: '/add-employee', color: '#2d5a8e' },
      { title: 'Audit Logs', desc: 'Monitor all database activity', path: '/audit-logs', color: '#1d4ed8' },
      { title: 'Key Management', desc: 'Manage encryption key lifecycle', path: '/key-management', color: '#0f766e' },
    ],
  },
  hr: {
    label: 'HR / Data Manager',
    description: 'Add, update and view employee records. Sensitive fields are encrypted at rest.',
    cards: [
      { title: 'Employees', desc: 'View and manage employee records', path: '/employees', color: '#1e3a5f' },
      { title: 'Add Employee', desc: 'Create new encrypted employee records', path: '/add-employee', color: '#2d5a8e' },
    ],
  },
  analyst: {
    label: 'Security Analyst',
    description: 'View employee records and monitor all audit logs for security analysis.',
    cards: [
      { title: 'Employees', desc: 'View employee records with reveal access', path: '/employees', color: '#1e3a5f' },
      { title: 'Audit Logs', desc: 'Monitor all database activity across the system', path: '/audit-logs', color: '#1d4ed8' },
    ],
  },
  keymanager: {
    label: 'Key Manager',
    description: 'Generate keys, manage key states, and oversee the full key lifecycle.',
    cards: [
      { title: 'Key Management', desc: 'Generate keys and manage their lifecycle states', path: '/key-management', color: '#0f766e' },
    ],
  },
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const config = ROLE_CONFIG[user?.role] || ROLE_CONFIG.analyst;

  return (
    <Layout>
      <div className="page-header">
        <h2>Welcome, {user?.username}</h2>
        <p>{config.label} — {config.description}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginTop: 8 }}>
        {config.cards.map(card => (
          <div
            key={card.path}
            onClick={() => navigate(card.path)}
            style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: 24,
              cursor: 'pointer',
              borderTop: `4px solid ${card.color}`,
              transition: 'box-shadow 0.15s',
            }}
            onMouseOver={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
            onMouseOut={e => e.currentTarget.style.boxShadow = 'none'}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: card.color, marginBottom: 8 }}>
              {card.title}
            </div>
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
              {card.desc}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32, padding: '16px 20px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Your session</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>
          Signed in as <strong style={{ color: '#1e3a5f' }}>{user?.username}</strong>
          {' · '}Role: <strong style={{ color: '#1e3a5f' }}>{config.label}</strong>
          {' · '}Token expires in 8 hours
        </div>
      </div>
    </Layout>
  );
}