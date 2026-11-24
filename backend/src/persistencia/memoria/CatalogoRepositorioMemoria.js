import { CatalogoRepositorio } from '../contratos/CatalogoRepositorio.js';

const TABLAS = new Set(['zona', 'categoria_oficio']);

export class CatalogoRepositorioMemoria extends CatalogoRepositorio {
  #bd;

  constructor({ bd }) {
    super();
    this.#bd = bd;
  }

  async listarFilas(tabla) {
    if (!TABLAS.has(tabla)) throw new Error(`Catálogo desconocido: ${tabla}`);
    return this.#bd.seleccionar(tabla).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  async asegurarFilas(tabla, nombres) {
    if (!TABLAS.has(tabla)) throw new Error(`Catálogo desconocido: ${tabla}`);
    for (const nombre of nombres) {
      if (!this.#bd.tabla(tabla).some((f) => f.nombre === nombre)) {
        this.#bd.insertar(tabla, { id: this.#bd.siguienteId(tabla), nombre });
      }
    }
  }
}
