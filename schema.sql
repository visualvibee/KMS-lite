CREATE DATABASE IF NOT EXISTS kms_lite;
USE kms_lite;

DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS encryption_keys;

CREATE TABLE encryption_keys (
    key_id          VARCHAR(50) PRIMARY KEY,
    algorithm       VARCHAR(50) NOT NULL DEFAULT 'AES-256-GCM',
    status          ENUM('active', 'retired', 'compromised') NOT NULL DEFAULT 'active',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO encryption_keys (key_id, algorithm, status)
VALUES ('kms-master-v1', 'AES-256-GCM', 'active');

CREATE TABLE employees (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100)  NOT NULL,
    department      VARCHAR(100)  NOT NULL,
    email           VARCHAR(150)  NOT NULL UNIQUE,
    ssn_encrypted           TEXT NOT NULL,
    salary_encrypted        TEXT NOT NULL,
    bank_account_encrypted  TEXT NOT NULL,
    key_id          VARCHAR(50) NOT NULL DEFAULT 'kms-master-v1' REFERENCES encryption_keys(key_id),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_department ON employees(department);


DROP TABLE IF EXISTS audit_logs;

CREATE TABLE audit_logs (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    operation       ENUM('INSERT', 'SELECT', 'UPDATE', 'DELETE') NOT NULL,
    table_name      VARCHAR(100) NOT NULL,
    record_id       INT NULL,
    timestamp       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_operation ON audit_logs(operation);