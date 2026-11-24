import { noImplementado } from './noImplementado.js';

/** Contrato del repositorio de usuarios (Cliente, Prestador y Administrador). */
export class UsuarioRepositorio {
  /** @returns {Promise<import('../../dominio/usuarios/Usuario.js').Usuario|null>} */
  async obtenerPorId(_id) { throw noImplementado('UsuarioRepositorio', 'obtenerPorId'); }

  async obtenerPorEmail(_email) { throw noImplementado('UsuarioRepositorio', 'obtenerPorEmail'); }

  async existeEmail(_email) { throw noImplementado('UsuarioRepositorio', 'existeEmail'); }

  async listar() { throw noImplementado('UsuarioRepositorio', 'listar'); }

  /**
   * RF03: prestadores activos y con disponibilidad que ofrecen la categoría, cubren la zona
   * y tienen al menos la calificación indicada. Los filtros nulos no se aplican.
   * @param {{idCategoria?:number|null, idZona?:number|null, calificacionMinima:number}} _filtros
   */
  async buscarPrestadores(_filtros) { throw noImplementado('UsuarioRepositorio', 'buscarPrestadores'); }

  /** Inserta o actualiza el usuario con sus colecciones (zonas, categorías, permisos). */
  async guardar(_usuario) { throw noImplementado('UsuarioRepositorio', 'guardar'); }
}
