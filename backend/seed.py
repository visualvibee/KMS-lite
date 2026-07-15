import os
from dotenv import load_dotenv

load_dotenv()

from app.database import run_query, run_write
from app.auth import hash_password

def seed():
    existing = run_query("SELECT id FROM users WHERE username = 'admin'")
    if existing:
        print("Admin user already exists, skipping seed.")
        return

    run_write(
        "INSERT INTO users (username, password_hash, role) VALUES (:username, :password_hash, :role)",
        {
            "username": "admin",
            "password_hash": hash_password("Admin123!"),
            "role": "admin",
        },
    )
    print("Default admin user created: admin / Admin123!")
    print("IMPORTANT: Change this password immediately after first login.")

if __name__ == "__main__":
    seed()