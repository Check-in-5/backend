import { crear_app } from './app.js';
import { crear_repositorio_mysql } from './repository-mysql.js';

const anfitrion = process.env.HOST ?? '127.0.0.1';
const puerto = Number(process.env.PORT ?? 3001);

if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) throw new Error('PORT inválido.');

// crear_repositorio es asíncrono y la conexión a MySQL no requiere DB_PATH
const repositorio = await crear_repositorio_mysql();
const aplicacion = crear_app({ repositorio });

const servidor = aplicacion.listen(puerto, anfitrion, () => console.log('Check-in MySQL activo: http://localhost:' + puerto + '/api-docs'));

servidor.on('error', async error => { 
  await repositorio.cerrar(); 
  console.error(error.message); 
  process.exitCode = 1; 
});

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.once(senal, () => {
    servidor.close(async () => { 
      await repositorio.cerrar(); 
      process.exit(0);
    });
    servidor.closeIdleConnections();
  });
}