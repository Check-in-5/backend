import { crear_app } from './app.js';
import { crear_repositorio } from './repository.js';
const puerto = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) throw new Error('PORT inválido.');
const repositorio = crear_repositorio(process.env.DB_PATH ?? 'data/checkin.sqlite');
const aplicacion = crear_app({ repositorio });
const servidor = aplicacion.listen(puerto, '127.0.0.1', () => console.log('Check-in local: http://localhost:' + puerto + '/api-docs'));
servidor.on('error', error => { repositorio.cerrar(); console.error(error.message); process.exitCode = 1; });
for (const senal of ['SIGINT', 'SIGTERM']) process.once(senal, () => {
  servidor.close(() => { repositorio.cerrar(); });
  servidor.closeIdleConnections();
});
