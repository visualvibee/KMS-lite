CREATE DATABASE IF NOT EXISTS ciphertrust_lite;
USE ciphertrust_lite;

DROP TABLE IF EXISTS employees;

CREATE TABLE employees (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100)  NOT NULL,
    department      VARCHAR(100)  NOT NULL,
    email           VARCHAR(150)  NOT NULL UNIQUE,
    ssn_encrypted           TEXT NOT NULL,
    salary_encrypted        TEXT NOT NULL,
    bank_account_encrypted  TEXT NOT NULL,
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