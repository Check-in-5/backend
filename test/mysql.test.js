import { test as prueba } from 'node:test';
import verificacion from 'node:assert/strict';
import { randomUUID as crear_id } from 'node:crypto';
import { createPool as crear_pool } from 'mysql2/promise';
import { crear_repositorio_mysql } from '../src/repository-mysql.js';

prueba('MySQL: persiste, rechaza duplicados y parametriza consultas', { skip: process.env.TEST_MYSQL !== '1' }, async () => {
  const entrada = {
    id_entrada: 'test-' + crear_id(), id_evento: 'evt-test',
    id_usuario: 'usr-test', nombre_usuario: 'Prueba MySQL',
  };
  let repositorio;
  try {
    repositorio = await crear_repositorio_mysql();
    const resultado = await Promise.all(Array.from({ length: 5 }, () => repositorio.insertar({ ...entrada, qr_data: entrada.id_entrada })));
    verificacion.equal(resultado.filter(Boolean).length, 1);
    await repositorio.cerrar();
    repositorio = await crear_repositorio_mysql();
    verificacion.deepEqual(await repositorio.buscar_por_id(entrada.id_entrada), {
      id_entrada: entrada.id_entrada, id_evento: entrada.id_evento, nombre_usuario: entrada.nombre_usuario,
    });
    verificacion.equal(await repositorio.buscar_por_id("' OR 1=1 --"), null);
  } finally {
    if (repositorio) await repositorio.cerrar();
    const limpieza = crear_pool({
      host: process.env.DB_HOST ?? '127.0.0.1', port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER ?? 'checkin_user', password: process.env.DB_PASSWORD ?? 'checkin_password',
      database: process.env.DB_NAME ?? 'checkin_db',
    });
    try { await limpieza.execute('DELETE FROM ticket WHERE id_entrada = ?', [entrada.id_entrada]); }
    finally { await limpieza.end(); }
  }
});