import { ReglaNegocioError } from '../errores.js';

/** RN-S01: política de contraseñas. */
export class PoliticaContrasena {
  static LONGITUD_MINIMA = 8;
  static LONGITUD_MAXIMA = 64;

  static validar(contrasena, { email } = {}) {
    if (typeof contrasena !== 'string' || contrasena.length === 0) {
      throw new ReglaNegocioError('La contraseña es obligatoria.', 'RN-S01');
    }
    if (contrasena.length < PoliticaContrasena.LONGITUD_MINIMA || contrasena.length > PoliticaContrasena.LONGITUD_MAXIMA) {
      throw new ReglaNegocioError(
        `La contraseña debe tener entre ${PoliticaContrasena.LONGITUD_MINIMA} y ${PoliticaContrasena.LONGITUD_MAXIMA} caracteres.`,
        'RN-S01',
      );
    }
    if (!/\p{L}/u.test(contrasena) || !/\d/.test(contrasena)) {
      throw new ReglaNegocioError('La contraseña debe combinar letras y números.', 'RN-S01');
    }
    const usuarioCorreo = typeof email === 'string' ? email.split('@')[0].trim().toLowerCase() : '';
    if (usuarioCorreo.length >= 3 && contrasena.toLowerCase().includes(usuarioCorreo)) {
      throw new ReglaNegocioError('La contraseña no puede contener el correo electrónico.', 'RN-S01');
    }
  }
}
