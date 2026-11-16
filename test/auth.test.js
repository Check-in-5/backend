import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crear_app } from '../src/app.js';
import { createServer } from 'node:http';

test('HTTP: sesión y permisos, caída de Auth y registro entre servicios', async () => {
  let modo = 'staff';
  let consultas = 0;
  const auth = createServer((req, res) => {
    assert.equal(req.url, '/internal/validar-sesion');
    assert.equal(req.headers['x-api-key'], 'clave-auth-test');
    assert.equal(req.headers.cookie, 'jwt=prueba');
    if (modo === 'revocada') { res.writeHead(401).end('{}'); return; }
    if (modo === 'error') { res.writeHead(500).end('{}'); return; }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ valido: true, usuario: { id_usuario: 'staff-1', rol: modo } }));
  });
  await new Promise(resolve => auth.listen(0, '127.0.0.1', resolve));
  process.env.AUTH_SERVICE_URL = `http://127.0.0.1:${auth.address().port}`;
  process.env.AUTH_INTERNAL_API_KEY = 'clave-auth-test';
  process.env.CHECKIN_SERVICE_API_KEY = 'clave-entradas-test';
  process.env.CHECKIN_ALLOWED_ROLES = 'STAFF';
  const app = crear_app({ repositorio: {
    buscar_por_id: async () => { consultas++; return { id_entrada: 'tk-1', id_evento: 'ev-1', id_usuario: 'buyer-1', nombre_usuario: 'Persona' }; },
    insertar: async () => true,
    registrar_ingreso: async () => true,
  } });
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const url = `http://127.0.0.1:${server.address().port}/api/checkin`;
  const post = (path, headers = {}, body = { id_entrada: 'tk-1', id_evento: 'ev-1' }) => fetch(url + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
  try {
    assert.equal((await post('/validaciones')).status, 401);
    modo = 'usuario'; assert.equal((await post('/validaciones', { Cookie: 'jwt=prueba' })).status, 403);
    modo = 'revocada'; assert.equal((await post('/validaciones', { Cookie: 'jwt=prueba' })).status, 401);
    modo = 'error'; assert.equal((await post('/validaciones', { Cookie: 'jwt=prueba' })).status, 503);
    assert.equal(consultas, 0, 'No debe consultar tickets sin autorización');
    modo = 'staff';
    const valida = await post('/validaciones', { Cookie: 'jwt=prueba' });
    assert.equal(valida.status, 200); assert.equal((await valida.json()).valido, true);
    assert.equal(consultas, 1);
    assert.equal((await post('/tickets')).status, 403);
    assert.equal((await post('/eventos/ev-1/finalizar', { Cookie: 'jwt=prueba' })).status, 403);
    assert.equal((await post('/tickets', { 'x-api-key': 'incorrecta' })).status, 403);
    assert.equal((await post('/tickets', { 'x-api-key': 'clave-entradas-test' }, { id_entrada: 'tk-2', id_evento: 'ev-1', id_usuario: 'buyer-1', nombre_usuario: 'Persona' })).status, 201);
    await new Promise(resolve => auth.close(resolve));
    assert.equal((await post('/validaciones', { Cookie: 'jwt=prueba' })).status, 503);
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    if (auth.listening) { auth.closeAllConnections(); await new Promise(resolve => auth.close(resolve)); }
  }
});
