import { createHmac } from 'node:crypto';

/**
 * RN-S09: dígitos verificadores.
 *  - DVH (horizontal): uno por fila, calculado sobre sus columnas.
 *  - DVV (vertical): uno por tabla, calculado sobre todos los DVH en orden.
 *
 * Se usa HMAC-SHA256 con una clave secreta (y no una suma de códigos ASCII):
 * quien modifique la base a mano no puede recalcular un dígito válido sin la clave.
 */
export class DigitoVerificador {
  #clave;

  constructor(clave) {
    if (!Buffer.isBuffer(clave) || clave.length < 32) throw new Error('La clave de integridad debe tener 32 bytes.');
    this.#clave = clave;
  }

  static normalizar(valor) {
    if (valor === null || valor === undefined) return '';
    if (valor instanceof Date) return valor.toISOString();
    return String(valor);
  }

  calcularDVH(valores) {
    // JSON evita ambigüedades entre ['a|', 'b'] y ['a', '|b'].
    return this.#hmac(JSON.stringify(valores.map(DigitoVerificador.normalizar)));
  }

  calcularDVV(dvhs) {
    return this.#hmac(dvhs.join(''));
  }

  #hmac(texto) {
    return createHmac('sha256', this.#clave).update(texto, 'utf8').digest('hex');
  }
}
