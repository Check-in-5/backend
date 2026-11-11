# ============================================================================
# Script de Pruebas Automatizadas de Integracion (PowerShell) - Check-in Backend
# Evaluacion 2 (TITEC 2026-2)
#
# Requiere contenedores levantados en Docker (checkin, entradas, panel)
# ============================================================================

param (
    [string]$CheckinUrl = "http://localhost:3005",
    [string]$IdEvento = "evt-77889"
)

$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$idTicket = "tk-ps-$timestamp"
$nombreUsuario = "Usuario Auto $timestamp"

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "       SUITE DE PRUEBAS AUTOMATIZADAS DE INTEGRACION - CHECK-IN (POWERSHELL)   " -ForegroundColor Cyan
Write-Host "                    TITEC 2026-2 - Evaluacion 2                                " -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "Endpoint Check-in: $CheckinUrl"
Write-Host "ID Evento objetivo: $IdEvento"
Write-Host "ID Ticket generado: $idTicket"
Write-Host "--------------------------------------------------------------------------------"

# 0. Healthcheck
try {
    $health = Invoke-RestMethod -Uri "$CheckinUrl/health" -Method Get -TimeoutSec 3 -ErrorAction Stop
    if ($health.status -ne "ok") { throw "Status no es ok" }
    Write-Host "[OK] Microservicio Check-in activo y respondiendo." -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Check-in no responde en $CheckinUrl." -ForegroundColor Red
    Write-Host "[INFO] Inicia los contenedores con: docker compose up -d" -ForegroundColor Yellow
    exit 1
}

$pruebasPasadas = 0
$totalPruebas = 0

function Registrar-Prueba {
    param ($Id, $Nombre, $Paso, $Mensaje)
    $script:totalPruebas++
    if ($Paso) {
        $script:pruebasPasadas++
        Write-Host "[$Id] [PASO] $Nombre" -ForegroundColor Green
        if ($Mensaje) { Write-Host "     -> $Mensaje" -ForegroundColor Gray }
    } else {
        Write-Host "[$Id] [FALLO] $Nombre" -ForegroundColor Red
        if ($Mensaje) { Write-Host "     -> $Mensaje" -ForegroundColor Yellow }
    }
}

Write-Host "`n--------------------------------------------------------------------------------"
Write-Host "SECCION 1: INTEGRACION 1 (I1) - Servicio Ofrecido a Entradas (Contrato v2.1)"
Write-Host "--------------------------------------------------------------------------------"

# I1-01: Registro Exitoso
try {
    $body = @{
        id_entrada = $idTicket
        id_evento = $IdEvento
        nombre_usuario = $nombreUsuario
        qr_data = @{
            id_evento = $IdEvento
            id_entrada = $idTicket
        }
    } | ConvertTo-Json

    $resp = Invoke-RestMethod -Uri "$CheckinUrl/api/v1/checkin/tickets" -Method Post -ContentType "application/json" -Body $body -ErrorAction Stop
    Registrar-Prueba -Id "I1-01" -Nombre "Registro de ticket valido (Contrato v2.1)" -Paso ($resp.mensaje -match "Confirmacion") -Mensaje $resp.mensaje
} catch {
    Registrar-Prueba -Id "I1-01" -Nombre "Registro de ticket valido" -Paso $false -Mensaje $_.Exception.Message
}

# I1-02: Rechazo Duplicado (409)
try {
    $body = @{
        id_entrada = $idTicket
        id_evento = $IdEvento
        nombre_usuario = $nombreUsuario
        qr_data = @{
            id_evento = $IdEvento
            id_entrada = $idTicket
        }
    } | ConvertTo-Json

    $resp = Invoke-RestMethod -Uri "$CheckinUrl/api/v1/checkin/tickets" -Method Post -ContentType "application/json" -Body $body -ErrorAction Stop
    Registrar-Prueba -Id "I1-02" -Nombre "Rechazo de ticket duplicado" -Paso $false -Mensaje "Esperaba 409 pero respondio 200/201"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $es409 = ($statusCode -eq 409)
    Registrar-Prueba -Id "I1-02" -Nombre "Rechazo de ticket duplicado (Idempotencia)" -Paso $es409 -Mensaje "Codigo HTTP obtenido: $statusCode (Esperado: 409)"
}

# I1-03: Rechazo por Desalineacion QR (400)
try {
    $bodyMismatch = @{
        id_entrada = "tk-mis-$timestamp"
        id_evento = $IdEvento
        nombre_usuario = "Usuario Invalido"
        qr_data = @{
            id_evento = $IdEvento
            id_entrada = "id-diferente"
        }
    } | ConvertTo-Json

    $resp = Invoke-RestMethod -Uri "$CheckinUrl/api/v1/checkin/tickets" -Method Post -ContentType "application/json" -Body $bodyMismatch -ErrorAction Stop
    Registrar-Prueba -Id "I1-03" -Nombre "Rechazo por discrepancia QR" -Paso $false -Mensaje "Esperaba 400 pero respondio exito"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Registrar-Prueba -Id "I1-03" -Nombre "Rechazo por discrepancia en qr_data (QR_MISMATCH)" -Paso ($statusCode -eq 400) -Mensaje "Codigo HTTP obtenido: $statusCode (Esperado: 400)"
}

Write-Host "`n--------------------------------------------------------------------------------"
Write-Host "SECCION 2: INTEGRACION 2 (I2) - Servicio Consumido desde Panel (Contrato v1.2)"
Write-Host "--------------------------------------------------------------------------------"

# I2-01: Validacion exitosa con estado de Panel
try {
    $bodyVal = @{
        id_entrada = $idTicket
        id_evento = $IdEvento
    } | ConvertTo-Json

    $resp = Invoke-RestMethod -Uri "$CheckinUrl/api/v1/checkin/validaciones" -Method Post -ContentType "application/json" -Body $bodyVal -ErrorAction Stop
    $paso = ($resp.valido -eq $true -and $resp.motivo -eq "TICKET_FOUND" -and $resp.evento.estado_gestion -eq "PUBLICADO")
    Registrar-Prueba -Id "I2-01" -Nombre "Validacion en puerta con estado PUBLICADO de Panel" -Paso $paso -Mensaje "Evento: $($resp.evento.nombre_evento) | Estado: $($resp.evento.estado_gestion)"
} catch {
    Registrar-Prueba -Id "I2-01" -Nombre "Validacion en puerta con Panel" -Paso $false -Mensaje $_.Exception.Message
}

# I2-02: Rechazo ticket inexistente
try {
    $bodyInexistente = @{
        id_entrada = "tk-inexistente-99999"
        id_evento = $IdEvento
    } | ConvertTo-Json

    $resp = Invoke-RestMethod -Uri "$CheckinUrl/api/v1/checkin/validaciones" -Method Post -ContentType "application/json" -Body $bodyInexistente -ErrorAction Stop
    $paso = ($resp.valido -eq $false -and $resp.motivo -eq "TICKET_NOT_FOUND")
    Registrar-Prueba -Id "I2-02" -Nombre "Rechazo de acceso por ticket no encontrado (TICKET_NOT_FOUND)" -Paso $paso -Mensaje "Motivo: $($resp.motivo)"
} catch {
    Registrar-Prueba -Id "I2-02" -Nombre "Rechazo ticket no encontrado" -Paso $false -Mensaje $_.Exception.Message
}

# I2-03: Rechazo por evento no coincidente
try {
    $bodyEventoErr = @{
        id_entrada = $idTicket
        id_evento = "evt-diferente-888"
    } | ConvertTo-Json

    $resp = Invoke-RestMethod -Uri "$CheckinUrl/api/v1/checkin/validaciones" -Method Post -ContentType "application/json" -Body $bodyEventoErr -ErrorAction Stop
    $paso = ($resp.valido -eq $false -and $resp.motivo -eq "EVENT_MISMATCH")
    Registrar-Prueba -Id "I2-03" -Nombre "Rechazo por discrepancia de evento (EVENT_MISMATCH)" -Paso $paso -Mensaje "Motivo: $($resp.motivo)"
} catch {
    Registrar-Prueba -Id "I2-03" -Nombre "Rechazo por evento no coincidente" -Paso $false -Mensaje $_.Exception.Message
}

Write-Host "`n================================================================================"
Write-Host "                          RESUMEN DE PRUEBAS                                   "
Write-Host "================================================================================"
Write-Host "Total pruebas: $totalPruebas"
Write-Host "Pruebas pasadas: $pruebasPasadas"
$fallidas = $totalPruebas - $pruebasPasadas
Write-Host "Pruebas fallidas: $fallidas"
Write-Host "================================================================================"

if ($fallidas -eq 0) {
    Write-Host "[CONFORME] Todas las pruebas de integracion pasaron correctamente." -ForegroundColor Green
    exit 0
} else {
    Write-Host "[ALERTA] Se detectaron pruebas fallidas." -ForegroundColor Red
    exit 1
}

