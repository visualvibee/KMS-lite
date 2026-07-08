import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!username || !password) {
      setError('Please enter both username and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', { username, password });
      login(res.data.user, res.data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => { if (e.key === 'Enter') handleSubmit(); };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.brand}>
          <div style={styles.shield}>🔐</div>
          <h1 style={styles.title}>KMS-Lite</h1>
        </div>
        <p style={styles.sub}>Key Management & Encryption Gateway</p>

        <label style={styles.label}>Username</label>
        <input
          style={styles.input}
          value={username}
          onChange={e => setUsername(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Enter username"
          autoFocus
        />

        <label style={styles.label}>Password</label>
        <input
          style={styles.input}
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Enter password"
        />

        <button style={styles.btn} onClick={handleSubmit} disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.hint}>
          Roles: admin1 / hr1 / analyst1 / km1 — password format: RoleNAme123!
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)',
  },
  card: {
    background: 'white',
    borderRadius: 16,
    padding: 40,
    width: 380,
    boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
  },
  brand: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 },
  shield: {
    width: 40, height: 40,
    background: '#1e3a5f',
    borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 20,
  },
  title: { fontSize: 22, fontWeight: 800, color: '#1e3a5f' },
  sub: { fontSize: 13, color: '#64748b', marginBottom: 28, marginLeft: 52 },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 14,
    outline: 'none',
    marginBottom: 16,
    color: '#1a1a2e',
  },
  btn: {
    width: '100%',
    background: '#1e3a5f',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 4,
  },
  error: {
    background: '#fee2e2',
    color: '#dc2626',
    border: '1px solid #fca5a5',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    marginTop: 12,
  },
  hint: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 20 },
};