import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Navbar';
import api from '../api/axios';

export default function AddEmployee() {
  const navigate = useNavigate();
  const empty = { name: '', department: '', email: '', ssn: '', salary: '', bank_account: '' };
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    setLoading(true);
    setError('');
    setSuccess(null);
    try {
      const res = await api.post('/employees', { ...form, salary: parseFloat(form.salary) });
      setSuccess(res.data);
      setForm(empty);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create employee');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <h2>Add Employee</h2>
        <p>Sensitive fields are encrypted before reaching the database. Key ID is recorded per row.</p>
      </div>

      <div className="card">
        <div className="card-title">Employee Details</div>
        <div className="form-grid">
          <div className="form-group">
            <label>Full Name</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Jane Smith" />
          </div>
          <div className="form-group">
            <label>Department</label>
            <input value={form.department} onChange={e => set('department', e.target.value)} placeholder="Engineering" />
          </div>
          <div className="form-group full">
            <label>Email Address</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@example.com" />
          </div>
        </div>

        <div className="card-title" style={{ marginTop: 20 }}>Sensitive Fields — Encrypted at Rest</div>
        <div className="form-grid">
          <div className="form-group">
            <label>SSN</label>
            <input value={form.ssn} onChange={e => set('ssn', e.target.value)} placeholder="123-45-6789" />
          </div>
          <div className="form-group">
            <label>Salary (USD)</label>
            <input type="number" value={form.salary} onChange={e => set('salary', e.target.value)} placeholder="85000" />
          </div>
          <div className="form-group">
            <label>Bank Account</label>
            <input value={form.bank_account} onChange={e => set('bank_account', e.target.value)} placeholder="ACC1234" />
          </div>
        </div>

        <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading ? 'Encrypting & Saving...' : 'Add Employee'}
          </button>
          <button className="btn btn-secondary" onClick={() => setForm(empty)}>Clear</button>
          <button className="btn btn-secondary" onClick={() => navigate('/employees')}>View All Employees</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && (
          <div className="alert alert-success">
            <strong>{success.name}</strong> added (ID #{success.id}).
            Encrypted with key <span className="key-id-tag">{success.key_id}</span>.
          </div>
        )}
      </div>
    </Layout>
  );
}