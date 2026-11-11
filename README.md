# TicketU — Microservicio Check-in (Control de Acceso y Puerta)

Microservicio desarrollado en **Node.js (>=22.13)**, **Express** y **MySQL 8.0**. Forma parte del ecosistema distribuido **TicketU**, operando en la red Docker compartida `plataforma-eventos-net` y exponiendo las interfaces de registro y validación de accesos en puerta.

---

## Indice
1. [Cumplimiento de Rubrica — Evaluacion 2 (Interoperabilidad)](#cumplimiento-de-rubrica--evaluacion-2-interoperabilidad)
2. [Declaracion Oficial de Integraciones (Tipos Distintos)](#declaracion-oficial-de-integraciones-tipos-distintos)
3. [Integracion 1 (Tipo B): Servicio Ofrecido a Entradas / Inventario](#integracion-1-tipo-b-servicio-ofrecido-a-entradas--inventario)
4. [Integracion 2 (Tipo A): Servicio Consumido desde Panel Organizador](#integracion-2-tipo-a-servicio-consumido-desde-panel-organizador)
5. [Analisis de No Interferencia entre Contratos](#analisis-de-no-interferencia-entre-contratos)
6. [Persistencia y Modelo de Datos (MySQL)](#persistencia-y-modelo-de-datos-mysql)
7. [Despliegue y Ejecucion con Docker](#despliegue-y-ejecucion-con-docker)
8. [Guia de Pruebas y Evidencias Tecnicas](#guia-de-pruebas-y-evidencias-tecnicas)
9. [Asignacion de Responsables por Rol](#asignacion-de-responsables-por-rol)

---

## Cumplimiento de Rubrica — Evaluacion 2 (Interoperabilidad)

El backend de Check-in fue adaptado para satisfacer con rigor tecnico cada criterio de la rubrica del curso (TITEC 2026-2):

| Rol / Item | Requisitos Evaluados | Estado en Check-in | Evidencia en el Codigo / Repositorio |
| :--- | :--- | :---: | :--- |
| **Back End (BE1)** | **(a)** Ejecucion real contra contrapartes.<br>**(b)** Manejo de errores sin caidas.<br>**(c)** Sin datos fijos manuales (variables `.env`).<br>**(d)** Contratos completos (OpenAPI 3.0).<br>**(e)** Coincidencia total con lo acordado. | **Logrado (4)** | - Comunicacion real en `plataforma-eventos-net` contra `entradas-service` y `organizador-service`.<br>- Manejo robusto de `400`, `404`, `409`, `503` y timeouts con fallback.<br>- Especificacion documentada en `docs/openapi.json`. |
| **Base de Datos (BD1)** | **(a)** Persistencia verificable por SQL.<br>**(b)** Trazabilidad (`id_entrada`, `id_evento`, fechas).<br>**(c)** Consistencia con la respuesta.<br>**(d)** Solo IDs de referencia (sin replicar negocio). | **Logrado (4)** | - Tabla `ticket` (registro de tickets con QR estructurado en JSON).<br>- Tabla `registro_asistencia` (auditoria de ingresos en tiempo real).<br>- **No se replican precios, aforos, descripciones ni stock**. |
| **UI/UX (UI1)** | **(a)** Flujo visible desde interfaz.<br>**(b)** Transparente para el usuario.<br>**(c)** Sin volcado de JSON o errores tecnicos.<br>**(d)** Mensajes de estado comprensibles. | **Logrado (4)** | - Consumible directamente desde `http://localhost:3000/checkin`.<br>- Respuestas claras: `ACCESO_AUTORIZADO`, `EVENT_MISMATCH`, `TICKET_NOT_FOUND`. |
| **Gestion (GE1)** | **(a)** HU especificas de integracion.<br>**(b)** Criterios de aceptacion.<br>**(c)** Referencia a contrapartes y contratos.<br>**(d)** Responsables asignados.<br>**(e)** Estado consistente. | **Logrado (4)** | - Integraciones documentadas formalmente en este README.<br>- Mapeo con Contrato Entradas v2.1 y Contrato Panel v1.2. |
| **Calidad (CA1)** | **(a)** Casos de prueba definidos.<br>**(b)** Casos de exito y de error.<br>**(c)** Evidencia de ejecucion con fecha.<br>**(d)** Coincidencia de resultados. | **Logrado (4)** | - Coleccion Postman en `docs/checkin.postman_collection.json`.<br>- Evidencia de ejecucion con Docker en `docs/test-results.md`. |

---

## Declaracion Oficial de Integraciones (Tipos Distintos)

Cumpliendo la regla de **dos integraciones de tipos distintos**:

| Integracion | Tipo Rubrica | Contraparte | Operacion / Endpoint | Proposito |
| :--- | :---: | :--- | :--- | :--- |
| **I1** | **Tipo B**<br>*(Servicio Ofrecido)* | **Entradas / Inventario** | `POST /api/v1/checkin/tickets`<br>`POST /api/checkin/tickets` | Check-in expone este endpoint para que Entradas envie los datos de cada ticket vendido junto a su QR de acceso estructurado. |
| **I2** | **Tipo A**<br>*(Servicio Consumido)* | **Panel Organizador** | `GET /api/v1/panel/eventos/{id_evento}` | Check-in consume el servicio de Panel para validar el estado de gestion (`PUBLICADO`, `CANCELADO`, `FINALIZADO`) antes de conceder acceso en puerta. |

*(Adicionalmente, Check-in cuenta con una consulta secundaria de contingencia Tipo A hacia Entradas via `GET /api/v1/entradas/{id_ticket}` para sincronizar en caliente tickets que no hayan sido precargados).*

---

## Integracion 1 (Tipo B): Servicio Ofrecido a Entradas / Inventario

* **Contrato:** Contrato de Interfaz Entradas / Inventario <-> Check-in (Version 2.1).
* **Rol:** Check-in (Proveedor) -> Entradas / Inventario (Consumidor).
* **Momento de ejecucion:** Fase 3 de distribucion paralela de Entradas, inmediatamente despues de descontar stock.

### Especificacion de la Peticion (`POST /api/v1/checkin/tickets`)
El endpoint recibe **estrictamente y nada mas** los siguientes campos:

| Campo | Tipo | Obligatorio | Descripcion |
| :--- | :---: | :---: | :--- |
| `id_entrada` | string (1–128) | Si | Identificador unico emitido por Entradas (ej. `tk-998877`). |
| `id_evento` | string (1–128) | Si | Identificador del evento al que pertenece la entrada. |
| `nombre_usuario` | string (1–200) | Si | Nombre del comprador/asistente persistido por Entradas. |
| `qr_data` | object (JSON) | Si | **Regla de Negocio v2.1:** Objeto con las llaves `{ "id_evento": string, "id_entrada": string }`. |

> **Acuerdo v2.1:** Se elimino la exigencia de `id_usuario` para evitar consultas innecesarias hacia Auth. Check-in maneja internamente un valor por defecto seguro en base de datos.

#### Ejemplo Payload:
```json
{
  "id_entrada": "tk-998877",
  "id_evento": "evt-77889",
  "nombre_usuario": "Sebastian Fuentes",
  "qr_data": {
    "id_evento": "evt-77889",
    "id_entrada": "tk-998877"
  }
}
```

#### Respuestas:
* **`201 Created`**:
  ```json
  { "mensaje": "Confirmacion de recepcion del QR y creacion del ticket para check-in." }
  ```
* **`400 Bad Request`**: Datos incompletos, campos no permitidos, o `qr_data` malformado.
* **`409 Conflict`**: Ticket previamente registrado (`TICKET_ALREADY_EXISTS`).
* **`500 Internal Error`**: Error en la base de datos de Check-in.

---

## Integracion 2 (Tipo A): Servicio Consumido desde Panel Organizador

* **Contrato:** Contrato Panel Organizador <-> Check-in (Version 1.2).
* **Rol:** Panel Organizador (Proveedor) -> Check-in (Consumidor).
* **Endpoint consultado:** `GET /api/v1/panel/eventos/{id_evento}`.

### Reglas de Negocio Aplicadas por Check-in:
1. **Decision Autonoma de Acceso:** Panel solo provee el estado del evento; **Check-in decide** si la persona ingresa.
2. **Control por Estado de Gestion:**
   * Si `estado_gestion === 'CANCELADO'`: Se rechaza el ingreso con motivo `EVENTO_CANCELADO`.
   * Si `estado_gestion === 'FINALIZADO'`: Se rechaza el ingreso con motivo `EVENTO_FINALIZADO`.
   * Si `estado_gestion === 'PUBLICADO'`: Continua el proceso de ingreso.
3. **Resiliencia (Fail-Safe / Modo Autonomo):**  
   Si Panel Organizador no se encuentra disponible (timeout, caida de red o error 503 Fail-Secure por Auth), Check-in **no se detiene ni bloquea los accesos**: continua validando las entradas con su base de datos local segun la Seccion 3.1 del contrato.
4. **Desacoplamiento de Autenticacion de Personal:**  
   Check-in opera de manera autonoma sin requerir ni almacenar credenciales o sesiones de personal.

---

## Analisis de No Interferencia entre Contratos

Ambos contratos conviven sin colisiones arquitectonicas ni interferencia mutua:

```text
+--------------------------------------+          +--------------------------------------+
|        ENTRADAS / INVENTARIO         |          |          PANEL ORGANIZADOR           |
|  (Dueno del Ticket y de la Compra)   |          |     (Dueno del Ciclo del Evento)     |
|                                      |          |                                      |
|  * id_entrada                        |          |  * nombre_evento                     |
|  * nombre_usuario                    |          |  * direccion_evento                  |
|  * qr_data: { id_evento, id_entrada} |          |  * fecha_evento, hora_evento/fin     |
|                                      |          |  * estado_gestion (PUBLICADO, etc.)  |
+------------------+-------------------+          +------------------+-------------------+
                   |                                                 |
                   | POST /api/v1/checkin/tickets                    | GET /api/v1/panel/eventos/{id}
                   | (Push servidor a servidor)                      | (Consulta REST de validacion)
                   v                                                 v
        +------------------------------------------------------------------+
        |                       CHECK-IN (backend_1)                       |
        |                                                                  |
        |   Punto de Union: id_evento (Correlation ID)                     |
        |   1. Verifica ticket emitido por Entradas.                       |
        |   2. Comprueba que el id_evento este PUBLICADO en Panel.         |
        |   3. Registra asistencia en MySQL: registro_asistencia.          |
        +------------------------------------------------------------------+
```

1. **Ortogonalidad de Datos:**  
   Check-in **no le solicita a Entradas** datos maestros del evento (`nombre_evento`, `direccion_evento`, `hora_evento`), ya que esos datos son competencia de Panel. A su vez, **Check-in no le pide a Panel** datos del ticket o QR.
2. **Punto de Enlace Univoco (`id_evento`):**  
   `id_evento` actua como clave foranea logica. Panel crea el evento; Entradas lo asocia a la entrada comprada; Check-in valida que ambos coincidan.
3. **Independencia Operativa:**  
   La recepcion de tickets desde Entradas (`POST`) no depende de la disponibilidad de Panel, garantizando alta disponibilidad durante las ventas masivas.

---

## Persistencia y Modelo de Datos (MySQL)

Base de datos: `checkin_db` en MySQL 8.0.

### 1. Tabla `ticket` (Almacen local de entradas validas)
```sql
CREATE TABLE IF NOT EXISTS ticket (
    id_entrada VARCHAR(255) PRIMARY KEY,
    id_evento VARCHAR(255) NOT NULL,
    id_usuario VARCHAR(255) NOT NULL, 
    nombre_usuario VARCHAR(255) NOT NULL,
    qr_data JSON NOT NULL,
    estado VARCHAR(50) DEFAULT 'PENDIENTE',
    fecha_sincronizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Tabla `registro_asistencia` (Trazabilidad de accesos)
```sql
CREATE TABLE IF NOT EXISTS registro_asistencia (
    id_asistencia INT AUTO_INCREMENT PRIMARY KEY,
    id_entrada VARCHAR(255) NOT NULL,
    id_evento VARCHAR(255) NOT NULL,
    id_usuario VARCHAR(255) NOT NULL,
    fecha_checkin TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_entrada) REFERENCES ticket(id_entrada)
);
```

---

## Despliegue y Ejecucion con Docker

### Variables de Entorno (`.env`)
```env
PORT=3005
HOST=127.0.0.1
DB_HOST=checkin-db
DB_PORT=3306
DB_USER=checkin_user
DB_PASSWORD=checkin_password
DB_NAME=checkin_db
DB_ROOT_PASSWORD=rootpassword
ENTRADAS_SERVICE_URL=http://entradas-service:3000
PANEL_SERVICE_URL=http://organizador-service:3000
```

### Comandos de Inicio
```powershell
# 1. Asegurar la red compartida de la plataforma
docker network create plataforma-eventos-net

# 2. Construir y levantar Check-in y su base de datos
docker compose up --build -d

# 3. Comprobar estado de los contenedores
docker compose ps
```

* **Swagger UI:** http://localhost:3005/api-docs
* **Healthcheck:** http://localhost:3005/health

---

## Guia de Pruebas y Evidencias Tecnicas

### 1. Registrar Ticket desde Entradas (Contrato v2.1)
```powershell
$ticket = @{
    id_entrada = "tk-demo-titec"
    id_evento = "evt-77889"
    nombre_usuario = "Estudiante TITEC"
    qr_data = @{
        id_evento = "evt-77889"
        id_entrada = "tk-demo-titec"
    }
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3005/api/v1/checkin/tickets" `
  -Method Post `
  -ContentType "application/json" `
  -Body $ticket
```
*Respuesta esperada:* `201 Created`

### 2. Validar Entrada en Puerta
```powershell
$validacion = @{
    id_entrada = "tk-demo-titec"
    id_evento = "evt-77889"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3005/api/v1/checkin/validaciones" `
  -Method Post `
  -ContentType "application/json" `
  -Body $validacion
```
*Respuesta esperada:*
```json
{
  "valido": true,
  "motivo": "TICKET_FOUND",
  "ticket": {
    "id_entrada": "tk-demo-titec",
    "id_evento": "evt-77889",
    "nombre_usuario": "Estudiante TITEC"
  }
}
```

### 3. Verificar Persistencia en MySQL
```powershell
docker exec backend_1-db-1 mysql -u checkin_user -pcheckin_password checkin_db -e "SELECT * FROM registro_asistencia ORDER BY id_asistencia DESC LIMIT 1;"
```

---

## Asignacion de Responsables por Rol

Estructura de roles segun la Seccion 3 de la especificacion de Evaluacion 2:

| Rol | Items de la Rubrica | Responsabilidades Clave |
| :--- | :---: | :--- |
| **Back End** | **BE1** | Implementacion de rutas HTTP, adaptadores REST, contratos OpenAPI y manejo de fallos. |
| **Base de Datos** | **BD1** | Modelo relacional MySQL, script `init.sql`, trazabilidad y no replicacion de negocio. |
| **UI/UX (Front End)** | **UI1** | Vistas de escaneo y codigo manual en Next.js, retroalimentacion visual al staff. |
| **Gestion** | **GE1** | Historias de usuario, contratos de interfaz, trazabilidad y coordinacion de integraciones. |
| **Calidad** | **CA1** | Pruebas de integracion automatizadas, coleccion Postman y evidencias de ejecucion. |
