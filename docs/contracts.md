# Contrato HTTP de Check-in

Prefijo oficial: `/api/checkin`. El Gateway conserva la ruta completa.
Gateway: `http://localhost:8080`; directo: `http://localhost:3001`.
Configuración del Gateway: `CHECKIN_SERVICE_URL=http://checkin-service:3001`.
Red externa: `plataforma-eventos-net`.

## Registro

POST /api/checkin/tickets. Campos requeridos: id_entrada (1–128 caracteres),
id_evento (1–128), id_usuario (1–255), nombre_usuario (1–200). Todos son strings,
sin espacios iniciales o finales. No se permiten campos extra, excepto qr_data,
opcional e idéntico a id_entrada. QR contiene el ID, no una URL.

201: persistido; 400: datos inválidos; 409: ID duplicado sin sobrescribir;
413: cuerpo excesivo; 500: fallo interno. La clave primaria evita duplicados
incluso con solicitudes simultáneas. El adaptador MySQL guarda qr_data como JSON.

## Validación

POST /api/checkin/validaciones. Requeridos: id_entrada e id_evento.
200 con valido y motivo: TICKET_FOUND, TICKET_NOT_FOUND o EVENT_MISMATCH.
Solo el caso válido incluye ticket: id_entrada, id_evento y nombre_usuario.
Consulta la BD propia. No registra asistencia ni comprueba uso previo o anulación.

## Migración y pendientes

Se retira el prefijo `/api/v1/checkin/`; actualizar Entradas y el proxy del frontend.
OpenAPI y Postman utilizan el nuevo prefijo. No hay autenticación en esta entrega.
La integración real por el Gateway debe verificarse con los componentes levantados.
Los eventos RabbitMQ propuestos por Platform Team no constituyen un contrato final;
su implementación queda pendiente del acuerdo con Entradas y Organizador.