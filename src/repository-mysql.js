import { createPool as crear_pool } from 'mysql2/promise';

// La tabla y sus índices se crean mediante init.sql en el contenedor de MySQL.
export async function crear_repositorio_mysql(configuracion = {}) {
  const base_dato = crear_pool({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'checkin_user',
    password: process.env.DB_PASSWORD ?? 'checkin_password',
    database: process.env.DB_NAME ?? 'checkin_db',
    waitForConnections: true,
    connectionLimit: 10,
    ...configuracion,
  });
  try {
    await base_dato.query('SELECT 1 FROM ticket LIMIT 1');
    return {
      async insertar(entrada) {
        try {
          await base_dato.execute(
            'INSERT INTO ticket (id_entrada, id_evento, id_usuario, nombre_usuario, qr_data) VALUES (?, ?, ?, ?, ?)',
            [entrada.id_entrada, entrada.id_evento, entrada.id_usuario, entrada.nombre_usuario, JSON.stringify(entrada.qr_data)],
          );
          return true;
        } catch (error) {
          if (error.code === 'ER_DUP_ENTRY') return false;
          throw error;
        }
      },
      async buscar_por_id(id) {
        const [fila_conjunto] = await base_dato.execute(
          'SELECT id_entrada, id_evento, nombre_usuario FROM ticket WHERE id_entrada = ?', [id],
        );
        return fila_conjunto[0] ? { ...fila_conjunto[0] } : null;
      },
      async cerrar() { await base_dato.end(); },
    };
  } catch (error) {
    await base_dato.end();
    throw error;
  }
}