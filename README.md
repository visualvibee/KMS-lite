# KMS-Lite

A proof-of-concept **column-level encryption gateway** for MySQL, built as an open-source analog to Thales CipherTrust's Application Data Protection / database protection capabilities.

## What this demonstrates

CipherTrust (the real product) sits between an application and a database, encrypting sensitive fields transparently using keys managed in an HSM-backed vault, gated by client authentication. This project recreates that architectural pattern at small scale:

| CipherTrust concept | This project's analog |
|---|---|
| Key Manager / HSM vault | `crypto_engine.py` — master AES-256 key loaded from environment |
| Client authentication | Login page + `X-API-Key` header on every endpoint |
| Application Data Protection (column-level) | Three encrypted columns: `ssn`, `salary`, `bank_account` |
| Transparent encrypt/decrypt | FastAPI server auto-encrypts on write, auto-decrypts on read |
| Key lifecycle / metadata | `encryption_keys` table — key ID, algorithm, status, created date |
| Database Activity Monitoring | `audit_logs` table — every INSERT/SELECT/UPDATE/DELETE recorded |

**What it is not**: this does not use an HSM, does not support key rotation or versioning, does not implement RBAC enforcement, and is not FIPS-validated. It is a teaching-scale proof of concept, not a production security product.

## Security note

No real secrets are committed to this repository. `.env` (which holds the actual master key, API key, and DB password) is excluded via `.gitignore` and exists only on each developer's own machine. `.env.example` shows the required variable names with placeholder values — copy it to `.env` and fill in real values locally.

## Architecture

Browser (http://localhost:8000/ui)
│
     │  Login → X-API-Key header on all requests
▼
┌──────────────────────────┐
│     FastAPI server        │   app/main.py
│                           │
│  POST/PUT  → encrypt      │   app/crypto_engine.py (AES-256-GCM, OpenSSL-backed)
│  GET       → decrypt      │
│  ALL ops   → audit log    │
└──────────┬────────────────┘
│  SQL (ciphertext only for sensitive columns)
▼
┌───────────┐
│   MySQL    │   schema.sql
│  kms_lite  │
└───────────┘

The server is the only path to the database — no client ever talks to MySQL directly. Every request passes through the encryption layer and is logged.

## Why AES-256-GCM

Python's `cryptography` library binds to OpenSSL's `libcrypto` for AES operations — so "use OpenSSL" and "use Python's cryptography library" are the same thing at the implementation level. GCM mode was chosen over CBC because it is authenticated encryption — tampering with ciphertext causes decryption to fail loudly rather than silently returning corrupted data.

## Setup (Windows / PowerShell)

### 1. Install dependencies

```powershell
pip install fastapi uvicorn cryptography pymysql sqlalchemy python-dotenv email-validator
```

### 2. Set up MySQL

Make sure MySQL is running (check Windows Services for `MySQL80`). Then from inside the project folder:

```powershell
Get-Content schema.sql | mysql -u root -p
```

Create a dedicated app user:

```powershell
mysql -u root -p -e "CREATE USER 'kms_app'@'localhost' IDENTIFIED BY 'your_password'; GRANT ALL PRIVILEGES ON kms_lite.* TO 'kms_app'@'localhost'; FLUSH PRIVILEGES;"
```

Verify tables were created:

```powershell
mysql -u root -p -e "USE kms_lite; SHOW TABLES;"
```

### 3. Configure secrets

```powershell
Copy-Item .env.example .env
```

Generate a master encryption key:

```powershell
python -c "import os, base64; print(base64.b64encode(os.urandom(32)).decode())"
```

Save this value somewhere safe — a password manager or private note. **Losing it makes all encrypted data permanently unreadable**, since decryption mathematically requires this exact key.

Open `.env` and fill in real values:
- `KMS_LITE_MASTER_KEY` → the key generated above
- `KMS_LITE_API_KEYS` → any string you choose
- `DB_USER` / `DB_PASSWORD` → the app user created in step 2
- `DB_HOST`, `DB_PORT`, `DB_NAME` → leave as defaults unless changed

### 4. Load environment variables

The app reads from environment variables directly. Run these in your terminal before starting the server, substituting real values from your `.env`:

```powershell
$env:KMS_LITE_MASTER_KEY="your_key_here"
$env:KMS_LITE_API_KEYS="your_api_key_here"
$env:DB_USER="kms_app"
$env:DB_PASSWORD="your_db_password"
$env:DB_HOST="localhost"
$env:DB_NAME="kms_lite"
```

These variables only last for the current terminal session. Re-run before each server start, and always use the same master key or previously encrypted data becomes unreadable.

### 5. Run the server

```powershell
python -m uvicorn app.main:app --reload --port 8000
```

Open the UI at `http://localhost:8000/ui`.

Demo credentials: `admin` / `admin123`

## Troubleshooting

**`mysql` not recognized**: MySQL's `bin` folder isn't on PATH. Find it (commonly `C:\Program Files\MySQL\MySQL Server 8.0\bin`), then add it permanently via Windows "Edit environment variables" settings, or temporarily with `$env:Path += ";C:\Program Files\MySQL\MySQL Server 8.0\bin"`. Restart VS Code after a permanent change.

**`uvicorn` not recognized**: use `python -m uvicorn ...` instead of `uvicorn ...` directly.

**`Get-Content` can't find `schema.sql`**: your terminal isn't in the project folder. Run `cd "C:\Users\<you>\Desktop\kms-lite"` first.

**`curl` in PowerShell shows a security warning**: PowerShell's `curl` is aliased to `Invoke-WebRequest`. Use `Invoke-RestMethod` instead.

**500 error on startup**: check that all six `$env:` variables are set in the current terminal tab before running uvicorn. Run `echo $env:KMS_LITE_MASTER_KEY` to verify.

## Example usage (PowerShell)

**Create an employee** (plaintext in, ciphertext stored):

```powershell
$body = @{
    name = "Aditi Sharma"
    department = "Engineering"
    email = "aditi@example.com"
    ssn = "123-45-6789"
    salary = 85000
    bank_account = "ACC0001"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8000/employees" -Method Post -Headers @{"X-API-Key"="your_api_key"} -ContentType "application/json" -Body $body
```

**Fetch a record** (server decrypts automatically):

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/employees/1" -Headers @{"X-API-Key"="your_api_key"}
```

**Check the raw DB row** (ciphertext visible, plaintext never stored):

```powershell
mysql -u root -p -e "USE kms_lite; SELECT id, name, ssn_encrypted, salary_encrypted, key_id FROM employees;"
```

**View audit trail**:

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/audit-logs" -Headers @{"X-API-Key"="your_api_key"}
```

**View encryption key metadata**:

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/encryption-keys" -Headers @{"X-API-Key"="your_api_key"}
```

## Web UI

A React-based UI is served directly from the FastAPI backend at `http://localhost:8000/ui` — no separate build step or npm install required.

Features:
- Login page (gates the entire app, API key is managed server-side)
- Employee list with reveal/hide toggles for sensitive fields
- Add Employee form — button label changes to "Encrypting & Saving..." during submission
- Delete confirmation requiring the employee's full name to be typed
- Audit Logs tab showing the 5 most recent events, expandable to full list
- Encryption Keys tab with key metadata and a Generate Key button

## Audit logging

Every INSERT/SELECT/UPDATE/DELETE against `/employees` writes a row to `audit_logs` with operation type, table name, record ID, and timestamp. This mirrors the core behavior of Database Activity Monitoring tools like Imperva DAM — record what happened, independently of whether it succeeded, so there is always a trail.

Not included yet: per-user attribution (who made the request). This would be the natural next step once the auth layer moves beyond a single shared API key.

## Known limitations

1. **No search on encrypted columns.** AES-GCM ciphertext is non-deterministic — the same SSN encrypted twice produces completely different ciphertext each time, so `WHERE ssn_encrypted = ?` can never match. CipherTrust's tokenization features exist partly to solve this tradeoff.

2. **Single master key, no rotation.** The `encryption_keys` table tracks key metadata and supports generating new key references via `POST /encryption-keys/generate`, but actual key material rotation (re-encrypting existing rows under a new key) is not implemented. This is flagged as future scope.

3. **API key is a flat shared secret.** A production system would use per-client keys with user-level audit attribution — so the audit log records not just what happened but who did it.

4. **No HSM.** The master key lives in an environment variable, not hardware-protected storage. Acceptable for a proof of concept; not acceptable for production PII handling.

5. **Login is demo-only.** The UI login (`admin` / `admin123`) is validated client-side for simplicity. A production version would need server-side session management and proper credential storage.

## API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Server health check |
| GET | `/ui` | Web UI |
| POST | `/employees` | Create employee (encrypts sensitive fields) |
| GET | `/employees` | List all employees (optional `?department=` filter) |
| GET | `/employees/{id}` | Get employee by ID |
| PUT | `/employees/{id}` | Update employee fields |
| DELETE | `/employees/{id}` | Delete employee |
| GET | `/audit-logs` | Full audit trail |
| GET | `/encryption-keys` | Key metadata list |
| POST | `/encryption-keys/generate` | Generate new key entry |

## Project structure

kms-lite/
├── app/
│   ├── crypto_engine.py   # AES-256-GCM encrypt/decrypt (OpenSSL-backed)
│   ├── database.py        # SQLAlchemy connection layer
│   └── main.py            # FastAPI routes + audit logging + UI serving
├── static/
│   └── index.html         # React UI (no build step required)
├── schema.sql             # MySQL schema: employees, audit_logs, encryption_keys
├── .env.example           # Template for required environment variables
├── .gitignore             # Excludes .env and cache files from version control
└── README.md
