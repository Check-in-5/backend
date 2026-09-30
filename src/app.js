import crear_express from 'express';
import interfaz_swagger from 'swagger-ui-express';
import { readFileSync as leer_archivo } from 'node:fs';
import { crear_servicio } from './service.js';
import { error_api } from './errors.js';
const especificacion = JSON.parse(leer_archivo(new URL('../docs/openapi.json', import.meta.url), 'utf8'));
export function crear_app({ repositorio }) {
  const app = crear_express();
  const servicio = crear_servicio(repositorio);
  app.disable('x-powered-by');
  app.get('/health', (_solicitud, respuesta) => respuesta.json({ status: 'ok', storage: 'local' }));
  app.get('/openapi.json', (_solicitud, respuesta) => respuesta.json(especificacion));
  app.use('/api-docs', interfaz_swagger.serve, interfaz_swagger.setup(especificacion));
  app.use('/api', (_solicitud, respuesta, continuar) => { respuesta.set('Cache-Control', 'no-store'); continuar(); });
  app.use(crear_express.json({ limit: '16kb' }));
  app.post('/api/v1/checkin/tickets', (solicitud, respuesta) => {
    servicio.registrar(solicitud.body);
    respuesta.status(201).json({ mensaje: 'Ticket registrado exitosamente para control de acceso.' });
  });
  app.post('/api/v1/checkin/validaciones', (solicitud, respuesta) => respuesta.json(servicio.validar(solicitud.body)));
  app.use((_solicitud, _respuesta, continuar) => continuar(new error_api(404, 'ROUTE_NOT_FOUND', 'Ruta no encontrada.')));
  app.use((error, _solicitud, respuesta, _continuar) => {
    const estado = error instanceof error_api ? error.estado : error.type === 'entity.parse.failed' ? 400 : error.type === 'entity.too.large' ? 413 : 500;
    respuesta.status(estado).json({ error: {
      code: error instanceof error_api ? error.codigo : estado === 400 ? 'INVALID_JSON' : estado === 413 ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR',
      message: error instanceof error_api ? error.message : 'No se pudo procesar la solicitud.',
    } });
  });
  return app;
}
