import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Navbar';
import api from '../api/axios';

const STATE_COLORS = {
  pending_activation: 'badge-yellow',
  active: 'badge-green',
  suspended: 'badge-orange',
  retired: 'badge-gray',
  compromised: 'badge-red',
};

const STATE_TRANSITIONS = {
  pending_activation: ['active'],
  active: ['suspended', 'retired', 'compromised'],
  suspended: ['active', 'retired', 'compromised'],
  retired: [],
  compromised: [],
};

export default function KeyManagement() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [transitioning, setTransitioning] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    api.get('/encryption-keys')
      .then(res => setKeys(res.data))
      .catch(err => setError(err.response?.data?.detail || 'Failed to load keys'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const generateKey = async () => {
    setGenerating(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.post('/encryption-keys/generate');
      setSuccess(`Key "${res.data.key_id}" generated. Status: pending_activation.`);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Key generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const changeState = async (keyId, newState) => {
    setTransitioning(t => ({ ...t, [keyId]: true }));
    setError('');
    setSuccess('');
    try {
      await api.put(`/encryption-keys/${keyId}/state`, { status: newState });
      setSuccess(`Key "${keyId}" moved to ${newState}.`);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || 'State change failed');
    } finally {
      setTransitioning(t => ({ ...t, [keyId]: false }));
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <h2>Key Management</h2>
        <p>Manage encryption key lifecycle. Key material never appears here — only identifiers and state.</p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>{keys.length} key{keys.length !== 1 ? 's' : ''} registered</span>
          <button className="btn btn-primary btn-sm" onClick={generateKey} disabled={generating}>
            {generating ? 'Generating...' : '+ Generate New Key'}
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {loading ? (
          <div className="loading">Loading...</div>
        ) : keys.length === 0 ? (
          <div className="empty">No keys found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Key ID</th>
                  <th>Algorithm</th>
                  <th>State</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map(k => (
                  <tr key={k.key_id}>
                    <td><span className="key-id-tag">{k.key_id}</span></td>
                    <td><span className="badge badge-blue">{k.algorithm}</span></td>
                    <td><span className={`badge ${STATE_COLORS[k.status] || 'badge-gray'}`}>{k.status.replace('_', ' ')}</span></td>
                    <td style={{ color: '#64748b', fontSize: 12 }}>{new Date(k.created_at).toLocaleString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(STATE_TRANSITIONS[k.status] || []).map(nextState => (
                          <button
                            key={nextState}
                            className={`btn btn-sm ${nextState === 'compromised' ? 'btn-danger' : 'btn-secondary'}`}
                            disabled={transitioning[k.key_id]}
                            onClick={() => changeState(k.key_id, nextState)}
                          >
                            {nextState.replace('_', ' ')}
                          </button>
                        ))}
                        {STATE_TRANSITIONS[k.status]?.length === 0 && (
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>No transitions available</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 20, padding: '14px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Key state model</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(STATE_COLORS).map(([state, cls]) => (
              <span key={state} className={`badge ${cls}`}>{state.replace('_', ' ')}</span>
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 8, lineHeight: 1.6 }}>
            New keys start as <strong>pending activation</strong>. Only <strong>active</strong> keys encrypt new data.
            Keys can be <strong>suspended</strong> temporarily or <strong>retired</strong> permanently.
            <strong> Compromised</strong> marks a key as unsafe — this state cannot be reversed.
          </div>
        </div>
      </div>
    </Layout>
  );
}