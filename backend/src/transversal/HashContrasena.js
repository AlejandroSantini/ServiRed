import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const COSTO_MAXIMO = 2 ** 17;

/**
 * RNF03 / RF02: la contraseña se guarda con hash (scrypt, función lenta y con sal
 * aleatoria por usuario). Formato guardado: scrypt$<costo>$<sal>$<hash>.
 * Es irreversible: para validar se vuelve a calcular y se compara en tiempo constante.
 */
export class HashContrasena {
  #costo;

  constructor({ costo = 2 ** 15 } = {}) {
    this.#costo = costo;
  }

  async generar(contrasena) {
    const sal = randomBytes(16);
    const derivada = await this.#derivar(contrasena, sal, this.#costo, 64);
    return `scrypt$${this.#costo}$${sal.toString('base64')}$${derivada.toString('base64')}`;
  }

  async verificar(contrasena, hashGuardado) {
    const partes = String(hashGuardado ?? '').split('$');
    if (partes.length !== 4 || partes[0] !== 'scrypt') return false;
    const costo = Number(partes[1]);
    if (!Number.isInteger(costo) || costo < 2 || costo > COSTO_MAXIMO) return false;
    const sal = Buffer.from(partes[2], 'base64');
    const esperado = Buffer.from(partes[3], 'base64');
    if (esperado.length === 0) return false;
    const derivada = await this.#derivar(contrasena, sal, costo, esperado.length);
    return timingSafeEqual(derivada, esperado);
  }

  #derivar(contrasena, sal, costo, largo) {
    return scryptAsync(String(contrasena).normalize('NFKC'), sal, largo, {
      N: costo, r: 8, p: 1, maxmem: 256 * costo * 8,
    });
  }
}
