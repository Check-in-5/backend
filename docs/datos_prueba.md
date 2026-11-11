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
*   **Reseñas:** El microservicio de Check-in **no emite eventos por cada escaneo individual**. Para notificar a los demás microservicios (como Reseñas), se debe invocar el endpoint de finalización una vez concluido el evento.
*   **Petición de prueba:** `POST /api/checkin/eventos/evt-concierto-01/finalizar`
*   **Comportamiento:** Extrae todos los ingresos registrados para ese evento y pu
*   **Entradas:** Si intentan registrar (`POST /api/checkin/tickets`) cualquiera de estos IDs nuevamente, el sistema devolverá `409 Conflict` (motivo: `TICKET_ALREADY_EXISTS`).