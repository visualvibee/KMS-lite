import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import AddEmployee from './pages/AddEmployee';
import AuditLogs from './pages/AuditLogs';
import KeyManagement from './pages/KeyManagement';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/employees" element={
            <ProtectedRoute roles={['admin', 'hr', 'analyst']}>
              <Employees />
            </ProtectedRoute>
          } />
          <Route path="/add-employee" element={
            <ProtectedRoute roles={['admin', 'hr']}>
              <AddEmployee />
            </ProtectedRoute>
          } />
          <Route path="/audit-logs" element={
            <ProtectedRoute roles={['admin', 'analyst']}>
              <AuditLogs />
            </ProtectedRoute>
          } />
          <Route path="/key-management" element={
            <ProtectedRoute roles={['admin', 'keymanager']}>
              <KeyManagement />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);