# KMS-Lite Frontend

React + Vite frontend for the KMS-Lite encryption gateway.

## Stack

- React 18 (Vite, JavaScript)
- React Router v6 — client-side routing
- Axios — HTTP client with JWT interceptor
- Plain CSS — no UI framework

## Structure
src/
├── api/
│   └── axios.js          # Axios instance — attaches Bearer token to every request
├── context/
│   └── AuthContext.jsx   # Auth state (user, role, token) — persisted in localStorage
├── components/
│   ├── Navbar.jsx        # Sidebar layout wrapper used by all authenticated pages
│   └── ProtectedRoute.jsx  # Redirects to /login if unauthenticated or wrong role
└── pages/
├── Login.jsx         # JWT login form
├── Dashboard.jsx     # Role-specific landing with quick-access cards
├── Employees.jsx     # Employee list with encrypted field reveal, role-gated delete
├── AddEmployee.jsx   # Add employee form (admin + hr only)
├── AuditLogs.jsx     # Audit trail with expand/collapse
└── KeyManagement.jsx # Key lifecycle management (keymanager + admin)

## Role-based routing

| Route | Admin | HR | Analyst | Key Manager |
|---|---|---|---|---|
| /dashboard | ✅ | ✅ | ✅ | ✅ |
| /employees | ✅ | ✅ | ✅ | ❌ |
| /add-employee | ✅ | ✅ | ❌ | ❌ |
| /audit-logs | ✅ | ❌ | ✅ | ❌ |
| /key-management | ✅ | ❌ | ❌ | ✅ |

## Dev setup

```bash
npm install
npm run dev       # starts at http://localhost:5173
```

Backend must be running at `http://localhost:8000`. The Vite proxy in `vite.config.js` forwards all `/api/*` requests to the backend, stripping the `/api` prefix.

## Build for production

```bash
npm run build     # outputs to dist/
```

The `dist/` folder can be served statically or picked up by Docker.

## Auth flow

1. User logs in via `POST /api/auth/login`
2. JWT token stored in `localStorage`
3. `axios.js` interceptor attaches `Authorization: Bearer <token>` to every request
4. On 401 response, interceptor clears localStorage and redirects to `/login`
5. `ProtectedRoute` checks `AuthContext` on every navigation — redirects to `/login` if no user, `/dashboard` if wrong role