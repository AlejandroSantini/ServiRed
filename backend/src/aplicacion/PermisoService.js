import { NoEncontradoError, ReglaNegocioError } from '../dominio/errores.js';
import { Familia } from '../dominio/seguridad/Familia.js';
import { Criticidad } from '../dominio/seguridad/Criticidad.js';
import { asegurarAdministradorDisponible } from './reglaAdministracion.js';

const MODULO = 'Permisos';

/** Administración de familias y patentes (Composite, RN-S06) y su asignación a usuarios. */
export class PermisoService {
  #permisos;
  #usuarios;
  #bitacora;

  constructor({ permisoRepositorio, usuarioRepositorio, bitacora }) {
    this.#permisos = permisoRepositorio;
    this.#usuarios = usuarioRepositorio;
    this.#bitacora = bitacora;
  }

  async listar() {
    const arbol = await this.#permisos.obtenerTodos();
    const componentes = [...arbol.values()];
    return {
      patentes: componentes.filter((c) => !c.esFamilia()).map((c) => ({ codigo: c.codigo, nombre: c.nombre })),
      familias: componentes.filter((c) => c.esFamilia()).map((c) => c.toJSON()),
    };
  }

  async crearFamilia({ codigo, nombre, hijos = [] } = {}, actor, { ip = null } = {}) {
    const arbol = await this.#permisos.obtenerTodos();
    if (arbol.has(codigo)) throw new ReglaNegocioError(`Ya existe un permiso con el código ${codigo}.`, 'RN-S06');
    const familia = new Familia({ codigo, nombre });
    for (const codigoHijo of Array.isArray(hijos) ? hijos : []) familia.agregar(PermisoService.#buscar(arbol, codigoHijo));
    await this.#permisos.guardar(familia);
    await this.#registrar(actor, 'Alta de familia', `${codigo}: ${familia.hijos.map((h) => h.codigo).join(', ')}`, ip);
    return familia.toJSON();
  }

  async agregarHijo(codigoFamilia, codigoHijo, actor, { ip = null } = {}) {
    const arbol = await this.#permisos.obtenerTodos();
    const familia = PermisoService.#buscarFamilia(arbol, codigoFamilia);
    familia.agregar(PermisoService.#buscar(arbol, codigoHijo));
    await this.#permisos.guardar(familia);
    await this.#registrar(actor, 'Permiso agregado a familia', `${codigoHijo} → ${codigoFamilia}`, ip);
    return familia.toJSON();
  }

  async quitarHijo(codigoFamilia, codigoHijo, actor, { ip = null } = {}) {
    const arbol = await this.#permisos.obtenerTodos();
    const familia = PermisoService.#buscarFamilia(arbol, codigoFamilia);
    familia.quitar(codigoHijo);
    await asegurarAdministradorDisponible({ usuarioRepositorio: this.#usuarios, arbolPermisos: arbol });
    await this.#permisos.guardar(familia);
    await this.#registrar(actor, 'Permiso quitado de familia', `${codigoHijo} ✕ ${codigoFamilia}`, ip);
    return familia.toJSON();
  }

  async asignarAUsuario(idUsuario, codigo, actor, { ip = null } = {}) {
    const usuario = await this.#obtenerUsuario(idUsuario);
    usuario.asignarPermiso(PermisoService.#buscar(await this.#permisos.obtenerTodos(), codigo));
    await this.#usuarios.guardar(usuario);
    await this.#registrar(actor, 'Permiso asignado a usuario', `${codigo} → ${usuario.email}`, ip);
    return usuario.perfilPropio().permisos;
  }

  async quitarAUsuario(idUsuario, codigo, actor, { ip = null } = {}) {
    const usuario = await this.#obtenerUsuario(idUsuario);
    usuario.quitarPermiso(codigo);
    await asegurarAdministradorDisponible({ usuarioRepositorio: this.#usuarios, usuarioModificado: usuario });
    await this.#usuarios.guardar(usuario);
    await this.#registrar(actor, 'Permiso quitado a usuario', `${codigo} ✕ ${usuario.email}`, ip);
    return usuario.perfilPropio().permisos;
  }

  async #obtenerUsuario(id) {
    const usuario = await this.#usuarios.obtenerPorId(id);
    if (!usuario) throw new NoEncontradoError('El usuario no existe.');
    return usuario;
  }

  static #buscar(arbol, codigo) {
    const componente = arbol.get(codigo);
    if (!componente) throw new NoEncontradoError(`El permiso ${codigo} no existe.`);
    return componente;
  }

  static #buscarFamilia(arbol, codigo) {
    const componente = PermisoService.#buscar(arbol, codigo);
    if (!componente.esFamilia()) throw new ReglaNegocioError(`${codigo} es una patente, no una familia.`, 'RN-S06');
    return componente;
  }

  #registrar(actor, evento, descripcion, ip) {
    return this.#bitacora.registrar({ usuario: actor, modulo: MODULO, evento, descripcion, criticidad: Criticidad.ALTA, ip });
  }
}
