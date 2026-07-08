import os
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

DB_USER = os.environ.get("DB_USER", "root")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "")
DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = os.environ.get("DB_PORT", "3306")
DB_NAME = os.environ.get("DB_NAME", "kms_lite")

DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"


_engine: Engine | None = None


def get_engine():
    global _engine

    if _engine is None:
        print(f"Creating engine: {DATABASE_URL}")

        _engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            echo=True,
        )

        # Test the connection immediately
        with _engine.connect() as conn:
            print("SUCCESS: SQLAlchemy connected!")
            print(conn.execute(text("SELECT CURRENT_USER()")).scalar())

    return _engine


def run_query(sql: str, params: dict | None = None):
    engine = get_engine()
    with engine.connect() as conn:
        result = conn.execute(text(sql), params or {})
        return [dict(row._mapping) for row in result]


def run_write(sql: str, params: dict | None = None):
    engine = get_engine()
    with engine.connect() as conn:
        result = conn.execute(text(sql), params or {})
        conn.commit()
        return result