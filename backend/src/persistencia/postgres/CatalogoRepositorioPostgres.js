import { CatalogoRepositorio } from '../contratos/CatalogoRepositorio.js';

const COLUMNA_ID = Object.freeze({ zona: 'id_zona', categoria_oficio: 'id_categoria' });

export class CatalogoRepositorioPostgres extends CatalogoRepositorio {
  #bd;

  constructor({ bd }) {
    super();
    this.#bd = bd;
  }

  async listarFilas(tabla) {
    const id = CatalogoRepositorioPostgres.#columnaId(tabla);
    return (await this.#bd.consultar(`SELECT ${id} AS id, nombre FROM ${tabla} ORDER BY nombre`)).rows;
  }

  async asegurarFilas(tabla, nombres) {
    CatalogoRepositorioPostgres.#columnaId(tabla);
    for (const nombre of nombres) {
      await this.#bd.consultar(`INSERT INTO ${tabla} (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING`, [nombre]);
    }
  }

  static #columnaId(tabla) {
    const columna = COLUMNA_ID[tabla];
    if (!columna) throw new Error(`Catálogo desconocido: ${tabla}`);
    return columna;
  }
}
