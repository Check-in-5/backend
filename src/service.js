import { error_api } from './errors.js';

function validar_cuerpo(cuerpo, campo) {
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo) || Object.keys(cuerpo).some(clave => !Object.hasOwn(campo, clave))) {
    throw new error_api(400, 'INVALID_REQUEST', 'El cuerpo debe contener únicamente los campos especificados.');
  }
  for (const [clave, maximo] of Object.entries(campo)) {
    if (typeof cuerpo[clave] !== 'string' || !cuerpo[clave].trim() || cuerpo[clave].length > maximo || cuerpo[clave] !== cuerpo[clave].trim()) {
      throw new error_api(400, 'INVALID_REQUEST', clave + ' debe ser un texto de 1 a ' + maximo + ' caracteres, sin espacios al inicio o al final.');
    }
  }
}

async function consultar_entradas_service(id_ticket) {
  const base_url = process.env.ENTRADAS_SERVICE_URL || 'http://entradas-service:3000';
  const id_codificado = encodeURIComponent(id_ticket);
  // Contrato v1.1 Proveedor de Entradas: GET /api/v1/entradas/{id_ticket}
  const ruta = `${base_url}/api/v1/entradas/${id_codificado}`;

  try {
    console.log(`[Check-in -> Entradas] GET ${ruta}`);
    const respuesta = await fetch(ruta, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(3000),
    });
    console.log(`[Check-in <- Entradas] HTTP ${respuesta.status}`);
    if (respuesta.ok) {
      return await respuesta.json();
    }
  } catch (e) {
    console.log(`[Check-in <- Entradas] Error de conexión: ${e.message}`);
  }
  return null;
}

async function consultar_panel_service(id_evento) {
  const base_url = process.env.PANEL_SERVICE_URL || 'http://organizador-service:3000';
  const id_codificado = encodeURIComponent(id_evento);

  // Contrato Panel Organizador ↔ Check-in v1.2 §3.4: GET /api/v1/panel/eventos/{id_evento}
  const ruta = `${base_url}/api/v1/panel/eventos/${id_codificado}`;

  try {
    console.log(`[Check-in -> Panel] GET ${ruta}`);
    const respuesta = await fetch(ruta, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(2000),
    });
    console.log(`[Check-in <- Panel] HTTP ${respuesta.status}`);
    if (respuesta.ok) {
      return await respuesta.json();
    }
  } catch (e) {
    console.log(`[Check-in <- Panel] Error de conexión: ${e.message}`);
  }
  return null;
}

export function crear_servicio(repositorio) {
  return {
    async registrar(cuerpo) {
      if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
        throw new error_api(400, 'INVALID_REQUEST', 'El cuerpo debe ser un objeto JSON.');
      }

      // Contrato v2.1: id_entrada, id_evento, nombre_usuario, qr_data (id_usuario opcional por compatibilidad)
      const campos_permitidos = new Set(['id_entrada', 'id_evento', 'nombre_usuario', 'qr_data', 'id_usuario']);
      if (Object.keys(cuerpo).some(clave => !campos_permitidos.has(clave))) {
        throw new error_api(400, 'INVALID_REQUEST', 'El cuerpo contiene campos no permitidos por el contrato.');
      }

      const campos_texto = { id_entrada: 128, id_evento: 128, nombre_usuario: 200 };
      for (const [clave, maximo] of Object.entries(campos_texto)) {
        if (typeof cuerpo[clave] !== 'string' || !cuerpo[clave].trim() || cuerpo[clave].length > maximo || cuerpo[clave] !== cuerpo[clave].trim()) {
          throw new error_api(400, 'INVALID_REQUEST', `${clave} debe ser un texto de 1 a ${maximo} caracteres, sin espacios al inicio o al final.`);
        }
      }

      if (cuerpo.id_usuario !== undefined) {
        if (typeof cuerpo.id_usuario !== 'string' || !cuerpo.id_usuario.trim() || cuerpo.id_usuario.length > 255) {
          throw new error_api(400, 'INVALID_REQUEST', 'id_usuario debe ser un texto válido.');
        }
      }

      // Regla de Negocio Contrato v2.1: Objeto JSON con la información codificada del código QR. Debe contener estrictamente id_evento e id_entrada.
      if (!cuerpo.qr_data || typeof cuerpo.qr_data !== 'object' || Array.isArray(cuerpo.qr_data)) {
        throw new error_api(400, 'INVALID_REQUEST', 'qr_data debe ser un objeto JSON.');
      }

      const llaves_qr = Object.keys(cuerpo.qr_data);
      if (llaves_qr.length !== 2 || !Object.hasOwn(cuerpo.qr_data, 'id_evento') || !Object.hasOwn(cuerpo.qr_data, 'id_entrada')) {
        throw new error_api(400, 'INVALID_REQUEST', 'qr_data debe contener estrictamente las llaves id_evento e id_entrada.');
      }

      if (typeof cuerpo.qr_data.id_evento !== 'string' || !cuerpo.qr_data.id_evento.trim() ||
          typeof cuerpo.qr_data.id_entrada !== 'string' || !cuerpo.qr_data.id_entrada.trim()) {
        throw new error_api(400, 'INVALID_REQUEST', 'id_evento e id_entrada dentro de qr_data deben ser textos no vacíos.');
      }

      if (cuerpo.qr_data.id_evento.trim() !== cuerpo.id_evento || cuerpo.qr_data.id_entrada.trim() !== cuerpo.id_entrada) {
        throw new error_api(400, 'QR_MISMATCH', 'id_evento e id_entrada dentro de qr_data deben coincidir con los del ticket.');
      }

      const insertado = await repositorio.insertar({ 
        id_entrada: cuerpo.id_entrada, 
        id_evento: cuerpo.id_evento, 
        id_usuario: cuerpo.id_usuario || 'usr-externo',
        nombre_usuario: cuerpo.nombre_usuario,
        qr_data: cuerpo.qr_data 
      });
      
      if (!insertado) throw new error_api(409, 'TICKET_ALREADY_EXISTS', 'El ticket ya se encuentra registrado en el sistema de Check-in.');
    },
    
    async validar(cuerpo) {
      validar_cuerpo(cuerpo, { id_entrada: 128, id_evento: 128 });
      
      // 1. Consultar si ya existe en la base de datos local de Check-in (precargado desde Entradas)
      let entrada = await repositorio.buscar_por_id(cuerpo.id_entrada);
      
      // 2. Si la base de datos local no lo tiene aún, consultar al contenedor de Entradas (fallback Contrato v1.1):
      if (!entrada) {
        const datos_remotos = await consultar_entradas_service(cuerpo.id_entrada);
        if (!datos_remotos) {
          return { valido: false, motivo: 'TICKET_NOT_FOUND' };
        }
        
        const id_usuario = datos_remotos.usuario?.id_usuario || datos_remotos.id_usuario || 'usr-externo';
        const nombre_usuario = datos_remotos.nombre_usuario || 'Asistente Verificado';
        const evento_remoto = datos_remotos.id_evento || cuerpo.id_evento;
        const qr_data = { id_evento: cuerpo.id_evento, id_entrada: cuerpo.id_entrada };

        // Persistir en MySQL el ticket sincronizado desde Entradas
        await repositorio.insertar({
          id_entrada: cuerpo.id_entrada,
          id_evento: evento_remoto,
          id_usuario,
          nombre_usuario,
          qr_data,
        });

        entrada = {
          id_entrada: cuerpo.id_entrada,
          id_evento: evento_remoto,
          id_usuario,
          nombre_usuario,
        };
      } else {
        if (entrada.id_evento !== cuerpo.id_evento) {
          return { valido: false, motivo: 'EVENT_MISMATCH' };
        }
      }

      // 3. Consultar y validar información del evento con Panel Organizador (Contrato Panel ↔ Check-in v1.2)
      let datos_evento = null;
      try {
        datos_evento = await consultar_panel_service(cuerpo.id_evento);
      } catch {
        // En caso de fallo o timeout de Panel, continuar con copia local/modo autónomo (§3.1)
      }

      if (datos_evento) {
        // Regla 4: Si estado_gestion es CANCELADO o FINALIZADO, Check-in rechaza la entrada
        if (datos_evento.estado_gestion === 'CANCELADO') {
          return { valido: false, motivo: 'EVENTO_CANCELADO', evento: datos_evento };
        }
        if (datos_evento.estado_gestion === 'FINALIZADO') {
          return { valido: false, motivo: 'EVENTO_FINALIZADO', evento: datos_evento };
        }
      }

      // 4. Registrar asistencia en la tabla registro_asistencia de MySQL
      if (repositorio.registrar_asistencia) {
        await repositorio.registrar_asistencia({
          id_entrada: entrada.id_entrada,
          id_evento: entrada.id_evento,
          id_usuario: entrada.id_usuario || 'usr-anon',
        }).catch(() => {});
      }
      
      const respuesta = { valido: true, motivo: 'TICKET_FOUND', ticket: entrada };
      if (datos_evento) {
        respuesta.evento = {
          nombre_evento: datos_evento.nombre_evento,
          direccion_evento: datos_evento.direccion_evento,
          fecha_evento: datos_evento.fecha_evento,
          hora_evento: datos_evento.hora_evento,
          hora_fin_evento: datos_evento.hora_fin_evento,
          estado_gestion: datos_evento.estado_gestion,
        };
      }
      return respuesta;
    },
  };
}