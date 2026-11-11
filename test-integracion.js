/**
 * Script de Pruebas Automatizadas de Integracion - Check-in Backend
 * Evaluacion 2 (TITEC 2026-2)
 *
 * Ejecuta la suite de pruebas contra los microservicios reales levantados en Docker:
 * - Integracion 1 (Tipo B): Servicio ofrecido a Entradas (Contrato v2.1)
 * - Integracion 2 (Tipo A): Servicio consumido desde Panel Organizador (Contrato v1.2)
 *
 * Uso:
 *   node test-integracion.js
 *   npm run test:integration
 */

const CHECKIN_URL = process.env.CHECKIN_URL || 'http://localhost:3005';
const ID_EVENTO_PRUEBA = process.env.ID_EVENTO_PRUEBA || 'evt-77889';

const timestamp = Date.now();
const ID_TICKET_PRUEBA = `tk-auto-${timestamp}`;
const NOMBRE_ASISTENTE = `Usuario Prueba ${timestamp.toString().slice(-4)}`;

let totalPruebas = 0;
let pruebasExitosas = 0;
let pruebasFallidas = 0;
const detallesPruebas = [];

function registrarResultado(id, nombre, integracion, tipo, esperado, obtenido, paso, detalle = '') {
  totalPruebas++;
  if (paso) {
    pruebasExitosas++;
  } else {
    pruebasFallidas++;
  }
  detallesPruebas.push({
    id,
    nombre,
    integracion,
    tipo,
    esperado,
    obtenido,
    resultado: paso ? '[PASO]' : '[FALLO]',
    detalle,
  });
}

async function verificarConectividad() {
  try {
    const respuesta = await fetch(`${CHECKIN_URL}/health`, { signal: AbortSignal.timeout(3000) });
    if (!respuesta.ok) {
      throw new Error(`HTTP ${respuesta.status}`);
    }
    const data = await respuesta.json();
    return data.status === 'ok';
  } catch (err) {
    return false;
  }
}

async function ejecutarSuite() {
  console.log('================================================================================');
  console.log('           SUITE DE PRUEBAS AUTOMATIZADAS DE INTEGRACION - CHECK-IN             ');
  console.log('                        TITEC 2026-2 - Evaluacion 2                            ');
  console.log('================================================================================');
  console.log(`Fecha y hora: ${new Date().toISOString()}`);
  console.log(`Endpoint Check-in: ${CHECKIN_URL}`);
  console.log(`ID Evento objetivo: ${ID_EVENTO_PRUEBA}`);
  console.log(`ID Ticket generado para la sesion: ${ID_TICKET_PRUEBA}`);
  console.log('--------------------------------------------------------------------------------\n');

  console.log('[INFO] Verificando disponibilidad del servicio Check-in...');
  const activo = await verificarConectividad();
  if (!activo) {
    console.error('[ERROR] No se pudo conectar con Check-in en ' + CHECKIN_URL);
    console.error('[INFO] Asegurate de tener los contenedores levantados con: docker compose up -d');
    process.exit(1);
  }
  console.log('[OK] Check-in responde correctamente (/health HTTP 200).\n');

  // ============================================================================
  // INTEGRACION 1: Servicio Ofrecido a Entradas / Inventario (Tipo B)
  // Contrato de Interfaz v2.1
  // ============================================================================
  console.log('--------------------------------------------------------------------------------');
  console.log('SECCION 1: INTEGRACION 1 (I1) - Servicio Ofrecido a Entradas (Contrato v2.1)');
  console.log('Endpoint evaluado: POST /api/v1/checkin/tickets');
  console.log('--------------------------------------------------------------------------------');

  // Caso 1.1: Registro exitoso
  try {
    const payloadValido = {
      id_entrada: ID_TICKET_PRUEBA,
      id_evento: ID_EVENTO_PRUEBA,
      nombre_usuario: NOMBRE_ASISTENTE,
      qr_data: {
        id_evento: ID_EVENTO_PRUEBA,
        id_entrada: ID_TICKET_PRUEBA,
      },
    };

    const res = await fetch(`${CHECKIN_URL}/api/v1/checkin/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadValido),
    });

    const body = await res.json().catch(() => ({}));
    const paso = res.status === 201 && body.mensaje && body.mensaje.includes('Confirmacion');
    registrarResultado(
      'I1-01',
      'Registro de ticket valido (Contrato v2.1)',
      'I1 (Entradas)',
      'Exito',
      'HTTP 201 Created',
      `HTTP ${res.status}`,
      paso,
      paso ? body.mensaje : JSON.stringify(body)
    );
  } catch (e) {
    registrarResultado('I1-01', 'Registro de ticket valido', 'I1 (Entradas)', 'Exito', 'HTTP 201', 'Error de red', false, e.message);
  }

  // Caso 1.2: Caso de error - Conflicto de duplicado (409)
  try {
    const payloadDuplicado = {
      id_entrada: ID_TICKET_PRUEBA,
      id_evento: ID_EVENTO_PRUEBA,
      nombre_usuario: NOMBRE_ASISTENTE,
      qr_data: {
        id_evento: ID_EVENTO_PRUEBA,
        id_entrada: ID_TICKET_PRUEBA,
      },
    };

    const res = await fetch(`${CHECKIN_URL}/api/v1/checkin/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadDuplicado),
    });

    const body = await res.json().catch(() => ({}));
    const paso = res.status === 409 && body.error?.code === 'TICKET_ALREADY_EXISTS';
    registrarResultado(
      'I1-02',
      'Rechazo de ticket duplicado (Idempotencia)',
      'I1 (Entradas)',
      'Error',
      'HTTP 409 TICKET_ALREADY_EXISTS',
      `HTTP ${res.status} ${body.error?.code || ''}`,
      paso,
      body.error?.message || ''
    );
  } catch (e) {
    registrarResultado('I1-02', 'Rechazo de duplicado', 'I1 (Entradas)', 'Error', 'HTTP 409', 'Error de red', false, e.message);
  }

  // Caso 1.3: Caso de error - Campos no permitidos por contrato
  try {
    const payloadInvalido = {
      id_entrada: `tk-err-${Date.now()}`,
      id_evento: ID_EVENTO_PRUEBA,
      nombre_usuario: 'Usuario Invalido',
      qr_data: { id_evento: ID_EVENTO_PRUEBA, id_entrada: 'tk-err' },
      campo_extra_no_autorizado: 'valor_prohibido',
    };

    const res = await fetch(`${CHECKIN_URL}/api/v1/checkin/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadInvalido),
    });

    const body = await res.json().catch(() => ({}));
    const paso = res.status === 400 && body.error?.code === 'INVALID_REQUEST';
    registrarResultado(
      'I1-03',
      'Rechazo por campos no permitidos por el contrato',
      'I1 (Entradas)',
      'Error',
      'HTTP 400 INVALID_REQUEST',
      `HTTP ${res.status} ${body.error?.code || ''}`,
      paso,
      body.error?.message || ''
    );
  } catch (e) {
    registrarResultado('I1-03', 'Rechazo campos no permitidos', 'I1 (Entradas)', 'Error', 'HTTP 400', 'Error de red', false, e.message);
  }

  // Caso 1.4: Caso de error - Desalineacion de QR (QR Mismatch)
  try {
    const payloadMismatch = {
      id_entrada: `tk-mis-${Date.now()}`,
      id_evento: ID_EVENTO_PRUEBA,
      nombre_usuario: 'Usuario Mismatch',
      qr_data: {
        id_evento: ID_EVENTO_PRUEBA,
        id_entrada: 'otro-ticket-distinto',
      },
    };

    const res = await fetch(`${CHECKIN_URL}/api/v1/checkin/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadMismatch),
    });

    const body = await res.json().catch(() => ({}));
    const paso = res.status === 400 && body.error?.code === 'QR_MISMATCH';
    registrarResultado(
      'I1-04',
      'Rechazo por discrepancia entre ticket y payload QR',
      'I1 (Entradas)',
      'Error',
      'HTTP 400 QR_MISMATCH',
      `HTTP ${res.status} ${body.error?.code || ''}`,
      paso,
      body.error?.message || ''
    );
  } catch (e) {
    registrarResultado('I1-04', 'Rechazo por discrepancia QR', 'I1 (Entradas)', 'Error', 'HTTP 400', 'Error de red', false, e.message);
  }

  // ============================================================================
  // INTEGRACION 2: Servicio Consumido desde Panel Organizador (Tipo A)
  // Contrato de Interfaz v1.2 (§3.4: GET /api/v1/panel/eventos/{id_evento})
  // ============================================================================
  console.log('\n--------------------------------------------------------------------------------');
  console.log('SECCION 2: INTEGRACION 2 (I2) - Servicio Consumido de Panel (Contrato v1.2)');
  console.log('Endpoint evaluado: POST /api/v1/checkin/validaciones');
  console.log('--------------------------------------------------------------------------------');

  // Caso 2.1: Validacion exitosa con consulta en vivo a Panel Organizador
  try {
    const validacionValida = {
      id_entrada: ID_TICKET_PRUEBA,
      id_evento: ID_EVENTO_PRUEBA,
    };

    const res = await fetch(`${CHECKIN_URL}/api/v1/checkin/validaciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validacionValida),
    });

    const body = await res.json().catch(() => ({}));
    const paso = res.status === 200 && body.valido === true && body.motivo === 'TICKET_FOUND' && body.evento && body.evento.estado_gestion === 'PUBLICADO';
    registrarResultado(
      'I2-01',
      'Validacion en puerta con estado PUBLICADO de Panel',
      'I2 (Panel)',
      'Exito',
      'HTTP 200 (valido: true, PUBLICADO)',
      `HTTP ${res.status} (valido: ${body.valido}, ${body.evento?.estado_gestion || 'sin estado'})`,
      paso,
      body.evento ? `Evento: ${body.evento.nombre_evento} | Sede: ${body.evento.direccion_evento}` : 'No se recibio bloque evento de Panel'
    );
  } catch (e) {
    registrarResultado('I2-01', 'Validacion en puerta con Panel', 'I2 (Panel)', 'Exito', 'HTTP 200', 'Error de red', false, e.message);
  }

  // Caso 2.2: Caso de error - Ticket inexistente
  try {
    const ticketInexistente = {
      id_entrada: 'tk-inexistente-99999',
      id_evento: ID_EVENTO_PRUEBA,
    };

    const res = await fetch(`${CHECKIN_URL}/api/v1/checkin/validaciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ticketInexistente),
    });

    const body = await res.json().catch(() => ({}));
    const paso = res.status === 200 && body.valido === false && body.motivo === 'TICKET_NOT_FOUND';
    registrarResultado(
      'I2-02',
      'Rechazo de acceso por ticket no encontrado',
      'I2 (Panel)',
      'Error',
      'HTTP 200 (valido: false, TICKET_NOT_FOUND)',
      `HTTP ${res.status} (valido: ${body.valido}, motivo: ${body.motivo})`,
      paso,
      'Acceso denegado correctamente'
    );
  } catch (e) {
    registrarResultado('I2-02', 'Rechazo ticket no encontrado', 'I2 (Panel)', 'Error', 'HTTP 200', 'Error de red', false, e.message);
  }

  // Caso 2.3: Caso de error - Discrepancia de evento (Event Mismatch)
  try {
    const eventoErroneo = {
      id_entrada: ID_TICKET_PRUEBA,
      id_evento: 'evt-otro-evento-distinto',
    };

    const res = await fetch(`${CHECKIN_URL}/api/v1/checkin/validaciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventoErroneo),
    });

    const body = await res.json().catch(() => ({}));
    const paso = res.status === 200 && body.valido === false && body.motivo === 'EVENT_MISMATCH';
    registrarResultado(
      'I2-03',
      'Rechazo de acceso por discrepancia de evento (EVENT_MISMATCH)',
      'I2 (Panel)',
      'Error',
      'HTTP 200 (valido: false, EVENT_MISMATCH)',
      `HTTP ${res.status} (valido: ${body.valido}, motivo: ${body.motivo})`,
      paso,
      'Se previene acceso cruzado entre distintos eventos'
    );
  } catch (e) {
    registrarResultado('I2-03', 'Rechazo por discrepancia de evento', 'I2 (Panel)', 'Error', 'HTTP 200', 'Error de red', false, e.message);
  }

  // ============================================================================
  // TABLA DE RESULTADOS DE PRUEBA
  // ============================================================================
  console.log('\n================================================================================');
  console.log('                          RESUMEN DE RESULTADOS                                 ');
  console.log('================================================================================');
  console.log(
    'ID'.padEnd(7) +
    'INTEGRACION'.padEnd(14) +
    'CASO'.padEnd(7) +
    'RESULTADO'.padEnd(10) +
    'DESCRIPCION'
  );
  console.log('-'.repeat(80));

  for (const p of detallesPruebas) {
    console.log(
      p.id.padEnd(7) +
      p.integracion.padEnd(14) +
      p.tipo.padEnd(7) +
      p.resultado.padEnd(10) +
      p.nombre
    );
    if (p.detalle) {
      console.log('       -> Detalle: ' + p.detalle);
    }
  }

  console.log('-'.repeat(80));
  console.log(`Total de pruebas ejecutadas: ${totalPruebas}`);
  console.log(`Pruebas exitosas (Aprobadas): ${pruebasExitosas}`);
  console.log(`Pruebas fallidas:            ${pruebasFallidas}`);
  console.log('================================================================================');

  if (pruebasFallidas === 0) {
    console.log('[CONFORME] Todas las pruebas de interoperabilidad pasaron exitosamente.');
    console.log('Cumplimiento total de Calidad (CA1) segun rubrica TITEC 2026-2.');
    process.exit(0);
  } else {
    console.error(`[ALERTA] ${pruebasFallidas} prueba(s) no cumplieron el resultado esperado.`);
    process.exit(1);
  }
}

ejecutarSuite().catch((err) => {
  console.error('[FATAL] Error en la ejecucion de la suite de pruebas:', err);
  process.exit(1);
});

