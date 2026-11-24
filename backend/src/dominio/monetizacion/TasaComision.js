import { ReglaNegocioError } from '../errores.js';
import { CategoriaOficio } from '../usuarios/CategoriaOficio.js';

/** RN-K01: porcentaje de comisión general (categoria null) o por categoría de oficio. */
export class TasaComision {
  #id;
  #categoria;
  #porcentaje;
  #fechaActualizacion;

  constructor({ id = null, categoria = null, porcentaje, fechaActualizacion }) {
    if (categoria !== null && !(categoria instanceof CategoriaOficio)) throw new TypeError('Categoría inválida.');
    this.#id = id;
    this.#categoria = categoria;
    this.#porcentaje = TasaComision.validar(porcentaje);
    this.#fechaActualizacion = fechaActualizacion;
  }

  static validar(porcentaje) {
    const valor = Number(porcentaje);
    if (porcentaje === null || porcentaje === '' || !Number.isFinite(valor) || valor < 0 || valor > 100) {
      throw new ReglaNegocioError('El porcentaje de comisión debe estar entre 0 y 100.', 'RN-K01');
    }
    return Math.round(valor * 100) / 100;
  }

  get id() { return this.#id; }
  get categoria() { return this.#categoria; }
  get porcentaje() { return this.#porcentaje; }
  get fechaActualizacion() { return this.#fechaActualizacion; }
  esGeneral() { return this.#categoria === null; }

  asignarId(id) {
    if (this.#id !== null) throw new Error('La tasa ya tiene identificador.');
    this.#id = id;
  }

  actualizar(porcentaje, ahora) {
    this.#porcentaje = TasaComision.validar(porcentaje);
    this.#fechaActualizacion = ahora;
  }

  aJSON() {
    return {
      id: this.#id, categoria: this.#categoria?.toJSON() ?? null, general: this.esGeneral(),
      porcentaje: this.#porcentaje, fechaActualizacion: this.#fechaActualizacion.toISOString(),
    };
  }
}
