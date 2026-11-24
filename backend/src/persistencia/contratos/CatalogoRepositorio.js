import { noImplementado } from './noImplementado.js';
import { ReglaNegocioError } from '../../dominio/errores.js';
import { Zona } from '../../dominio/usuarios/Zona.js';
import { CategoriaOficio } from '../../dominio/usuarios/CategoriaOficio.js';

/** Contrato de los catálogos de referencia (zona, categoria_oficio). */
export class CatalogoRepositorio {
  /** @returns {Promise<Array<{id:number, nombre:string}>>} */
  async listarFilas(_tabla) { throw noImplementado('CatalogoRepositorio', 'listarFilas'); }

  /** Inserta los nombres que todavía no existen (datos iniciales). */
  async asegurarFilas(_tabla, _nombres) { throw noImplementado('CatalogoRepositorio', 'asegurarFilas'); }

  async listarZonas() { return (await this.listarFilas('zona')).map((f) => new Zona(f.id, f.nombre)); }

  async listarCategorias() {
    return (await this.listarFilas('categoria_oficio')).map((f) => new CategoriaOficio(f.id, f.nombre));
  }

  async obtenerZonas(ids) { return this.#obtener(await this.listarZonas(), ids, 'zona'); }

  async obtenerCategorias(ids) { return this.#obtener(await this.listarCategorias(), ids, 'categoría de oficio'); }

  #obtener(todos, ids, descripcion) {
    const lista = Array.isArray(ids) ? ids : [ids];
    return lista.map((id) => {
      const encontrado = todos.find((e) => e.id === Number(id));
      if (!encontrado) throw new ReglaNegocioError(`Debe indicar una ${descripcion} válida.`, 'DATOS');
      return encontrado;
    });
  }
}
