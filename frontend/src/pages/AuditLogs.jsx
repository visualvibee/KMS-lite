import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Navbar';
import api from '../api/axios';

const OP_COLORS = {
  INSERT: 'badge-green',
  SELECT: 'badge-blue',
  UPDATE: 'badge-yellow',
  DELETE: 'badge-red',
};

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/audit-logs')
      .then(res => setLogs(res.data))
      .catch(err => setError(err.response?.data?.detail || 'Failed to load audit logs'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = showAll ? logs : logs.slice(0, 10);

  return (
    <Layout>
      <div className="page-header">
        <h2>Audit Logs</h2>
        <p>Every database operation is recorded here — DAM-style monitoring of all activity against protected tables.</p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{logs.length} total events</span>
          <button className="btn btn-secondary btn-sm" onClick={load}>Refresh</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="loading">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="empty">No audit logs yet.</div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Operation</th>
                    <th>Table</th>
                    <th>Record ID</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(log => (
                    <tr key={log.id}>
                      <td style={{ color: '#94a3b8' }}>{log.id}</td>
                      <td><span className={`badge ${OP_COLORS[log.operation] || 'badge-gray'}`}>{log.operation}</span></td>
                      <td><code style={{ fontSize: 12 }}>{log.table_name}</code></td>
                      <td>{log.record_id ?? <span style={{ color: '#94a3b8' }}>—</span>}</td>
                      <td style={{ color: '#64748b', fontSize: 12 }}>{new Date(log.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {logs.length > 10 && (
              <button
                onClick={() => setShowAll(s => !s)}
                style={{ display: 'block', width: '100%', textAlign: 'center', padding: 10, fontSize: 13, color: '#1e3a5f', fontWeight: 600, cursor: 'pointer', borderTop: '1px solid #f1f5f9', marginTop: 4, background: 'none', border: 'none', borderTop: '1px solid #f1f5f9' }}
              >
                {showAll ? 'Show less ↑' : `View all ${logs.length} events ↓`}
              </button>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}