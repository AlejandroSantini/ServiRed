import { NoEncontradoError, ReglaNegocioError } from '../dominio/errores.js';
import { Usuario } from '../dominio/usuarios/Usuario.js';
import { Cliente } from '../dominio/usuarios/Cliente.js';
import { Prestador } from '../dominio/usuarios/Prestador.js';
import { Administrador } from '../dominio/usuarios/Administrador.js';
import { PoliticaContrasena } from '../dominio/seguridad/PoliticaContrasena.js';
import { Criticidad } from '../dominio/seguridad/Criticidad.js';
import { FAMILIA_POR_ROL } from '../dominio/seguridad/permisosDelSistema.js';
import { asegurarAdministradorDisponible } from './reglaAdministracion.js';

const MODULO = 'Usuarios';

/** Alta de clientes y prestadores (RF01, RF02) y administración de cuentas. */
export class UsuarioService {
  #usuarios;
  #permisos;
  #catalogos;
  #sesiones;
  #hasher;
  #bitacora;
  #reloj;

  constructor({ usuarioRepositorio, permisoRepositorio, catalogoRepositorio, sesionRepositorio, hasher, bitacora, reloj }) {
    this.#usuarios = usuarioRepositorio;
    this.#permisos = permisoRepositorio;
    this.#catalogos = catalogoRepositorio;
    this.#sesiones = sesionRepositorio;
    this.#hasher = hasher;
    this.#bitacora = bitacora;
    this.#reloj = reloj;
  }

  // ---------- Altas ----------

  async registrarCliente(datos = {}, { ip = null } = {}) {
    const comunes = await this.#datosComunes(datos);
    const [zona] = await this.#catalogos.obtenerZonas([datos.idZona]);
    return this.#darDeAlta(new Cliente({ ...comunes, zona }), null, ip);
  }

  async registrarPrestador(datos = {}, { ip = null } = {}) {
    const comunes = await this.#datosComunes(datos);
    const zonas = await this.#catalogos.obtenerZonas(UsuarioService.#lista(datos.idsZonas));
    const categorias = await this.#catalogos.obtenerCategorias(UsuarioService.#lista(datos.idsCategorias));
    const prestador = new Prestador({
      ...comunes,
      zonas,
      categorias,
      tarifaBase: datos.tarifaBase,
      descripcion: datos.descripcion,
      disponibilidad: datos.disponibilidad,
    });
    return this.#darDeAlta(prestador, null, ip);
  }

  /** Solo un usuario con USUARIO_GESTIONAR (lo controla la ruta); `actor` es null en la carga inicial. */
  async crearAdministrador(datos = {}, actor = null, { ip = null } = {}) {
    const comunes = await this.#datosComunes(datos);
    return this.#darDeAlta(new Administrador(comunes), actor, ip);
  }

  // ---------- Consultas ----------

  async obtener(id) {
    const usuario = await this.#usuarios.obtenerPorId(id);
    if (!usuario) throw new NoEncontradoError('El usuario no existe.');
    return usuario;
  }

  async listar() {
    return (await this.#usuarios.listar()).map((u) => u.datosPublicos());
  }

  // ---------- Estado de la cuenta ----------

  async desbloquear(idUsuario, actor, { ip = null } = {}) {
    const usuario = await this.obtener(idUsuario);
    usuario.desbloquear();
    await this.#usuarios.guardar(usuario);
    await this.#registrar(actor, 'Desbloqueo de usuario', usuario.email, Criticidad.MEDIA, ip);
    return usuario.datosPublicos();
  }

  async bloquear(idUsuario, actor, { ip = null } = {}) {
    const usuario = await this.#obtenerOtroUsuario(idUsuario, actor, 'bloquear');
    usuario.bloquear();
    await asegurarAdministradorDisponible({ usuarioRepositorio: this.#usuarios, usuarioModificado: usuario });
    await this.#usuarios.guardar(usuario);
    await this.#sesiones.cerrarTodasDelUsuario(usuario.id, this.#reloj.ahora());
    await this.#registrar(actor, 'Bloqueo de usuario', usuario.email, Criticidad.ALTA, ip);
    return usuario.datosPublicos();
  }

  async darDeBaja(idUsuario, actor, { ip = null } = {}) {
    const usuario = await this.#obtenerOtroUsuario(idUsuario, actor, 'dar de baja');
    usuario.darDeBaja();
    await asegurarAdministradorDisponible({ usuarioRepositorio: this.#usuarios, usuarioModificado: usuario });
    await this.#usuarios.guardar(usuario);
    await this.#sesiones.cerrarTodasDelUsuario(usuario.id, this.#reloj.ahora());
    await this.#registrar(actor, 'Baja de usuario', usuario.email, Criticidad.ALTA, ip);
    return usuario.datosPublicos();
  }

  // ---------- Privados ----------

  /** RN-S01 (política), RN-S02 (correo único) y hash de la contraseña. */
  async #datosComunes({ nombre, apellido, email, contrasena, telefono }) {
    const emailNormalizado = Usuario.normalizarEmail(email);
    PoliticaContrasena.validar(contrasena, { email: emailNormalizado });
    if (await this.#usuarios.existeEmail(emailNormalizado)) {
      throw new ReglaNegocioError('El correo ya está registrado.', 'RN-S02');
    }
    return {
      nombre,
      apellido,
      email: emailNormalizado,
      telefono,
      hashContrasena: await this.#hasher.generar(contrasena),
      fechaAlta: this.#reloj.ahora(),
    };
  }

  async #darDeAlta(usuario, actor, ip) {
    const familia = await this.#permisos.obtenerPorCodigo(FAMILIA_POR_ROL[usuario.rol]);
    if (!familia) throw new Error(`No existe la familia ${FAMILIA_POR_ROL[usuario.rol]}: falta inicializar los permisos.`);
    usuario.asignarPermiso(familia);
    await this.#usuarios.guardar(usuario);
    await this.#registrar(actor ?? usuario, 'Alta de usuario', `${usuario.rol}: ${usuario.email}`,
      usuario.rol === 'administrador' ? Criticidad.ALTA : Criticidad.BAJA, ip);
    return usuario;
  }

  async #obtenerOtroUsuario(idUsuario, actor, accion) {
    const usuario = await this.obtener(idUsuario);
    if (actor && usuario.id === actor.id) {
      throw new ReglaNegocioError(`No puede ${accion} su propia cuenta.`, 'RN-S07');
    }
    return usuario;
  }

  static #lista(valor) {
    if (!Array.isArray(valor)) return [];
    return valor;
  }

  #registrar(actor, evento, descripcion, criticidad, ip) {
    return this.#bitacora.registrar({ usuario: actor, modulo: MODULO, evento, descripcion, criticidad, ip });
  }
}
