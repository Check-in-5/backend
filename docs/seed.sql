-- Datos de prueba estandarizados para el Platform Team
-- Se utiliza INSERT IGNORE para permitir la ejecución múltiple sin errores de duplicidad

INSERT IGNORE INTO ticket (id_entrada, id_evento, id_usuario, nombre_usuario, qr_data) VALUES 
('tk-valido-01', 'evt-concierto-01', 'usr-100', 'Walter Castillo', '"tk-valido-01"'),
('tk-valido-02', 'evt-concierto-01', 'usr-101', 'Juan Barraza', '"tk-valido-02"'),
('tk-vip-01', 'evt-concierto-01', 'usr-102', 'Sebastian Fuentes', '"tk-vip-01"'),
('tk-otro-evento', 'evt-teatro-99', 'usr-103', 'Usuario Prueba', '"tk-otro-evento"');