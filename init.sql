CREATE DATABASE IF NOT EXISTS checkin_db;
USE checkin_db;

CREATE TABLE IF NOT EXISTS ticket (
    id_entrada VARCHAR(255) PRIMARY KEY,
    id_evento VARCHAR(255) NOT NULL,
    id_usuario VARCHAR(255) NOT NULL, 
    nombre_usuario VARCHAR(255) NOT NULL,
    qr_data JSON NOT NULL,
    estado VARCHAR(50) DEFAULT 'PENDIENTE',
    fecha_sincronizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS registro_asistencia (
    id_asistencia INT AUTO_INCREMENT PRIMARY KEY,
    id_entrada VARCHAR(255) NOT NULL,
    id_evento VARCHAR(255) NOT NULL,
    id_usuario VARCHAR(255) NOT NULL,
    fecha_checkin TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_entrada) REFERENCES ticket(id_entrada)
);

CREATE TABLE IF NOT EXISTS evento_local (
    id_evento VARCHAR(255) PRIMARY KEY,
    nombre_evento VARCHAR(255) NOT NULL,
    direccion_evento VARCHAR(255) NOT NULL,
    fecha_evento DATE NOT NULL,
    hora_evento TIME NOT NULL,
    hora_fin_evento TIME NOT NULL,
    estado_gestion VARCHAR(50) NOT NULL,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);