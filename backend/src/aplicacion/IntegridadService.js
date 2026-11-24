import { Criticidad } from '../dominio/seguridad/Criticidad.js';

/** RN-S09: verificación y recálculo de los dígitos verificadores. */
export class IntegridadService {
  #repositorio;
  #bitacora;
  #reloj;

  constructor({ integridadRepositorio, bitacora, reloj }) {
    this.#repositorio = integridadRepositorio;
    this.#bitacora = bitacora;
    this.#reloj = reloj;
  }

  async verificar() {
    const inconsistencias = [];
    for (const tabla of this.#repositorio.tablasControladas()) {
      const filas = await this.#repositorio.obtenerFilas(tabla);
      for (const fila of filas) {
        if (fila.dvh !== this.#repositorio.calcularDVH(tabla, fila)) {
          inconsistencias.push({ tabla, tipo: 'DVH', fila: this.#repositorio.claveDe(tabla, fila) });
        }
      }
      const dvvGuardado = await this.#repositorio.obtenerDVV(tabla);
      const dvvEsperado = filas.length === 0 && dvvGuardado === null ? null : this.#repositorio.calcularDVVDeFilas(filas);
      if (dvvGuardado !== dvvEsperado) inconsistencias.push({ tabla, tipo: 'DVV' });
    }
    return { integra: inconsistencias.length === 0, inconsistencias, fecha: this.#reloj.ahora().toISOString() };
  }

  /** El administrador revisó la inconsistencia y acepta los datos actuales como válidos. */
  async recalcular(actor, { ip = null } = {}) {
    const antes = await this.verificar();
    for (const tabla of this.#repositorio.tablasControladas()) await this.#repositorio.recalcular(tabla);
    await this.#bitacora.registrar({
      usuario: actor,
      modulo: 'Integridad',
      evento: 'Recálculo de dígitos verificadores',
      descripcion: `Inconsistencias antes del recálculo: ${antes.inconsistencias.length}`,
      criticidad: Criticidad.ALTA,
      ip,
    });
    return this.verificar();
  }
}
