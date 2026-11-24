import { NoAutenticadoError, AccesoDenegadoError } from '../../dominio/errores.js';
import { Criticidad } from '../../dominio/seguridad/Criticidad.js';
import { asincrono } from './manejarErrores.js';

/** Exige un token válido de una sesión abierta. Deja el usuario en req.usuario. */
export function autenticar(autenticacionService) {
  return asincrono(async (req, _res, next) => {
    const [tipo, token] = (req.get('authorization') ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw new NoAutenticadoError('Debe iniciar sesión.', 'RN-S05');
    const { usuario, sesion } = await autenticacionService.validarSesion(token);
    req.usuario = usuario;
    req.sesion = sesion;
    next();
  });
}

/**
 * RNF03 / RN-S06: exige que el usuario tenga la patente (directa o a través de una familia).
 * Con varias patentes alcanza con tener una (por ejemplo, ver solicitudes: cliente o prestador).
 */
export function requierePermiso(codigosPatente, bitacoraService) {
  const codigos = Array.isArray(codigosPatente) ? codigosPatente : [codigosPatente];
  return asincrono(async (req, _res, next) => {
    if (codigos.some((c) => req.usuario?.tienePermiso(c))) return next();
    await bitacoraService.registrar({
      usuario: req.usuario ?? null,
      modulo: 'Seguridad',
      evento: 'Acceso denegado',
      descripcion: `Patente requerida ${codigos.join(' o ')} en ${req.method} ${req.originalUrl}`,
      criticidad: Criticidad.MEDIA,
      ip: req.ip,
    });
    throw new AccesoDenegadoError('No tiene permiso para realizar esta operación.', 'RN-S06');
  });
}
