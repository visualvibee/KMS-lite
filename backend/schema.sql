CREATE DATABASE IF NOT EXISTS kms_lite;
USE kms_lite;

DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS encryption_keys;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS users;

CREATE TABLE encryption_keys (
    key_id      VARCHAR(50) PRIMARY KEY,
    algorithm   VARCHAR(50) NOT NULL DEFAULT 'AES-256-GCM',
    status      ENUM('pending_activation', 'active', 'suspended', 'retired', 'compromised') NOT NULL DEFAULT 'pending_activation',
    wrapped_key TEXT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO encryption_keys (key_id, algorithm, status, wrapped_key)
VALUES ('kms-master-v1', 'AES-256-GCM', 'active', NULL);

CREATE TABLE employees (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    name                    VARCHAR(100) NOT NULL,
    department              VARCHAR(100) NOT NULL,
    email                   VARCHAR(150) NOT NULL UNIQUE,
    ssn_encrypted           TEXT NOT NULL,
    salary_encrypted        TEXT NOT NULL,
    bank_account_encrypted  TEXT NOT NULL,
    key_id                  VARCHAR(50) NOT NULL DEFAULT 'kms-master-v1',
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (key_id) REFERENCES encryption_keys(key_id)
);

CREATE INDEX idx_department ON employees(department);

CREATE TABLE audit_logs (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    operation    ENUM('INSERT', 'SELECT', 'UPDATE', 'DELETE') NOT NULL,
    table_name   VARCHAR(100) NOT NULL,
    record_id    INT NULL,
    performed_by VARCHAR(100) NULL,
    timestamp    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_operation ON audit_logs(operation);

CREATE TABLE users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('admin', 'hr', 'analyst', 'keymanager') NOT NULL DEFAULT 'analyst',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS db_audit_log;

CREATE TABLE db_audit_log (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    operation   ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
    employee_id INT NOT NULL,
    db_user     VARCHAR(100) NOT NULL,
    changed_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_employees_insert;
DROP TRIGGER IF EXISTS trg_employees_update;
DROP TRIGGER IF EXISTS trg_employees_delete;

DELIMITER $$

CREATE TRIGGER trg_employees_insert
AFTER INSERT ON employees
FOR EACH ROW
BEGIN
    INSERT INTO db_audit_log (operation, employee_id, db_user)
    VALUES ('INSERT', NEW.id, CURRENT_USER());
END$$

CREATE TRIGGER trg_employees_update
AFTER UPDATE ON employees
FOR EACH ROW
BEGIN
    INSERT INTO db_audit_log (operation, employee_id, db_user)
    VALUES ('UPDATE', NEW.id, CURRENT_USER());
END$$

CREATE TRIGGER trg_employees_delete
AFTER DELETE ON employees
FOR EACH ROW
BEGIN
    INSERT INTO db_audit_log (operation, employee_id, db_user)
    VALUES ('DELETE', OLD.id, CURRENT_USER());
END$$

DELIMITER ;