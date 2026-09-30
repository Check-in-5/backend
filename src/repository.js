import { DatabaseSync as base_dato_sincrona } from 'node:sqlite';
import { mkdirSync as crear_directorio, readFileSync as leer_archivo } from 'node:fs';
import { dirname as obtener_directorio, resolve as resolver_ruta } from 'node:path';
export function crear_repositorio(ruta_archivo = 'data/checkin.sqlite') {
  if (ruta_archivo !== ':memory:') crear_directorio(obtener_directorio(resolver_ruta(ruta_archivo)), { recursive: true });
  const base_dato = new base_dato_sincrona(ruta_archivo);
  try {
    base_dato.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;');
    base_dato.exec(leer_archivo(new URL('../docs/schema.sql', import.meta.url), 'utf8'));
    const insertar = base_dato.prepare('INSERT INTO tickets (id_entrada, id_evento, nombre_usuario) VALUES (?, ?, ?) ON CONFLICT(id_entrada) DO NOTHING');
    const consulta = base_dato.prepare('SELECT id_entrada, id_evento, nombre_usuario FROM tickets WHERE id_entrada = ?');
    return {
      insertar(entrada) { return insertar.run(entrada.id_entrada, entrada.id_evento, entrada.nombre_usuario).changes === 1; },
      buscar_por_id(id) { const fila = consulta.get(id); return fila ? { ...fila } : null; },
      cerrar() { base_dato.close(); },
    };
  } catch (error) { base_dato.close(); throw error; }
}
