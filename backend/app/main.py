import os
import uuid
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field

from app import crypto_engine
from app.database import run_query, run_write
from app.auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_roles
)

app = FastAPI(title="KMS-Lite", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------
# AUTH
# --------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    role: str = "analyst"


@app.post("/auth/login")
def login(payload: LoginRequest):
    rows = run_query(
        "SELECT * FROM users WHERE username = :username",
        {"username": payload.username},
    )
    if not rows or not verify_password(payload.password, rows[0]["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    user = rows[0]
    token = create_access_token({"sub": str(user["id"]), "role": user["role"]})
    return {
        "token": token,
        "user": {"id": user["id"], "username": user["username"], "role": user["role"]},
    }


@app.post("/auth/register")
def register(payload: RegisterRequest):
    existing = run_query(
        "SELECT id FROM users WHERE username = :username",
        {"username": payload.username},
    )
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    valid_roles = ["admin", "hr", "analyst", "keymanager"]
    if payload.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Choose from: {valid_roles}")

    run_write(
        "INSERT INTO users (username, password_hash, role) VALUES (:username, :password_hash, :role)",
        {
            "username": payload.username,
            "password_hash": hash_password(payload.password),
            "role": payload.role,
        },
    )
    return {"message": f"User '{payload.username}' created with role '{payload.role}'"}


@app.get("/auth/me")
def me(current_user: dict = Depends(get_current_user)):
    return current_user


# --------------------------------------------------------------------------
# HEALTH
# --------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}


# --------------------------------------------------------------------------
# HELPERS
# --------------------------------------------------------------------------

def _get_wrapped_key(key_id: str) -> str | None:
    rows = run_query(
        "SELECT wrapped_key FROM encryption_keys WHERE key_id = :key_id",
        {"key_id": key_id},
    )
    if not rows:
        return None
    return rows[0]["wrapped_key"]


def _decrypt_row(row: dict) -> dict:
    wrapped_key = _get_wrapped_key(row["key_id"])
    return {
        "id": row["id"],
        "name": row["name"],
        "department": row["department"],
        "email": row["email"],
        "ssn": crypto_engine.decrypt_value(row["ssn_encrypted"], wrapped_key),
        "salary": float(crypto_engine.decrypt_value(row["salary_encrypted"], wrapped_key)),
        "bank_account": crypto_engine.decrypt_value(row["bank_account_encrypted"], wrapped_key),
        "key_id": row["key_id"],
    }


def log_audit(
    operation: str,
    table_name: str,
    record_id: Optional[int] = None,
    performed_by: Optional[str] = None,
):
    run_write(
        """
        INSERT INTO audit_logs (operation, table_name, record_id, performed_by)
        VALUES (:operation, :table_name, :record_id, :performed_by)
        """,
        {
            "operation": operation,
            "table_name": table_name,
            "record_id": record_id,
            "performed_by": performed_by,
        },
    )


# --------------------------------------------------------------------------
# EMPLOYEES
# --------------------------------------------------------------------------

class EmployeeCreate(BaseModel):
    name: str = Field(..., max_length=100)
    department: str = Field(..., max_length=100)
    email: EmailStr
    ssn: str
    salary: float = Field(..., gt=0)
    bank_account: str


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    email: Optional[EmailStr] = None
    ssn: Optional[str] = None
    salary: Optional[float] = None
    bank_account: Optional[str] = None


@app.post("/employees", status_code=201)
def create_employee(
    payload: EmployeeCreate,
    current_user: dict = Depends(require_roles("admin", "hr")),
):
    active_keys = run_query(
        "SELECT key_id, wrapped_key FROM encryption_keys WHERE status = 'active' ORDER BY created_at DESC LIMIT 1"
    )
    if not active_keys:
        raise HTTPException(
            status_code=400,
            detail="No active encryption key found. Generate and activate a key first."
        )

    active_key = active_keys[0]
    key_id = active_key["key_id"]
    wrapped_key = active_key["wrapped_key"]

    ssn_enc = crypto_engine.encrypt_value(payload.ssn, wrapped_key)
    salary_enc = crypto_engine.encrypt_value(str(payload.salary), wrapped_key)
    bank_enc = crypto_engine.encrypt_value(payload.bank_account, wrapped_key)

    result = run_write(
        """
        INSERT INTO employees (name, department, email, ssn_encrypted,
                                salary_encrypted, bank_account_encrypted, key_id)
        VALUES (:name, :department, :email, :ssn_enc, :salary_enc, :bank_enc, :key_id)
        """,
        {
            "name": payload.name,
            "department": payload.department,
            "email": payload.email,
            "ssn_enc": ssn_enc,
            "salary_enc": salary_enc,
            "bank_enc": bank_enc,
            "key_id": key_id,
        },
    )
    new_id = result.lastrowid
    log_audit("INSERT", "employees", new_id, current_user["username"])
    rows = run_query("SELECT * FROM employees WHERE id = :id", {"id": new_id})
    return _decrypt_row(rows[0])


@app.get("/employees/{employee_id}")
def get_employee(
    employee_id: int,
    current_user: dict = Depends(require_roles("admin", "hr", "analyst")),
):
    rows = run_query("SELECT * FROM employees WHERE id = :id", {"id": employee_id})
    if not rows:
        raise HTTPException(status_code=404, detail="Employee not found")
    log_audit("SELECT", "employees", employee_id, current_user["username"])
    return _decrypt_row(rows[0])


@app.get("/employees")
def list_employees(
    department: Optional[str] = None,
    current_user: dict = Depends(require_roles("admin", "hr", "analyst")),
):
    if department:
        rows = run_query(
            "SELECT * FROM employees WHERE department = :dept", {"dept": department}
        )
    else:
        rows = run_query("SELECT * FROM employees")
    log_audit("SELECT", "employees", None, current_user["username"])
    return [_decrypt_row(r) for r in rows]


@app.put("/employees/{employee_id}")
def update_employee(
    employee_id: int,
    payload: EmployeeUpdate,
    current_user: dict = Depends(require_roles("admin", "hr")),
):
    existing = run_query("SELECT * FROM employees WHERE id = :id", {"id": employee_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Employee not found")

    wrapped_key = _get_wrapped_key(existing[0]["key_id"])

    updates = {}
    if payload.name is not None:
        updates["name"] = payload.name
    if payload.department is not None:
        updates["department"] = payload.department
    if payload.email is not None:
        updates["email"] = payload.email
    if payload.ssn is not None:
        updates["ssn_encrypted"] = crypto_engine.encrypt_value(payload.ssn, wrapped_key)
    if payload.salary is not None:
        updates["salary_encrypted"] = crypto_engine.encrypt_value(str(payload.salary), wrapped_key)
    if payload.bank_account is not None:
        updates["bank_account_encrypted"] = crypto_engine.encrypt_value(payload.bank_account, wrapped_key)

    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    set_clause = ", ".join(f"{col} = :{col}" for col in updates)
    updates["id"] = employee_id
    run_write(f"UPDATE employees SET {set_clause} WHERE id = :id", updates)
    log_audit("UPDATE", "employees", employee_id, current_user["username"])

    rows = run_query("SELECT * FROM employees WHERE id = :id", {"id": employee_id})
    return _decrypt_row(rows[0])


@app.delete("/employees/{employee_id}", status_code=204)
def delete_employee(
    employee_id: int,
    current_user: dict = Depends(require_roles("admin")),
):
    existing = run_query("SELECT * FROM employees WHERE id = :id", {"id": employee_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Employee not found")
    run_write("DELETE FROM employees WHERE id = :id", {"id": employee_id})
    log_audit("DELETE", "employees", employee_id, current_user["username"])
    return None


# --------------------------------------------------------------------------
# AUDIT LOGS
# --------------------------------------------------------------------------

@app.get("/audit-logs")
def list_audit_logs(
    current_user: dict = Depends(require_roles("admin", "analyst")),
):
    return run_query("SELECT * FROM audit_logs ORDER BY timestamp DESC")


# --------------------------------------------------------------------------
# ENCRYPTION KEYS
# --------------------------------------------------------------------------

@app.get("/encryption-keys")
def list_encryption_keys(
    current_user: dict = Depends(require_roles("admin", "keymanager")),
):
    return run_query(
        "SELECT key_id, algorithm, status, created_at FROM encryption_keys ORDER BY created_at DESC"
    )


@app.post("/encryption-keys/generate")
def generate_key(
    current_user: dict = Depends(require_roles("admin", "keymanager")),
):
    raw_dek = crypto_engine.generate_dek()
    wrapped = crypto_engine.wrap_key(raw_dek)
    key_id = f"kms-key-{uuid.uuid4().hex[:8]}"

    run_write(
        """
        INSERT INTO encryption_keys (key_id, algorithm, status, wrapped_key)
        VALUES (:key_id, 'AES-256-GCM', 'pending_activation', :wrapped_key)
        """,
        {"key_id": key_id, "wrapped_key": wrapped},
    )
    rows = run_query(
        "SELECT key_id, algorithm, status, created_at FROM encryption_keys WHERE key_id = :key_id",
        {"key_id": key_id},
    )
    return rows[0]


@app.put("/encryption-keys/{key_id}/state")
def update_key_state(
    key_id: str,
    payload: dict,
    current_user: dict = Depends(require_roles("admin", "keymanager")),
):
    valid_states = ["pending_activation", "active", "suspended", "retired", "compromised"]
    new_state = payload.get("status")
    if new_state not in valid_states:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid state. Choose from: {valid_states}"
        )

    existing = run_query(
        "SELECT * FROM encryption_keys WHERE key_id = :key_id", {"key_id": key_id}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Key not found")

    run_write(
        "UPDATE encryption_keys SET status = :status WHERE key_id = :key_id",
        {"status": new_state, "key_id": key_id},
    )
    rows = run_query(
        "SELECT key_id, algorithm, status, created_at FROM encryption_keys WHERE key_id = :key_id",
        {"key_id": key_id},
    )
    return rows[0]