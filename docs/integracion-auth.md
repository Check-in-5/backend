# Integración de Check-in con Auth

Check-in conserva su base MySQL y sus reglas de negocio. La identidad del operador se verifica en Auth antes de validar un ticket.

| Ruta | Credencial |
|---|---|
| POST /api/checkin/validaciones | Cookie `jwt` de Auth y rol permitido (STAFF por defecto) |
| POST /api/checkin/tickets | `x-api-key` igual a CHECKIN_SERVICE_API_KEY |
| POST /api/checkin/eventos/:id_evento/finalizar | `x-api-key` igual a CHECKIN_SERVICE_API_KEY |
| GET /health | Pública; comprueba HTTP, no la disponibilidad de Auth |

El middleware reenvía Cookie y AUTH_INTERNAL_API_KEY en `x-api-key` a `GET AUTH_SERVICE_URL/internal/validar-sesion`. Acepta el rol `staff` del contrato de Auth y normaliza la configuración de roles a minúsculas. No confía en roles ni identidades del cuerpo de la petición.

- 401: sesión ausente, inválida, vencida o revocada.
- 403: sesión con rol no permitido, o clave de servicio incorrecta.
- 503: configuración incompleta, fallo de red, respuesta inesperada o error de Auth. No se ejecuta la operación protegida.

## Configuración

Copia `.env.example` a `.env` solo en una instalación nueva y configura:

```dotenv
COMPOSE_PROJECT_NAME=checkin
AUTH_SERVICE_URL=http://host.docker.internal:10000
AUTH_INTERNAL_API_KEY=
CHECKIN_SERVICE_API_KEY=
CHECKIN_ALLOWED_ROLES=STAFF
```

AUTH_INTERNAL_API_KEY debe coincidir con INTERNAL_API_KEY del backend Auth. CHECKIN_SERVICE_API_KEY es otra clave, compartida únicamente con los servicios autorizados a registrar tickets o finalizar eventos. No incluir claves en el navegador ni subir `.env` a Git.

La URL de ejemplo corresponde a Docker Desktop con Auth publicado en el puerto 10000 del host. Si ambos servicios están en la misma red Docker, usa el nombre real de Auth en esa red. Si Check-in se ejecuta con npm en Windows y Auth está publicado localmente, usa `http://localhost:10000`.

El cliente o proxy frontal debe reenviar la cookie original al backend. El login lo realiza el frontend de Auth; esta rama no incluye un frontend ni despliega Auth, Keycloak o sus bases.

## Docker

Desde este repositorio:

```powershell
docker network inspect plataforma-eventos-net
# Solo si no existe:
docker network create plataforma-eventos-net
docker compose -p checkin config --quiet
docker compose -p checkin up --build -d
```

Completa también DB_* y BROKER_URL según el entorno. DB_PORT configura el puerto MySQL publicado en Windows (por ejemplo 3308 si 3306 está ocupado); dentro de Docker se mantiene 3306. PORT es el puerto publicado de Check-in, 3005 por defecto. No ejecutar simultáneamente con otra entrega que publique esos mismos puertos.

Para finalizar eventos se conserva el publicador del main: configura BROKER_URL y EVENT_EXCHANGE. Su implementación actual captura errores y no garantiza confirmación de publicación; una respuesta HTTP exitosa no demuestra entrega a consumidores.

## Pruebas

```powershell
npm.cmd ci
npm.cmd test
```

Las pruebas de autenticación usan el middleware real con un servidor Auth controlado. Comprueban cookie, clave interna, rol `staff`, rechazo de comprador, sesión revocada, Auth caído y rutas entre servicios. Las pruebas de negocio inyectan middleware de prueba para aislar validación y persistencia. El servidor productivo utiliza siempre los middleware seguros por defecto.

La prueba MySQL real se habilita con TEST_MYSQL=1 y DB_* apuntando a una instancia de prueba. La suite SQLite se adaptó al comportamiento actual de ingreso único; no demuestra exclusión de carreras concurrentes en el adaptador MySQL del main.
