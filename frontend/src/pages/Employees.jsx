import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

function SensitiveValue({ value }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
      onClick={e => { e.stopPropagation(); setRevealed(r => !r); }}>
      {revealed
        ? <span style={{ fontSize: 13 }}>{value}</span>
        : <span style={{ color: '#94a3b8', letterSpacing: 2, fontSize: 12 }}>••••••••</span>
      }
      <span style={{ fontSize: 11, color: '#1e3a5f', textDecoration: 'underline' }}>
        {revealed ? 'hide' : 'reveal'}
      </span>
    </div>
  );
}

function EmployeeModal({ employee, onClose }) {
  if (!employee) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Employee Record — #{employee.id}</div>
        {[
          ['Name', employee.name],
          ['Department', employee.department],
          ['Email', employee.email],
        ].map(([label, val]) => (
          <div key={label} style={rowStyle}>
            <span style={labelStyle}>{label}</span>
            <span style={valStyle}>{val}</span>
          </div>
        ))}
        {[
          ['SSN', employee.ssn],
          ['Salary', `$${Number(employee.salary).toLocaleString()}`],
          ['Bank Account', employee.bank_account],
        ].map(([label, val]) => (
          <div key={label} style={rowStyle}>
            <span style={labelStyle}>{label}</span>
            <span style={valStyle}><SensitiveValue value={val} /></span>
          </div>
        ))}
        <div style={rowStyle}>
          <span style={labelStyle}>Encryption Key</span>
          <span style={valStyle}><span className="key-id-tag">{employee.key_id}</span></span>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({ employee, onConfirm, onCancel }) {
  const [typed, setTyped] = useState('');
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Confirm Delete</div>
        <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
          Permanently delete <strong>{employee.name}</strong>'s record.
          Type their full name to confirm.
        </p>
        <input
          style={{ width: '100%', border: '1px solid #fca5a5', borderRadius: 6, padding: '9px 12px', fontSize: 14, outline: 'none', marginTop: 12 }}
          placeholder={`Type "${employee.name}" to confirm`}
          value={typed}
          onChange={e => setTyped(e.target.value)}
          autoFocus
        />
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button
            className="btn btn-danger"
            disabled={typed !== employee.name}
            style={{ opacity: typed !== employee.name ? 0.5 : 1 }}
            onClick={onConfirm}
          >Delete</button>
        </div>
      </div>
    </div>
  );
}

const rowStyle = { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 };
const labelStyle = { color: '#64748b', fontWeight: 500 };
const valStyle = { color: '#1a1a2e', fontWeight: 500, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-all' };

export default function Employees() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [selected, setSelected] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const canDelete = ['admin'].includes(user?.role);
  const canAdd = ['admin', 'hr'].includes(user?.role);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const url = filterDept ? `/employees?department=${encodeURIComponent(filterDept)}` : '/employees';
    api.get(url)
      .then(res => setEmployees(res.data))
      .catch(err => setError(err.response?.data?.detail || 'Failed to load employees'))
      .finally(() => setLoading(false));
  }, [filterDept]);

  useEffect(() => { load(); }, [load]);

  const confirmDelete = () => {
    api.delete(`/employees/${toDelete.id}`)
      .then(() => { setToDelete(null); load(); })
      .catch(err => { setError(err.response?.data?.detail || 'Delete failed'); setToDelete(null); });
  };

  return (
    <Layout>
      <div className="page-header">
        <h2>Employees</h2>
        <p>Sensitive fields are encrypted at rest. Click reveal to view decrypted values.</p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '7px 12px', fontSize: 13, outline: 'none', width: 200 }}
              placeholder="Filter by department..."
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
            />
            <button className="btn btn-secondary btn-sm" onClick={load}>Refresh</button>
          </div>
          {canAdd && (
            <a href="/add-employee" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
              + Add Employee
            </a>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="loading">Loading...</div>
        ) : employees.length === 0 ? (
          <div className="empty">No employees found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Email</th>
                  <th>SSN</th>
                  <th>Salary</th>
                  <th>Key</th>
                  {canDelete && <th></th>}
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => (
                  <tr key={emp.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(emp)}>
                    <td><span className="badge badge-gray">#{emp.id}</span></td>
                    <td><strong>{emp.name}</strong></td>
                    <td>{emp.department}</td>
                    <td style={{ color: '#64748b' }}>{emp.email}</td>
                    <td><SensitiveValue value={emp.ssn} /></td>
                    <td><SensitiveValue value={`$${Number(emp.salary).toLocaleString()}`} /></td>
                    <td><span className="key-id-tag">{emp.key_id}</span></td>
                    {canDelete && (
                      <td onClick={e => e.stopPropagation()}>
                        <button className="btn btn-danger btn-sm" onClick={() => setToDelete(emp)}>
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <EmployeeModal employee={selected} onClose={() => setSelected(null)} />}
      {toDelete && <DeleteModal employee={toDelete} onConfirm={confirmDelete} onCancel={() => setToDelete(null)} />}
    </Layout>
  );
}