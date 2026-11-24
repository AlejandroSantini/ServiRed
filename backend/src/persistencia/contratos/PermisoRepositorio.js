import { noImplementado } from './noImplementado.js';

/** Contrato del repositorio de permisos (patentes y familias del Composite). */
export class PermisoRepositorio {
  /** @returns {Promise<Map<string, import('../../dominio/seguridad/Componente.js').Componente>>} árbol completo por código */
  async obtenerTodos() { throw noImplementado('PermisoRepositorio', 'obtenerTodos'); }

  /** Inserta o actualiza un permiso; si es familia, también sus hijos directos. */
  async guardar(_componente) { throw noImplementado('PermisoRepositorio', 'guardar'); }

  async obtenerPorCodigo(codigo) {
    return (await this.obtenerTodos()).get(codigo) ?? null;
  }

  async obtenerPorIds(ids) {
    const buscados = new Set(ids.map(Number));
    return [...(await this.obtenerTodos()).values()].filter((c) => buscados.has(c.id));
  }
}
