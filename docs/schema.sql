-- Adaptador SQLite local, reemplazable por el esquema del responsable de BD.
-- id_entrada: identificador externo único y contenido textual del QR.
-- id_evento: referencia externa al evento (no FK a otra base).
-- nombre_usuario: nombre recibido de Entradas para mostrar en portería.
CREATE TABLE IF NOT EXISTS tickets (
  id_entrada TEXT PRIMARY KEY NOT NULL CHECK(length(trim(id_entrada)) BETWEEN 1 AND 128),
  id_evento TEXT NOT NULL CHECK(length(trim(id_evento)) BETWEEN 1 AND 128),
  nombre_usuario TEXT NOT NULL CHECK(length(trim(nombre_usuario)) BETWEEN 1 AND 200)
);
