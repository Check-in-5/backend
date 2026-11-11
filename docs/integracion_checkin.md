# Documentación de Integración: Check-in Service

**Fecha:** 11 de noviembre de 2026
**Módulo:** Check-in
**Objetivo principal:** Bloquear el ingreso por duplicidad de códigos QR y emitir el evento de confirmación de asistencia hacia el microservicio de Reseñas de forma asíncrona.

---

## 1. Cambios en Infraestructura y Dependencias

Para cumplir con los lineamientos del Platform Team y permitir la comunicación asíncrona:
*   **Nueva Dependencia:** Se instaló la librería `amqplib` en el proyecto Node.js para habilitar la conexión mediante el protocolo AMQP.
*   **Variables de Entorno (`.env`):** Se añadieron las credenciales del Event Broker compartido:
    *   `BROKER_URL=amqp://ticketu:ticketu_dev@ticketu-rabbitmq:5672/ticketu`
    *   `EVENT_EXCHANGE=ticketu.events`
*   **Resolución de Conflictos Docker:** Se modificó el puerto expuesto de MySQL en el `.env` (de `3306` a `3315`) para evitar colisiones con bases de datos preexistentes en el host local.

## 2. Modificaciones en el Código Fuente (`src/`)

### 2.1. Nuevo publicador de eventos (`src/rabbitmq.js`)
Se creó un nuevo módulo encargado de establecer la conexión con RabbitMQ, asegurar la existencia del exchange tipo `topic` (`ticketu.events`) y publicar mensajes. La conexión se abre y cierra de forma segura tras cada publicación para evitar el bloqueo del event loop.

### 2.2. Actualización de Repositorio MySQL (`src/repository-mysql.js`)
*   Se modificó `buscar_por_id` para retornar también el campo `id_usuario`, necesario para el payload del evento hacia Reseñas.
*   Se implementó el método `registrar_ingreso(id_entrada, id_evento, id_usuario)`:
    1.  Consulta la tabla `registro_asistencia` para verificar si el `id_entrada` ya fue utilizado.
    2.  Si existen registros previos, retorna `false`.
    3.  Si no, inserta el nuevo registro y retorna `true`.

### 2.3. Lógica de validación estricta (`src/service.js`)
Se reestructuró el método `validar` para integrar el flujo completo:
1.  Verifica la existencia y correspondencia del ticket (`TICKET_NOT_FOUND`, `EVENT_MISMATCH`).
2.  Invoca `registrar_ingreso`. Si este falla, aborta la operación y retorna un nuevo motivo: `TICKET_ALREADY_USED`.
3.  Si el registro de asistencia es exitoso, invoca `publicar_evento` con el routing key `checkin.realizado`. El payload incluye `id_entrada`, `id_evento`, `id_usuario` y `fecha_checkin`.
4.  Por motivos de privacidad, filtra el `id_usuario` del objeto final retornado al operador en la puerta.

## 3. Actualización de Contratos (API)

Se actualizó el documento `docs/openapi.json` en la ruta `/api/checkin/validaciones` para documentar la nueva regla de negocio. Ahora, las respuestas `200 OK` (cuando `valido` es `false`) incluyen el enumerador `"TICKET_ALREADY_USED"` en el campo `motivo`.

## 4. Resultados de Pruebas

Las pruebas de flujo completo se ejecutaron de manera exitosa levantando el contenedor de Node.js y MySQL (`docker compose up --build -d`) y apuntando directamente al puerto `3005` mediante `curl` y Postman CLI:

1.  **Registro de ticket:** `201 Created` (El boleto se sincronizó correctamente).
2.  **Primer Escaneo:** `200 OK` - `{"valido":true,"motivo":"TICKET_FOUND"}`. 
    *   *Resultado interno:* Se persistió en la tabla `registro_asistencia` y se emitió el evento `checkin.realizado` a RabbitMQ.
3.  **Segundo Escaneo (Duplicado):** `200 OK` - `{"valido":false,"motivo":"TICKET_ALREADY_USED"}`.
    *   *Resultado interno:* El acceso fue bloqueado por base de datos y no se emitieron eventos duplicados a RabbitMQ.