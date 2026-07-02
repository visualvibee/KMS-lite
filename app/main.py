import os
from typing import Optional
from pathlib import Path

from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, EmailStr, Field

from app import crypto_engine
from app.database import run_query, run_write

app = FastAPI(
    title="KMS-Lite",
    description="Column-level encryption gateway for MySQL",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

VALID_API_KEYS = set(
    filter(None, os.environ.get("KMS_LITE_API_KEYS", "").split(","))
)


def require_api_key(x_api_key: Optional[str] = Header(default=None)):
    if not VALID_API_KEYS:
        raise HTTPException(status_code=500, detail="No API keys configured")
    if x_api_key not in VALID_API_KEYS:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return x_api_key


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


class EmployeeOut(BaseModel):
    id: int
    name: str
    department: str
    email: str
    ssn: str
    salary: float
    bank_account: str
    key_id: str


def _decrypt_row(row: dict) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "department": row["department"],
        "email": row["email"],
        "ssn": crypto_engine.decrypt_value(row["ssn_encrypted"]),
        "salary": float(crypto_engine.decrypt_value(row["salary_encrypted"])),
        "bank_account": crypto_engine.decrypt_value(row["bank_account_encrypted"]),
        "key_id": row["key_id"],
    }


def log_audit(operation: str, table_name: str, record_id: Optional[int] = None):
    run_write(
        """
        INSERT INTO audit_logs (operation, table_name, record_id)
        VALUES (:operation, :table_name, :record_id)
        """,
        {"operation": operation, "table_name": table_name, "record_id": record_id},
    )


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/ui", response_class=HTMLResponse)
def ui():
    html = (Path(__file__).parent.parent / "static" / "index.html").read_text(encoding="utf-8")
    return HTMLResponse(content=html)


@app.post("/employees", response_model=EmployeeOut, status_code=201)
def create_employee(payload: EmployeeCreate, api_key: str = Depends(require_api_key)):
    ssn_enc = crypto_engine.encrypt_value(payload.ssn)
    salary_enc = crypto_engine.encrypt_value(str(payload.salary))
    bank_enc = crypto_engine.encrypt_value(payload.bank_account)

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
            "key_id": crypto_engine.CURRENT_KEY_ID,
        },
    )
    new_id = result.lastrowid
    log_audit("INSERT", "employees", new_id)

    rows = run_query("SELECT * FROM employees WHERE id = :id", {"id": new_id})
    return _decrypt_row(rows[0])


@app.get("/employees/{employee_id}", response_model=EmployeeOut)
def get_employee(employee_id: int, api_key: str = Depends(require_api_key)):
    rows = run_query("SELECT * FROM employees WHERE id = :id", {"id": employee_id})
    if not rows:
        raise HTTPException(status_code=404, detail="Employee not found")
    log_audit("SELECT", "employees", employee_id)
    return _decrypt_row(rows[0])


@app.get("/employees", response_model=list[EmployeeOut])
def list_employees(
    department: Optional[str] = None, api_key: str = Depends(require_api_key)
):
    if department:
        rows = run_query(
            "SELECT * FROM employees WHERE department = :dept", {"dept": department}
        )
    else:
        rows = run_query("SELECT * FROM employees")
    log_audit("SELECT", "employees", None)
    return [_decrypt_row(r) for r in rows]


@app.put("/employees/{employee_id}", response_model=EmployeeOut)
def update_employee(
    employee_id: int,
    payload: EmployeeUpdate,
    api_key: str = Depends(require_api_key),
):
    existing = run_query("SELECT * FROM employees WHERE id = :id", {"id": employee_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Employee not found")

    updates = {}
    if payload.name is not None:
        updates["name"] = payload.name
    if payload.department is not None:
        updates["department"] = payload.department
    if payload.email is not None:
        updates["email"] = payload.email
    if payload.ssn is not None:
        updates["ssn_encrypted"] = crypto_engine.encrypt_value(payload.ssn)
    if payload.salary is not None:
        updates["salary_encrypted"] = crypto_engine.encrypt_value(str(payload.salary))
    if payload.bank_account is not None:
        updates["bank_account_encrypted"] = crypto_engine.encrypt_value(payload.bank_account)

    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    set_clause = ", ".join(f"{col} = :{col}" for col in updates)
    updates["id"] = employee_id
    run_write(f"UPDATE employees SET {set_clause} WHERE id = :id", updates)
    log_audit("UPDATE", "employees", employee_id)

    rows = run_query("SELECT * FROM employees WHERE id = :id", {"id": employee_id})
    return _decrypt_row(rows[0])


@app.delete("/employees/{employee_id}", status_code=204)
def delete_employee(employee_id: int, api_key: str = Depends(require_api_key)):
    existing = run_query("SELECT * FROM employees WHERE id = :id", {"id": employee_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Employee not found")
    run_write("DELETE FROM employees WHERE id = :id", {"id": employee_id})
    log_audit("DELETE", "employees", employee_id)
    return None


@app.get("/audit-logs")
def list_audit_logs(api_key: str = Depends(require_api_key)):
    return run_query("SELECT * FROM audit_logs ORDER BY timestamp DESC")


@app.get("/encryption-keys")
def list_encryption_keys(api_key: str = Depends(require_api_key)):
    return run_query("SELECT * FROM encryption_keys ORDER BY created_at DESC")

@app.post("/encryption-keys/generate")
def generate_key(api_key: str = Depends(require_api_key)):
    import uuid
    key_id = f"kms-key-{uuid.uuid4().hex[:8]}"
    run_write(
        "INSERT INTO encryption_keys (key_id, algorithm, status) VALUES (:key_id, 'AES-256-GCM', 'active')",
        {"key_id": key_id},
    )
    rows = run_query("SELECT * FROM encryption_keys WHERE key_id = :key_id", {"key_id": key_id})
    return rows[0]