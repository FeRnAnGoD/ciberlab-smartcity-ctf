-- ============================================================
--  Planta Gas CTF  -  Script de inicializacion MariaDB
--  Uso: sudo mariadb < planta_gas_mariadb.sql
--       (o: mariadb -u root -p < planta_gas_mariadb.sql)
-- ============================================================

CREATE DATABASE IF NOT EXISTS planta_gas
    CHARACTER SET  utf8mb4
    COLLATE        utf8mb4_unicode_ci;

USE planta_gas;

-- Tabla: users
CREATE TABLE IF NOT EXISTS users (
    id       INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(80)  NOT NULL,
    email    VARCHAR(120) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role     VARCHAR(20)  NOT NULL DEFAULT 'user'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: messages
CREATE TABLE IF NOT EXISTS messages (
    id      INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    sender  VARCHAR(50)  NOT NULL,
    content TEXT         NOT NULL,
    fecha   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id INT          NULL,
    CONSTRAINT fk_messages_user FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed admin  (admin@ciberlab.cl / admin123)
INSERT IGNORE INTO users (username, email, password, role)
VALUES (
    'Admin Supremo',
    'admin@ciberlab.cl',
    '$2b$12$erAbfJvTRubTsEBJFBTooOa9stIu3CYUWo6FALaVVU5udmBze1hAy',
    'admin'
);

SELECT 'Listo! Base de datos planta_gas inicializada.' AS resultado;
SELECT * FROM users;
