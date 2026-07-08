import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

function getStoredUser() {
  try {
    const user = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (user && token) return JSON.parse(user);
  } catch {
    // ignore
  }
  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());

  const login = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const hasRole = (...roles) => roles.includes(user?.role);

  return (
    <AuthContext.Provider value={{ user, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);