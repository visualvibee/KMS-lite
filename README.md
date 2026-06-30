# CipherTrust-Lite

A proof-of-concept **column-level encryption gateway** for MySQL, built as an
open-source analog to Thales CipherTrust's Application Data Protection /
database protection capabilities — built without access to the actual
CipherTrust product.

## What this demonstrates

CipherTrust (the real product) sits between an application and a database,
encrypting sensitive fields transparently using keys managed in an HSM-backed
vault, gated by client authentication. This project recreates that
architectural pattern at small scale:

| CipherTrust concept | This project's analog |
|---|---|
| Key Manager / HSM vault | `crypto_engine.py` — master AES-256 key loaded from environment |
| Client authentication to request key ops | `X-API-Key` header, checked on every endpoint |
| Application Data Protection (column-level) | Three encrypted columns: `ssn`, `salary`, `bank_account` |
| Transparent encrypt/decrypt for the app | FastAPI server auto-encrypts on write, auto-decrypts on read |
| Policy: which fields are protected | Decided at the schema/route level (`*_encrypted` columns) |

**What it is not**: this does not use an HSM, does not support key rotation
or versioning, does not implement access policies/RBAC, and is not
FIPS-validated. It's a teaching-scale proof of concept, not a production
security product — worth saying explicitly in your write-up so it reads as
informed rather than overclaiming.

## Security note

No real secrets are committed to this repository. `.env` (which holds the
actual master key, API key, and DB password) is excluded via `.gitignore`
and exists only on each developer's own machine. `.env.example` shows the
required variable names with placeholder values — copy it to `.env` and
fill in real values locally (see Setup below).

## Architecture

```
Client/Postman/curl
        │
        │  HTTP + X-API-Key header
        ▼
┌──────────────────────┐
│   FastAPI server      │   <-- app/main.py
│  (the only thing that  │
│   talks to MySQL)      │
│                        │
│  POST/PUT  → encrypt   │   <-- app/crypto_engine.py (AES-256-GCM, OpenSSL-backed)
│  GET       → decrypt   │
└──────────┬─────────────┘
           │  SQL (ciphertext only, for sensitive columns)
           ▼
     ┌───────────┐
     │   MySQL    │   <-- schema.sql
     │ employees  │
     └───────────┘
```

The "active monitoring" behavior your mentor described is implemented as an
**architectural chokepoint**: there is no code path by which a client can
write to or read from MySQL without passing through the FastAPI server, and
every route that touches `ssn`, `salary`, or `bank_account` calls
`encrypt_value()` / `decrypt_value()` before the data crosses that boundary.

## Why AES-256-GCM via Python's `cryptography` library = "OpenSSL"

Python's `cryptography` package does not reimplement AES — it binds to
**OpenSSL's libcrypto** for the actual cipher operations. So "use OpenSSL"
and "use Python's `cryptography` library" are, at the implementation level,
the same thing here. GCM mode was chosen (over plain CBC) because it's
*authenticated* encryption — tampering with ciphertext causes decryption to
fail loudly rather than silently returning garbage, which matters for a
security-positioned project.

## Setup (Windows / PowerShell)

These steps assume Python and MySQL are already installed. If `mysql` or
`python -m uvicorn` aren't recognized as commands, their install folders
likely aren't on your PATH — see the Troubleshooting section below.

### 1. Install dependencies
```powershell
pip install fastapi uvicorn cryptography pymysql sqlalchemy python-dotenv email-validator
```

### 2. Set up MySQL
Make sure MySQL is running (check Windows Services for `MySQL80` or similar,
status should say "Running"). Then, from inside the project folder:
```powershell
Get-Content schema.sql | mysql -u root -p
```
You'll be prompted for your MySQL root password (typed blind, no characters
shown — that's normal). This creates the `ciphertrust_lite` database plus
the `employees` and `audit_logs` tables.

Create a dedicated app user instead of running everything as `root`:
```powershell
mysql -u root -p -e "CREATE USER 'ciphertrust_app'@'localhost' IDENTIFIED BY 'choose_a_real_password'; GRANT ALL PRIVILEGES ON ciphertrust_lite.* TO 'ciphertrust_app'@'localhost'; FLUSH PRIVILEGES;"
```

Verify the tables exist:
```powershell
mysql -u root -p -e "USE ciphertrust_lite; SHOW TABLES;"
```

### 3. Configure your secrets
Copy the template:
```powershell
Copy-Item .env.example .env
```

Generate a master encryption key:
```powershell
python -c "import os, base64; print(base64.b64encode(os.urandom(32)).decode())"
```
This prints a random string — save it somewhere safe (a password manager,
a private note). **There is no way to recover this value once lost** —
losing it makes every encrypted row in the database permanently
unreadable, since decryption mathematically requires this exact key.

Open `.env` and fill in real values:
- `CIPHERTRUST_LITE_MASTER_KEY` → the key you just generated
- `CIPHERTRUST_LITE_API_KEYS` → any string you choose (this is what
  clients send as the `X-API-Key` header)
- `DB_USER` / `DB_PASSWORD` → the app user created in step 2
- `DB_HOST`, `DB_PORT`, `DB_NAME` → leave as default unless you changed
  something

### 4. Load `.env` into your terminal session
The app reads these values from environment variables directly — `.env`
is not auto-loaded by Python here, so you need to set them in your
terminal before starting the server. Run each line, substituting the
real values from your `.env` file:
```powershell
$env:CIPHERTRUST_LITE_MASTER_KEY="paste_your_key_here"
$env:CIPHERTRUST_LITE_API_KEYS="paste_your_api_key_here"
$env:DB_USER="ciphertrust_app"
$env:DB_PASSWORD="paste_your_db_password_here"
$env:DB_HOST="localhost"
$env:DB_NAME="ciphertrust_lite"
```

**Important**: these variables only last for this terminal tab. If you
close it, you'll need to re-run these six lines before starting the
server again — and you must use the *same* master key each time, or
previously encrypted data becomes unreadable.

### 5. Run the server
Still in the same terminal tab (the one with the env vars set):
```powershell
python -m uvicorn app.main:app --reload --port 8000
```
You're looking for `Uvicorn running on http://0.0.0.0:8000`. Leave this
terminal running — it's your server now. Open a **second** terminal tab
(`Ctrl+Shift+` `` ` `` in VS Code) for testing, since this one will be busy.

Interactive API docs (Swagger UI) will be at `http://localhost:8000/docs`.

## Troubleshooting

**`mysql` not recognized**: MySQL's `bin` folder isn't on PATH. Find it
(commonly `C:\Program Files\MySQL\MySQL Server 8.0\bin`), then either run
`$env:Path += ";<that path>"` for a temporary fix, or add it permanently
via Windows' "Edit environment variables" settings panel, then restart
VS Code.

**`uvicorn` not recognized**: use `python -m uvicorn ...` instead of
`uvicorn ...` directly — this runs uvicorn through Python, which avoids
the PATH issue entirely.

**`Get-Content : Cannot find path ...schema.sql`**: your terminal isn't
in the project folder. Run `cd` to navigate there first, e.g.
`cd "C:\Users\<you>\Desktop\ciphertrust-lite"`.

**Using `curl` in PowerShell prompts a security warning**: PowerShell's
`curl` is secretly aliased to `Invoke-WebRequest`, which isn't built for
quick API calls. Use `Invoke-RestMethod` instead — see Example usage below.

## Example usage (PowerShell)

**Create an employee** (plaintext in the request, ciphertext in the DB):
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

**Read it back** (server decrypts automatically):
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/employees/1" -Headers @{"X-API-Key"="your_api_key"}
```

**Check the raw DB row** (should be ciphertext, never plaintext):
```powershell
mysql -u root -p -e "SELECT ssn_encrypted, salary_encrypted, bank_account_encrypted FROM ciphertrust_lite.employees WHERE id = 1;"
```

## Audit logging

Every INSERT/SELECT/UPDATE/DELETE against `/employees` writes a row to
`audit_logs` (operation, table name, record id, timestamp). View the full
trail:
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/audit-logs" -Headers @{"X-API-Key"="your_api_key"}
```

This is the same idea behind DAM (Database Activity Monitoring) tools like
Imperva — record what happened, independent of whether it succeeded.

Not included yet: per-user attribution (who made the request), key
rotation, and RBAC enforcement. These are reasonable next steps but out of
scope for this version.

## Known limitations (worth stating explicitly in your write-up)

1. **No search on encrypted columns.** AES-GCM uses a random nonce per
   encryption, so encrypting the same SSN twice produces different
   ciphertext both times. You cannot do `WHERE ssn_encrypted = ?` — this is
   the same tradeoff real column-level/tokenization products face, and
   CipherTrust's actual tokenization features exist partly to solve it
   (format-preserving tokens that *can* be looked up).
2. **Single master key, no rotation.** Real CipherTrust supports key
   versioning and rotation without re-encrypting all data immediately. This
   PoC uses one static key for simplicity.
3. **API key is a flat shared secret**, not per-client identity or scoped
   permissions — a real system would want per-client keys and audit logging
   of who decrypted what.
4. **No HSM.** The master key lives in an environment variable, not
   hardware-protected storage. Acceptable for a PoC; not acceptable for
   production handling of real PII.

This list is the kind of thing that makes a presentation land better — it
shows you understand *why* the real product is shaped the way it is, not
just that you copied its surface behavior.

## Project structure
```
ciphertrust-lite/
├── app/
│   ├── crypto_engine.py   # AES-256-GCM encrypt/decrypt
│   ├── database.py        # SQLAlchemy connection layer
│   └── main.py             # FastAPI routes + audit logging
├── schema.sql              # employees + audit_logs tables
├── .env.example             # Template for required environment variables (safe to commit)
├── .gitignore               # Excludes .env so real secrets never get committed
└── README.md
```
