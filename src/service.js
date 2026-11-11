import { error_api } from './errors.js';
import { publicar_evento } from './rabbitmq.js';

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

export function crear_servicio(repositorio) {
  return {
    async registrar(cuerpo) {
      const campo = { id_entrada: 128, id_evento: 128, id_usuario: 255, nombre_usuario: 200 };
      if (cuerpo && Object.hasOwn(cuerpo, 'qr_data')) campo.qr_data = 128;
      
      validar_cuerpo(cuerpo, campo);
      
      if (cuerpo.qr_data !== undefined && cuerpo.qr_data !== cuerpo.id_entrada) {
        throw new error_api(400, 'QR_MISMATCH', 'qr_data debe coincidir con id_entrada; no se aceptan URLs de imágenes.');
      }
      
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
      
      const entrada = await repositorio.buscar_por_id(cuerpo.id_entrada);
      
      if (!entrada) return { valido: false, motivo: 'TICKET_NOT_FOUND' };
      if (entrada.id_evento !== cuerpo.id_evento) return { valido: false, motivo: 'EVENT_MISMATCH' };
      
      const ingreso_exitoso = await repositorio.registrar_ingreso(
        entrada.id_entrada, 
        entrada.id_evento, 
        entrada.id_usuario
      );

      if (!ingreso_exitoso) {
        return { valido: false, motivo: 'TICKET_ALREADY_USED' };
      }

      const datos_evento = {
        id_entrada: entrada.id_entrada,
        id_evento: entrada.id_evento,
        id_usuario: entrada.id_usuario,
        fecha_checkin: new Date().toISOString()
      };
      
      await publicar_evento('checkin.realizado', datos_evento);

      const { id_usuario, ...ticket_para_operador } = entrada;

      return { valido: true, motivo: 'TICKET_FOUND', ticket: ticket_para_operador };
    },
  };
}