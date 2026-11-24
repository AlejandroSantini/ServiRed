import { Componente } from './Componente.js';
import { ReglaNegocioError } from '../errores.js';

/** Compuesto del Composite: agrupa patentes y otras familias (por ejemplo, el rol Administrador). */
export class Familia extends Componente {
  #hijos = [];

  esFamilia() { return true; }

  get hijos() { return [...this.#hijos]; }

  /** RN-S06: sin hijos repetidos y sin ciclos (una familia no puede contenerse a sí misma). */
  agregar(componente) {
    if (!(componente instanceof Componente)) throw new TypeError('Solo se pueden agregar permisos.');
    if (componente.codigo === this.codigo || componente.contiene(this)) {
      throw new ReglaNegocioError(`No se puede agregar ${componente.codigo} a ${this.codigo}: se formaría un ciclo.`, 'RN-S06');
    }
    if (this.#hijos.some((h) => h.codigo === componente.codigo)) {
      throw new ReglaNegocioError(`${this.codigo} ya contiene a ${componente.codigo}.`, 'RN-S06');
    }
    this.#hijos.push(componente);
  }

  quitar(codigo) {
    const indice = this.#hijos.findIndex((h) => h.codigo === codigo);
    if (indice === -1) throw new ReglaNegocioError(`${this.codigo} no contiene a ${codigo}.`, 'RN-S06');
    this.#hijos.splice(indice, 1);
  }

  contiene(componente) {
    return this.#hijos.some((h) => h.codigo === componente.codigo || h.contiene(componente));
  }

  tienePermiso(codigo) {
    return this.#hijos.some((h) => h.tienePermiso(codigo));
  }

  obtenerPatentes() {
    const porCodigo = new Map();
    for (const hijo of this.#hijos) {
      for (const patente of hijo.obtenerPatentes()) porCodigo.set(patente.codigo, patente);
    }
    return [...porCodigo.values()];
  }
}
