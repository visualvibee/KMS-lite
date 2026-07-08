# KMS-Lite

A proof-of-concept **column-level encryption gateway** for MySQL, built as an open-source analog to Thales CipherTrust's Application Data Protection capabilities.

## Architecture
React Frontend (Vite, port 5173)
│
│  JWT Bearer token on all requests
▼
FastAPI Backend (port 8000)
│
├── Authentication (JWT + bcrypt)
├── RBAC (4 roles, enforced per route)
├── Column-level AES-256-GCM encryption
├── Audit logging (DAM-style)
└── Key lifecycle management (5 states)
│
▼
MySQL Database (kms_lite)
├── employees        — encrypted sensitive fields
├── users            — hashed credentials + roles
├── encryption_keys  — key metadata + lifecycle
└── audit_logs       — operation trail

## Roles

| Role | Access |
|---|---|
| System Administrator | Full access — all routes, user management, key management |
| HR / Data Manager | Add, update, view employee records |
| Security Analyst | View employee records, monitor audit logs |
| Key Manager | Generate keys, manage key lifecycle states |

## Key states

`pending_activation` → `active` → `suspended` / `retired` / `compromised`

## Project structure
kms-lite/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI routes + RBAC enforcement
│   │   ├── auth.py           # JWT auth + bcrypt + role checking
│   │   ├── crypto_engine.py  # AES-256-GCM encrypt/decrypt (OpenSSL-backed)
│   │   └── database.py       # SQLAlchemy connection layer
│   ├── schema.sql            # Full MySQL schema
│   ├── requirements.txt      # Python dependencies (pinned)
│   ├── .env.example          # Required environment variables
│   └── .gitignore
├── frontend/
│   ├── src/
│   │   ├── api/axios.js          # Axios instance with JWT interceptor
│   │   ├── context/AuthContext.jsx  # Global auth state
│   │   ├── components/
│   │   │   ├── Navbar.jsx        # Sidebar layout (role-aware navigation)
│   │   │   └── ProtectedRoute.jsx
│   │   └── pages/
│   │       ├── Login.jsx
│   │       ├── Dashboard.jsx     # Role-specific landing page
│   │       ├── Employees.jsx
│   │       ├── AddEmployee.jsx
│   │       ├── AuditLogs.jsx
│   │       └── KeyManagement.jsx
│   └── README.md
└── README.md

## Setup

### Prerequisites
- Python 3.11+
- Node.js 22.12+
- MySQL 8.0+

### Backend

```bash
cd backend
pip install -r requirements.txt
```

Copy and fill in environment variables:
```bash
cp .env.example .env
```

Required values in `.env`:
KMS_LITE_MASTER_KEY=     # generate: python -c "import os,base64; print(base64.b64encode(os.urandom(32)).decode())"
KMS_LITE_API_KEYS=       # any string, used as fallback
JWT_SECRET_KEY=          # generate: python -c "import secrets; print(secrets.token_hex(32))"
DB_USER=kms_app
DB_PASSWORD=             # your MySQL password
DB_HOST=localhost
DB_PORT=3306
DB_NAME=kms_lite

Load the schema:
```bash
# Linux/Mac
mysql -u root -p < schema.sql

# Windows PowerShell
Get-Content schema.sql | mysql -u root -p
```

Create a dedicated MySQL user:
```sql
CREATE USER 'kms_app'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON kms_lite.* TO 'kms_app'@'localhost';
FLUSH PRIVILEGES;
```

Start the backend:
```bash
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

### Seed users

```bash
# Windows PowerShell — run from backend folder
Invoke-RestMethod -Uri "http://localhost:8000/auth/register" -Method Post -ContentType "application/json" -Body '{"username":"admin1","password":"Admin123!","role":"admin"}'
Invoke-RestMethod -Uri "http://localhost:8000/auth/register" -Method Post -ContentType "application/json" -Body '{"username":"hr1","password":"Hr123!","role":"hr"}'
Invoke-RestMethod -Uri "http://localhost:8000/auth/register" -Method Post -ContentType "application/json" -Body '{"username":"analyst1","password":"Analyst123!","role":"analyst"}'
Invoke-RestMethod -Uri "http://localhost:8000/auth/register" -Method Post -ContentType "application/json" -Body '{"username":"km1","password":"Km123!","role":"keymanager"}'
```

## Security note

`.env` is excluded from version control via `.gitignore`. Never commit real credentials.
The `KMS_LITE_MASTER_KEY` is used to encrypt all sensitive fields — losing it makes existing encrypted data permanently unreadable. Store it safely.

## Known limitations / future scope

- **Audit logs don't capture direct DB access** — application-level logging only catches requests through FastAPI. MySQL triggers (in progress) will address writes; SELECT logging requires MySQL Enterprise Audit or equivalent.
- **Single master key** — key rotation (re-encrypting existing rows under a new key) is not yet implemented. The key lifecycle UI manages metadata and state; actual cryptographic key material generation per key entry is in progress.
- **Login is session-based only** — no refresh tokens; session expires after 8 hours.
- **Docker** — containerization planned; not yet implemented.
- **RBAC is route-level** — field-level access control (e.g. analyst can view but not reveal SSN) is future scope.