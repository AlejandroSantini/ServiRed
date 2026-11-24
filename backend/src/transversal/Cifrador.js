import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * RN-S10: cifrado reversible de datos personales sensibles (teléfono, y en la
 * Iteración 3 la dirección del servicio) con AES-256-GCM. GCM además detecta
 * si el texto cifrado fue alterado. Formato: v1:<iv>:<tag>:<datos> en base64.
 */
export class Cifrador {
  #clave;

  constructor(clave) {
    if (!Buffer.isBuffer(clave) || clave.length < 32) throw new Error('La clave de cifrado debe tener 32 bytes.');
    this.#clave = clave.subarray(0, 32);
  }

  cifrar(texto) {
    if (texto === null || texto === undefined) return null;
    const iv = randomBytes(12);
    const cifrador = createCipheriv('aes-256-gcm', this.#clave, iv);
    const datos = Buffer.concat([cifrador.update(String(texto), 'utf8'), cifrador.final()]);
    const tag = cifrador.getAuthTag();
    return ['v1', iv.toString('base64'), tag.toString('base64'), datos.toString('base64')].join(':');
  }

  descifrar(textoCifrado) {
    if (textoCifrado === null || textoCifrado === undefined) return null;
    const [version, iv, tag, datos] = String(textoCifrado).split(':');
    if (version !== 'v1' || !iv || !tag || datos === undefined) throw new Error('Formato de dato cifrado desconocido.');
    const descifrador = createDecipheriv('aes-256-gcm', this.#clave, Buffer.from(iv, 'base64'));
    descifrador.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([descifrador.update(Buffer.from(datos, 'base64')), descifrador.final()]).toString('utf8');
  }
}
