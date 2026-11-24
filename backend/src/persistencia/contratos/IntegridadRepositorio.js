import { noImplementado } from './noImplementado.js';
import { TABLAS_CONTROLADAS, definicionTabla, claveDeFila } from '../tablasControladas.js';

/**
 * Acceso a los dígitos verificadores (RN-S09).
 * Los métodos abstractos leen y escriben filas y DVV; la lógica de cálculo es
 * común a todas las implementaciones y está en esta clase base.
 * `ejecutor` permite trabajar dentro de la misma transacción que la escritura.
 */
export class IntegridadRepositorio {
  #digitoVerificador;

  constructor(digitoVerificador) {
    this.#digitoVerificador = digitoVerificador;
  }

  // ---- Abstractos ----

  /** Filas de la tabla ordenadas por clave, con sus columnas verificables y el dvh. */
  async obtenerFilas(_tabla, _ejecutor) { throw noImplementado('IntegridadRepositorio', 'obtenerFilas'); }

  async obtenerDVV(_tabla, _ejecutor) { throw noImplementado('IntegridadRepositorio', 'obtenerDVV'); }

  async guardarDVV(_tabla, _dvv, _ejecutor) { throw noImplementado('IntegridadRepositorio', 'guardarDVV'); }

  async actualizarDVH(_tabla, _fila, _dvh, _ejecutor) { throw noImplementado('IntegridadRepositorio', 'actualizarDVH'); }

  /** Ejecuta `trabajo(ejecutor)` en una transacción (en memoria no hace falta). */
  async transaccion(trabajo) { return trabajo(undefined); }

  /** Evita que dos escrituras concurrentes calculen el DVV a la vez (en memoria no hace falta). */
  async bloquearTabla(_tabla, _ejecutor) {}

  // ---- Comunes ----

  tablasControladas() { return Object.keys(TABLAS_CONTROLADAS); }

  claveDe(tabla, fila) { return claveDeFila(tabla, fila); }

  calcularDVH(tabla, fila) {
    return this.#digitoVerificador.calcularDVH(definicionTabla(tabla).columnas.map((c) => fila[c]));
  }

  calcularDVVDeFilas(filas) {
    return this.#digitoVerificador.calcularDVV(filas.map((f) => f.dvh ?? ''));
  }

  /** Calcula y guarda el DVH de una fila recién escrita. */
  async sellarFila(tabla, fila, ejecutor) {
    const dvh = this.calcularDVH(tabla, fila);
    await this.actualizarDVH(tabla, fila, dvh, ejecutor);
    return dvh;
  }

  async dvvCoincide(tabla, ejecutor) {
    const [filas, guardado] = await Promise.all([this.obtenerFilas(tabla, ejecutor), this.obtenerDVV(tabla, ejecutor)]);
    if (guardado === null) return filas.length === 0;
    return guardado === this.calcularDVVDeFilas(filas);
  }

  /**
   * Envuelve una escritura sobre tablas controladas: al terminar recalcula el DVV.
   * Si la tabla YA estaba alterada antes de escribir, no se recalcula: así una
   * escritura legítima no "tapa" una modificación externa (por ejemplo, una fila
   * borrada a mano) y la inconsistencia sigue visible hasta que el administrador
   * la revise y recalcule.
   */
  async conIntegridad(tablas, escribir, ejecutor) {
    for (const tabla of tablas) await this.bloquearTabla(tabla, ejecutor);
    const estabanIntegras = new Map();
    for (const tabla of tablas) estabanIntegras.set(tabla, await this.dvvCoincide(tabla, ejecutor));
    const resultado = await escribir();
    for (const tabla of tablas) {
      if (estabanIntegras.get(tabla)) {
        await this.guardarDVV(tabla, this.calcularDVVDeFilas(await this.obtenerFilas(tabla, ejecutor)), ejecutor);
      }
    }
    return resultado;
  }

  /** Recalcula todos los DVH y el DVV de una tabla (acción del administrador). */
  async recalcular(tabla) {
    return this.transaccion(async (ejecutor) => {
      await this.bloquearTabla(tabla, ejecutor);
      const filas = await this.obtenerFilas(tabla, ejecutor);
      for (const fila of filas) {
        const dvh = this.calcularDVH(tabla, fila);
        if (fila.dvh !== dvh) await this.actualizarDVH(tabla, fila, dvh, ejecutor);
        fila.dvh = dvh;
      }
      await this.guardarDVV(tabla, this.calcularDVVDeFilas(filas), ejecutor);
    });
  }
}
