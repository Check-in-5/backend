# TicketU — Microservicio Check-in

Node.js >=22.13, Express y MySQL 8. Adaptado a la infraestructura compartida de
https://github.com/FWizav/backendticketU: servicio `checkin-service`, red externa
`plataforma-eventos-net` y rutas `/api/checkin/*`. El Gateway conserva el path.

## Iniciar con Docker

```powershell
docker network create plataforma-eventos-net
Copy-Item .env.example .env
docker compose up --build -d
docker compose ps
```

Crear la red y copiar la plantilla una sola vez. Si ya tienes `.env`, conserva tus
valores y revisa las nuevas variables. MySQL debe estar saludable antes de iniciar
Check-in. `init.sql` se ejecuta solo al inicializar un volumen vacío. Los datos
existentes en `db_data` se conservan; cambiar credenciales en `.env` no modifica
usuarios que ya existen en ese volumen.

- Swagger directo: http://localhost:3001/api-docs
- Health directo: http://localhost:3001/health (comprueba HTTP, no la conexión a BD).
- URL interna del servicio: `http://checkin-service:3001`.
- `PORT` cambia el puerto publicado al equipo; dentro de Docker sigue siendo 3001.
- MySQL utiliza el volumen existente `db_data` y una red propia de Check-in.
- MySQL se publica solo en localhost; `DB_PORT` cambia ese puerto para uso local.

```powershell
docker compose logs -f checkin-service
docker compose down
```

`down` conserva los datos. `down -v` elimina el volumen de MySQL y sus tickets.

## Registrar en el Gateway compartido

En el `.env` de `backendticketU/api-gateway` configurar:

```env
CHECKIN_SERVICE_URL=http://checkin-service:3001
```

Después, desde la carpeta del Gateway:

```powershell
docker compose up --build -d
```

El Gateway y Check-in deben estar en la misma red Docker de la misma máquina.
No se copia un Gateway ni un RabbitMQ adicional a este repositorio.

## Probar a través del Gateway

```powershell
Invoke-RestMethod http://localhost:8080/health

$cuerpo = @{
  id_entrada = 'tk-demo-001'
  id_evento = 'evt-001'
  id_usuario = 'usr-001'
  nombre_usuario = 'Usuario Demo'
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/checkin/tickets -ContentType 'application/json' -Body $cuerpo

$lectura = @{ id_entrada = 'tk-demo-001'; id_evento = 'evt-001' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/checkin/validaciones -ContentType 'application/json' -Body $lectura
```

La primera creación devuelve 201; repetir el mismo ID devuelve 409.
Validar devuelve 200 con `valido` y `motivo` (`TICKET_FOUND`, `TICKET_NOT_FOUND`
o `EVENT_MISMATCH`). Solo el caso válido incluye `ticket` con ID, evento y nombre.
Datos inválidos: 400; cuerpo demasiado grande: 413; fallo interno: 500.
`qr_data` es opcional y debe ser el mismo texto que `id_entrada`.

Importar `docs/checkin.postman_collection.json`: `baseUrl` apunta por defecto al
Gateway en 8080; cambiarlo a `http://localhost:3001` permite probar directo.

## Frontend y migración de rutas

Las rutas anteriores `/api/v1/checkin/*` se sustituyen por `/api/checkin/*`.
El frontend debe solicitar `/api/checkin/validaciones` al Gateway. Si mantiene un
proxy propio de Next.js, cambiar tanto su URL de destino como la ruta reenviada;
cambiar solo BACKEND_URL no basta si todavía concatena `/api/v1/checkin/...`.
El frontend no fue modificado en este ajuste. CORS para peticiones del navegador
se configura en el Gateway mediante `CORS_ORIGINS`.

## Ejecución local y pruebas

```powershell
npm.cmd ci
# Con MySQL de Compose disponible en localhost:
docker compose up -d db
npm.cmd start
npm.cmd test
```

`src/app.js` contiene HTTP, `src/service.js` las reglas de negocio y
`src/repository-mysql.js` el adaptador usado en ejecución. Las pruebas HTTP usan
el adaptador SQLite de `src/repository.js` y `docs/schema.sql`, sin necesitar Docker.
La prueba MySQL real se habilita con `TEST_MYSQL=1` y las variables DB_* del entorno:

```powershell
$env:TEST_MYSQL = '1'
node --env-file-if-exists=.env --test
Remove-Item Env:TEST_MYSQL
```

## Alcance y eventos

Recibe tickets de Entradas y valida existencia y coincidencia de evento. No
registra asistencia, no consume tickets y no verifica anulaciones, pago u horario.
El contrato de registro requiere `id_usuario`, como ya exige la lógica y la tabla
MySQL del proyecto. Los endpoints no requieren autenticación en esta entrega.

El molde propone `entrada.emitida` y `checkin.realizado`, pero declara esos eventos
pendientes de acuerdo entre grupos. No se publica `checkin.realizado` al validar,
porque aún no se registra asistencia. RabbitMQ no es una dependencia de este flujo
HTTP. Cuando se acuerde el contrato, usar el broker compartido, `ticketu.events`
y una cola durable propia para Check-in. No se ha implementado ese consumidor.

## Convención de nombres

Variables, parámetros, funciones y métodos propios en español y snake_case.
Se preservan los nombres de bibliotecas, variables de entorno y campos HTTP.