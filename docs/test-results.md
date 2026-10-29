# Resultado de pruebas

29 de octubre de 2026. Comando: `npm.cmd test`.
Resultado: 23 aprobadas, 0 fallidas, 1 omitida (MySQL real, requiere TEST_MYSQL=1).

Las pruebas HTTP usan SQLite real como adaptador de prueba: registro y validación
con `/api/checkin/*`, id_usuario requerido, duplicados simultáneos, persistencia,
validación del cuerpo, errores internos, parámetros SQL y documentación OpenAPI.
No demuestran el funcionamiento del nuevo adaptador MySQL.

`docker compose config --quiet` y `node --check src/repository-mysql.js` pasaron.
Docker Engine no estaba disponible, por lo que no se construyó la imagen ni se
probó el tráfico real a través del Gateway o la conexión a MySQL.

`test/mysql.test.js` permite comprobar persistencia al reconectar, duplicados
concurrentes y consultas parametrizadas contra la BD real. Usa IDs únicos y limpia
solo el ticket creado por la prueba. Activación y variables en README.md.

Postman actualizado para el Gateway; no ejecutado en Postman. No se probaron
Entradas, autenticación, RabbitMQ ni el SLA mediante carga.