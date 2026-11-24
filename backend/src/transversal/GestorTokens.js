import { createHmac, timingSafeEqual } from 'node:crypto';
import { NoAutenticadoError } from '../dominio/errores.js';

const ENCABEZADO = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

/**
 * RN-S05: token firmado (JWT HS256) que identifica la sesión.
 * Solo se acepta HS256 (se rechaza alg "none" u otros) y se valida el vencimiento.
 * El token por sí solo no alcanza: el middleware verifica además que la sesión
 * no haya sido cerrada (logout, bloqueo o cambio de contraseña).
 */
export class GestorTokens {
  #clave;

  constructor(clave) {
    if (!Buffer.isBuffer(clave) || clave.length < 32) throw new Error('La clave de tokens debe tener 32 bytes.');
    this.#clave = clave;
  }

  firmar(contenido) {
    const cuerpo = Buffer.from(JSON.stringify(contenido)).toString('base64url');
    return `${ENCABEZADO}.${cuerpo}.${this.#firma(`${ENCABEZADO}.${cuerpo}`).toString('base64url')}`;
  }

  verificar(token, ahora = new Date()) {
    const invalido = () => new NoAutenticadoError('La sesión no es válida. Inicie sesión nuevamente.', 'RN-S05');
    if (typeof token !== 'string') throw invalido();
    const partes = token.split('.');
    if (partes.length !== 3) throw invalido();
    const [encabezado, cuerpo, firma] = partes;

    const esperada = this.#firma(`${encabezado}.${cuerpo}`);
    const recibida = Buffer.from(firma, 'base64url');
    if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) throw invalido();

    let datosEncabezado;
    let contenido;
    try {
      datosEncabezado = JSON.parse(Buffer.from(encabezado, 'base64url').toString('utf8'));
      contenido = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
    } catch {
      throw invalido();
    }
    if (datosEncabezado.alg !== 'HS256') throw invalido();
    if (typeof contenido.exp !== 'number' || contenido.exp * 1000 <= ahora.getTime()) {
      throw new NoAutenticadoError('La sesión expiró. Inicie sesión nuevamente.', 'RN-S05');
    }
    return contenido;
  }

  #firma(texto) {
    return createHmac('sha256', this.#clave).update(texto).digest();
  }
}
