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
  const rutas = [
    `${base_url}/api/v1/entradas/${id_codificado}/detalle`,
    `${base_url}/api/entradas/${id_codificado}/detalle`,
    `${base_url}/api/v1/entradas/${id_codificado}`,
    `${base_url}/api/entradas/${id_codificado}`,
    `http://127.0.0.1:3003/api/v1/entradas/${id_codificado}/detalle`,
    `http://localhost:3003/api/v1/entradas/${id_codificado}/detalle`,
  ];

  for (const ruta of rutas) {
    try {
      const respuesta = await fetch(ruta, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(3000),
      });
      if (respuesta.ok) {
        return await respuesta.json();
      }
      if (respuesta.status === 404) {
        return null;
      }
    } catch {
      // Continuar con la siguiente URL de fallback
    }
  }
  return null;
}

export function crear_servicio(repositorio) {
  return {
    async registrar(cuerpo) {
      // Se añade id_usuario para cumplir con la restricción NOT NULL de la nueva tabla MySQL
      const campo = { id_entrada: 128, id_evento: 128, id_usuario: 255, nombre_usuario: 200 };
      if (cuerpo && Object.hasOwn(cuerpo, 'qr_data')) campo.qr_data = 128;
      
      validar_cuerpo(cuerpo, campo);
      
      if (cuerpo.qr_data !== undefined && cuerpo.qr_data !== cuerpo.id_entrada) {
        throw new error_api(400, 'QR_MISMATCH', 'qr_data debe coincidir con id_entrada; no se aceptan URLs de imágenes.');
      }
      
      // Se utiliza await y se pasan los nuevos campos requeridos al repositorio
      const insertado = await repositorio.insertar({ 
        id_entrada: cuerpo.id_entrada, 
        id_evento: cuerpo.id_evento, 
        id_usuario: cuerpo.id_usuario,
        nombre_usuario: cuerpo.nombre_usuario,
        qr_data: cuerpo.qr_data || cuerpo.id_entrada 
      });
      
      if (!insertado) throw new error_api(409, 'TICKET_ALREADY_EXISTS', 'El ticket ya se encuentra registrado en Check-in.');
    },
    
    async validar(cuerpo) {
      validar_cuerpo(cuerpo, { id_entrada: 128, id_evento: 128 });
      
      // 1. Consultar si ya existe en la base de datos local de Check-in
      let entrada = await repositorio.buscar_por_id(cuerpo.id_entrada);
      
      // 2. Si la base de datos está vacía de base o el ticket no ha sido sincronizado,
      //    obtener información mediante API REST hacia el contenedor de Entradas:
      if (!entrada) {
        const datos_remotos = await consultar_entradas_service(cuerpo.id_entrada);
        if (!datos_remotos) {
          return { valido: false, motivo: 'TICKET_NOT_FOUND' };
        }
        
        const evento_remoto = datos_remotos.id_evento || datos_remotos.id_evento_asociado;
        if (evento_remoto && evento_remoto !== cuerpo.id_evento) {
          return { valido: false, motivo: 'EVENT_MISMATCH' };
        }

        const id_usuario = datos_remotos.id_usuario || datos_remotos.usuario?.id_usuario || 'usr-anon';
        const nombre_usuario = datos_remotos.nombre_usuario || 'Asistente Verificado';
        const qr_data = datos_remotos.qr_data || cuerpo.id_entrada;

        // Persistir en MySQL el ticket sincronizado desde Entradas
        await repositorio.insertar({
          id_entrada: cuerpo.id_entrada,
          id_evento: evento_remoto || cuerpo.id_evento,
          id_usuario,
          nombre_usuario,
          qr_data,
        });

        entrada = {
          id_entrada: cuerpo.id_entrada,
          id_evento: evento_remoto || cuerpo.id_evento,
          id_usuario,
          nombre_usuario,
          nombre_evento: datos_remotos.nombre_evento,
          lugar_ingreso: datos_remotos.lugar_ingreso,
          tipo_acceso: datos_remotos.tipo_acceso,
        };
      } else {
        if (entrada.id_evento !== cuerpo.id_evento) {
          return { valido: false, motivo: 'EVENT_MISMATCH' };
        }
      }

      // 3. Registrar asistencia en la tabla registro_asistencia de MySQL
      if (repositorio.registrar_asistencia) {
        await repositorio.registrar_asistencia({
          id_entrada: entrada.id_entrada,
          id_evento: entrada.id_evento,
          id_usuario: entrada.id_usuario || 'usr-anon',
        }).catch(() => {});
      }
      
      return { valido: true, motivo: 'TICKET_FOUND', ticket: entrada };
    },
  };
}