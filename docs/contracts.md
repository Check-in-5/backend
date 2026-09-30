# Contrato de recepción y validación local

Check-in expone ambos endpoints; Entradas consume el registro y el frontend consume la validación. Swagger es la especificación completa: `docs/openapi.json`.

## Registro

POST /api/v1/checkin/tickets. Requeridos: id_entrada (string hasta 128), id_evento (string hasta 128), nombre_usuario (string hasta 200). Sin espacios iniciales/finales. No se permiten campos adicionales excepto qr_data, opcional e idéntico a id_entrada. QR contiene únicamente el ID, no una URL. Este ajuste sustituye la ambigüedad del contrato DOCX y debe comunicarse a Entradas.

201: registro persistido con mensaje. 400: campos inválidos o QR diferente. 409: ID ya registrado, sin sobrescribir. 500: fallo interno. Inserción con restricción única para evitar carreras entre solicitudes.

## Validación

POST /api/v1/checkin/validaciones. Requeridos: id_entrada e id_evento. Consulta exclusivamente SQLite local. 200 con valido y motivo: TICKET_FOUND, TICKET_NOT_FOUND o EVENT_MISMATCH. Solo el caso válido incluye ticket y nombre del usuario. No registra asistencia ni comprueba anulaciones o entradas usadas.

## Pendientes

Auth excluido de la entrega por acuerdo; endpoints actualmente sin autenticación. Reintentos y actualización de estados pendientes. El SLA de 300 ms no se garantiza sin prueba de carga en el entorno de despliegue. Coordinar el almacenamiento con el compañero de BD y la pauta; servicio de Reseñas BE3 pendiente.
