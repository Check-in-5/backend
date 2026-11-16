import { timingSafeEqual as comparar } from 'node:crypto';
import { error_api } from './errors.js';

export function autenticar_servicio(solicitud, _respuesta, continuar) {
  const esperada = process.env.CHECKIN_SERVICE_API_KEY;
  const recibida = solicitud.get('x-api-key');
  if (!esperada) return continuar(new error_api(503, 'AUTH_NOT_CONFIGURED', 'Credencial de servicio no configurada.'));
  if (!recibida || Buffer.byteLength(recibida) !== Buffer.byteLength(esperada) || !comparar(Buffer.from(recibida), Buffer.from(esperada))) {
    return continuar(new error_api(403, 'SERVICE_FORBIDDEN', 'Servicio no autorizado.'));
  }
  continuar();
}

export async function autenticar_personal(solicitud, _respuesta, continuar) {
  const base = process.env.AUTH_SERVICE_URL;
  const clave = process.env.AUTH_INTERNAL_API_KEY;
  if (!base || !clave) return continuar(new error_api(503, 'AUTH_NOT_CONFIGURED', 'Auth no configurado.'));
  if (!solicitud.headers.cookie) return continuar(new error_api(401, 'SESSION_REQUIRED', 'Debes iniciar sesión.'));
  try {
    const respuesta = await fetch(`${base.replace(/\/$/, '')}/internal/validar-sesion`, {
      headers: { Cookie: solicitud.headers.cookie, 'x-api-key': clave },
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
      cache: 'no-store',
    });
    if (respuesta.status === 401) return continuar(new error_api(401, 'INVALID_SESSION', 'Sesión inválida o expirada.'));
    if (!respuesta.ok) throw new Error('Auth rechazó la consulta interna');
    const sesion = await respuesta.json();
    if (sesion.valido !== true || !sesion.usuario?.id_usuario || !sesion.usuario?.rol) throw new Error('Contrato Auth inválido');
    // Por defecto únicamente STAFF puede operar en puerta.
    const roles = (process.env.CHECKIN_ALLOWED_ROLES || 'STAFF').split(',').map(rol => rol.trim().toLowerCase());
    if (!roles.includes(String(sesion.usuario.rol).toLowerCase())) return continuar(new error_api(403, 'ROLE_FORBIDDEN', 'Tu cuenta no tiene permiso para operar Check-in.'));
    solicitud.usuario = sesion.usuario;
    continuar();
  } catch {
    continuar(new error_api(503, 'AUTH_UNAVAILABLE', 'No se pudo verificar la sesión. Intenta nuevamente.'));
  }
}
