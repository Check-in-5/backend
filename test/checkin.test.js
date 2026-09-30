import { test as prueba } from 'node:test';
import verificacion from 'node:assert/strict';
import { once as esperar_evento } from 'node:events';
import { mkdtempSync as crear_directorio_temporal, rmSync as eliminar_ruta } from 'node:fs';
import { tmpdir as obtener_directorio_temporal } from 'node:os';
import { join as unir_ruta } from 'node:path';
import { crear_app } from '../src/app.js';
import { crear_repositorio } from '../src/repository.js';

const entrada = { id_entrada: 'tk-998877', id_evento: 'evt-77889', nombre_usuario: 'Sebastián Fuentes' };
const lectura = { id_entrada: entrada.id_entrada, id_evento: entrada.id_evento };
async function iniciar_servidor(contexto, repositorio = crear_repositorio(':memory:'), cerrar = true) {
  const servidor = crear_app({ repositorio }).listen(0, '127.0.0.1');
  await esperar_evento(servidor, 'listening');
  contexto.after(async () => {
    await new Promise(resolver => { servidor.close(resolver); servidor.closeAllConnections(); });
    if (cerrar) repositorio.cerrar();
  });
  return 'http://127.0.0.1:' + servidor.address().port;
}
async function enviar_solicitud(url_base, ruta, cuerpo) {
  const respuesta = await fetch(url_base + '/api/v1/checkin/' + ruta, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
  });
  return { status: respuesta.status, body: await respuesta.json() };
}
prueba('registra y valida sin Auth ni dependencias externas; repetir no consume', async contexto => {
  const url_base = await iniciar_servidor(contexto);
  verificacion.equal((await enviar_solicitud(url_base, 'tickets', entrada)).status, 201);
  const resultado = await enviar_solicitud(url_base, 'validaciones', lectura);
  verificacion.deepEqual(resultado, { status: 200, body: { valido: true, motivo: 'TICKET_FOUND', ticket: entrada } });
  verificacion.deepEqual(await enviar_solicitud(url_base, 'validaciones', lectura), resultado);
});
prueba('QR opcional acepta solo el mismo ID', async contexto => {
  const url_base = await iniciar_servidor(contexto);
  verificacion.equal((await enviar_solicitud(url_base, 'tickets', { ...entrada, qr_data: 'https://example.com/qr.png' })).status, 400);
  verificacion.equal((await enviar_solicitud(url_base, 'tickets', { ...entrada, qr_data: entrada.id_entrada })).status, 201);
});
prueba('duplicado no sobrescribe y rechaza conflicto de evento', async contexto => {
  const url_base = await iniciar_servidor(contexto);
  await enviar_solicitud(url_base, 'tickets', entrada);
  const duplicado = await enviar_solicitud(url_base, 'tickets', { ...entrada, id_evento: 'otro', nombre_usuario: 'Otro' });
  verificacion.equal(duplicado.status, 409);
  verificacion.equal(duplicado.body.error.code, 'TICKET_ALREADY_EXISTS');
  verificacion.deepEqual((await enviar_solicitud(url_base, 'validaciones', lectura)).body.ticket, entrada);
});
prueba('registros concurrentes: una creación y el resto duplicados', async contexto => {
  const url_base = await iniciar_servidor(contexto);
  const resultado_conjunto = await Promise.all(Array.from({ length: 8 }, () => enviar_solicitud(url_base, 'tickets', entrada)));
  verificacion.equal(resultado_conjunto.filter(resultado => resultado.status === 201).length, 1);
  verificacion.equal(resultado_conjunto.filter(resultado => resultado.status === 409).length, 7);
});
prueba('desconocido y evento incorrecto no exponen datos personales', async contexto => {
  const url_base = await iniciar_servidor(contexto);
  verificacion.deepEqual((await enviar_solicitud(url_base, 'validaciones', lectura)).body, { valido: false, motivo: 'TICKET_NOT_FOUND' });
  await enviar_solicitud(url_base, 'tickets', entrada);
  verificacion.deepEqual((await enviar_solicitud(url_base, 'validaciones', { ...lectura, id_evento: 'otro' })).body, { valido: false, motivo: 'EVENT_MISMATCH' });
});
for (const [nombre, ruta, cuerpo] of [
  ['sin campos', 'tickets', {}],
  ['nombre faltante', 'tickets', lectura],
  ['ID numérico', 'tickets', { ...entrada, id_entrada: 12 }],
  ['nombre vacío', 'tickets', { ...entrada, nombre_usuario: ' ' }],
  ['espacios en ID', 'tickets', { ...entrada, id_entrada: ' tk ' }],
  ['ID largo', 'tickets', { ...entrada, id_entrada: 'a'.repeat(129) }],
  ['campo extra', 'tickets', { ...entrada, estado: 'valido' }],
  ['campo heredado', 'tickets', { ...entrada, constructor: 'x' }],
  ['array', 'tickets', []],
  ['null', 'tickets', null],
  ['evento faltante', 'validaciones', { id_entrada: entrada.id_entrada }],
  ['campo extra en validación', 'validaciones', { ...lectura, qr: 'otro' }],
]) prueba('400: ' + nombre, async contexto => {
  const url_base = await iniciar_servidor(contexto);
  verificacion.equal((await enviar_solicitud(url_base, ruta, cuerpo)).status, 400);
});
prueba('JSON malformado y cuerpo grande', async contexto => {
  const url_base = await iniciar_servidor(contexto);
  for (const [cuerpo, esperado] of [['{', 400], [JSON.stringify({ qr: 'x'.repeat(17000) }), 413]]) {
    const respuesta = await fetch(url_base + '/api/v1/checkin/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo });
    verificacion.equal(respuesta.status, esperado);
  }
});
prueba('fallo BD devuelve 500 sin exponer detalles', async contexto => {
  const fallar = () => { throw new Error('clave privada de base de datos'); };
  const url_base = await iniciar_servidor(contexto, { insertar: fallar, buscar_por_id: fallar }, false);
  for (const [ruta, cuerpo] of [['tickets', entrada], ['validaciones', lectura]]) {
    const respuesta = await enviar_solicitud(url_base, ruta, cuerpo);
    verificacion.equal(respuesta.status, 500);
    verificacion.equal(respuesta.body.error.code, 'INTERNAL_ERROR');
    verificacion.ok(!JSON.stringify(respuesta).includes('clave privada'));
  }
});
prueba('persistencia: ticket disponible después de cerrar y reabrir SQLite', async contexto => {
  const directorio = crear_directorio_temporal(unir_ruta(obtener_directorio_temporal(), 'checkin-test-'));
  const ruta = unir_ruta(directorio, 'tickets.sqlite');
  const primero = crear_repositorio(ruta);
  try { verificacion.equal(primero.insertar(entrada), true); } finally { primero.cerrar(); }
  const segundo = crear_repositorio(ruta);
  const url_base = await iniciar_servidor(contexto, segundo);
  contexto.after(() => eliminar_ruta(directorio, { recursive: true, force: true }));
  verificacion.deepEqual((await enviar_solicitud(url_base, 'validaciones', lectura)).body.ticket, entrada);
});
prueba('identificadores se consultan como parámetros SQL', async contexto => {
  const url_base = await iniciar_servidor(contexto);
  await enviar_solicitud(url_base, 'tickets', entrada);
  const resultado = await enviar_solicitud(url_base, 'validaciones', { ...lectura, id_entrada: "' OR 1=1 --" });
  verificacion.equal(resultado.body.valido, false);
});
prueba('Swagger documenta ambos endpoints y el endpoint anterior se retiró', async contexto => {
  const url_base = await iniciar_servidor(contexto);
  verificacion.equal((await fetch(url_base + '/api-docs/')).status, 200);
  const especificacion = await (await fetch(url_base + '/openapi.json')).json();
  verificacion.equal(new URL(especificacion.servers[0].url, url_base).origin, url_base);
  verificacion.ok(especificacion.paths['/api/v1/checkin/tickets'].post.responses['201']);
  verificacion.ok(especificacion.paths['/api/v1/checkin/validaciones'].post.responses['200']);
  verificacion.equal((await fetch(url_base + '/api/check-in/resolve', { method: 'POST' })).status, 404);
});
