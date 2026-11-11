# Datos de Prueba Estáticos (Check-in)

Los siguientes tickets están pre-cargados en la base de datos local de Check-in para facilitar las pruebas de integración a través del API Gateway.

## Tickets Disponibles para Escaneo (POST /api/checkin/validaciones)

| ID Entrada (`id_entrada`) | ID Evento (`id_evento`) | ID Usuario (`id_usuario`) | Nombre (`nombre_usuario`) | Comportamiento Esperado al Validar |
| :--- | :--- | :--- | :--- | :--- |
| `tk-valido-01` | `evt-concierto-01` | `usr-100` | Walter Castillo | **Escaneo 1:** `200 OK` (valido: true). Publica evento en RabbitMQ.<br>**Escaneo 2:** `200 OK` (valido: false, motivo: `TICKET_ALREADY_USED`). |
| `tk-valido-02` | `evt-concierto-01` | `usr-101` | Juan Barraza | **Escaneo 1:** `200 OK` (valido: true). Publica evento en RabbitMQ.<br>**Escaneo 2:** `200 OK` (valido: false, motivo: `TICKET_ALREADY_USED`). |
| `tk-vip-01` | `evt-concierto-01` | `usr-102` | Sebastian Fuentes | **Escaneo 1:** `200 OK` (valido: true). Publica evento en RabbitMQ.<br>**Escaneo 2:** `200 OK` (valido: false, motivo: `TICKET_ALREADY_USED`). |
| `tk-otro-evento`| `evt-teatro-99` | `usr-103` | Usuario Prueba | **Escaneo 1:** `200 OK` (valido: false, motivo: `EVENT_MISMATCH`) si se envía con `id_evento` incorrecto. |

## Instrucciones para otros microservicios
*   **Reseñas:** Al enviar la petición de validación exitosa (Escaneo 1) de cualquiera de estos tickets, nuestro microservicio publicará automáticamente el evento `checkin.realizado` en el exchange `ticketu.events` de RabbitMQ con el payload correspondiente (`id_entrada`, `id_evento`, `id_usuario`, `fecha_checkin`).
*   **Entradas:** Si intentan registrar (`POST /api/checkin/tickets`) cualquiera de estos IDs nuevamente, el sistema devolverá `409 Conflict` (motivo: `TICKET_ALREADY_EXISTS`).