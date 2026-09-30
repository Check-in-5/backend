# Backend Check-in

Node.js >=22.13 + Express, con SQLite local persistente. Recibe tickets de Entradas y consulta su propia BD al escanear. No requiere otros microservicios ni token para esta entrega. No registra asistencia.

## Ejecutar

```powershell
npm.cmd install
npm.cmd start
```

Swagger: http://localhost:3001/api-docs (o el puerto configurado en PORT). Si había un servidor anterior, detenerlo con Ctrl+C y volver a iniciarlo. Swagger usa el mismo origen desde el que se abre.

La base se crea automáticamente en `data/checkin.sqlite`; los tickets sobreviven al reinicio. Copiar `.env.example` a `.env` para configurar puerto y ruta. Se usa el módulo SQLite incluido en Node; Node 22 puede mostrar una advertencia experimental.

## 1. Recibir ticket desde Entradas

`POST /api/v1/checkin/tickets`

```json
{
  "id_entrada": "tk-998877",
  "id_evento": "evt-77889",
  "nombre_usuario": "Sebastián Fuentes"
}
```

Devuelve 201 con `mensaje`. El ID duplicado devuelve 409 sin sobrescribir datos. `qr_data` es opcional y solo se admite si coincide con `id_entrada`. Entradas debe enviar únicamente tickets emitidos válidos.

## 2. Validar el QR leído por el frontend

`POST /api/v1/checkin/validaciones`

```json
{ "id_entrada": "tk-998877", "id_evento": "evt-77889" }
```

Devuelve 200 con `valido: true`, `motivo: TICKET_FOUND` y `ticket` si existe y coincide el evento. Devuelve 200 con `valido: false` y `TICKET_NOT_FOUND` o `EVENT_MISMATCH` si falla esa comprobación. Datos de entrada inválidos: 400; cuerpo demasiado grande: 413; error interno: 500.

**Validez limitada a existencia y evento.** No comprueba anulación, horario, pago ni uso previo. No marca el ticket como utilizado; validarlo repetidamente da el mismo resultado. Falta acordar estados y actualizaciones con Entradas. El frontend proporciona el evento seleccionado por portería y el texto del QR como ID.

## Alcance y base de datos

SQLite es un adaptador local para probar el flujo completo; el responsable de BD puede sustituir `src/repository.js` conservando `insertar` y `buscar_por_id`. El esquema está en `docs/schema.sql`. No hay usuarios ni eventos locales completos: se guarda ID de entrada, ID de evento y nombre recibido según el alcance acordado. La réplica debe coordinarse con las restricciones de la pauta.

El escaneo funciona si Entradas está desconectado, siempre que el ticket ya se haya recibido. El celular todavía necesita acceso al servidor Check-in. El servidor escucha en 127.0.0.1; la exposición a la red y CORS se configuran con frontend posteriormente.

Se reemplazó el flujo provisional `/api/check-in/resolve` y se retiraron sus clientes externos y mocks. BE3 hacia Reseñas sigue pendiente. Auth y política de reintentos quedan fuera de esta entrega.

## Pruebas

`npm.cmd test` prueba los endpoints con SQLite real, duplicados simultáneos, persistencia al reabrir la BD, datos inválidos y errores internos. Importar `docs/checkin.postman_collection.json` y ejecutar en orden para la demostración manual. No necesita Authorize.

## Convenci?n de nombres

Las variables, par?metros, funciones y m?todos propios usan espa?ol, singular y snake_case. Las colecciones se nombran con un sustantivo singular, por ejemplo resultado_conjunto. Se mantienen los identificadores obligatorios de JavaScript y de bibliotecas (constructor, status, body, etc.), los campos del contrato HTTP (ticket, qr_data, code, message), las rutas acordadas, las variables de entorno y el esquema existente para preservar compatibilidad.
