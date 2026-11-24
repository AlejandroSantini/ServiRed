import { ReglaNegocioError } from '../errores.js';
import { textoObligatorio } from '../comun/validaciones.js';
import { Componente } from '../seguridad/Componente.js';
import { EstadoUsuario } from './EstadoUsuario.js';

const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const FORMATO_TELEFONO = /^[0-9+()\-\s]{6,20}$/;

/**
 * Clase abstracta: concentra los atributos comunes de Cliente, Prestador y Administrador.
 *
 * Navegabilidad: el usuario guarda sus permisos (colección acotada y propia del
 * perfil, igual que las zonas del prestador). Las solicitudes, sesiones o
 * entradas de bitácora NO se guardan acá: se consultan por repositorio.
 */
export class Usuario {
  /** RN-S03: intentos fallidos consecutivos antes del bloqueo. */
  static MAX_INTENTOS_FALLIDOS = 3;

  #id;
  #nombre;
  #apellido;
  #email;
  #hashContrasena;
  #telefono;
  #estado;
  #intentosFallidos;
  #permisos;
  #fechaAlta;
  #fechaUltimoAcceso;

  constructor({
    id = null, nombre, apellido, email, hashContrasena, telefono = null, estado = EstadoUsuario.ACTIVO,
    intentosFallidos = 0, permisos = [], fechaAlta = new Date(), fechaUltimoAcceso = null,
  }) {
    if (new.target === Usuario) throw new TypeError('Usuario es abstracta: usar Cliente, Prestador o Administrador.');
    if (typeof hashContrasena !== 'string' || !hashContrasena) throw new TypeError('El usuario necesita el hash de su contraseña.');
    if (!(estado instanceof EstadoUsuario)) throw new TypeError('Estado de usuario inválido.');
    this.#id = id;
    this.#nombre = textoObligatorio(nombre, 'nombre', 80);
    this.#apellido = textoObligatorio(apellido, 'apellido', 80);
    this.#email = Usuario.normalizarEmail(email);
    this.#hashContrasena = hashContrasena;
    this.#telefono = Usuario.#validarTelefono(telefono);
    this.#estado = estado;
    this.#intentosFallidos = intentosFallidos;
    this.#fechaAlta = fechaAlta;
    this.#fechaUltimoAcceso = fechaUltimoAcceso;
    this.#permisos = [];
    for (const permiso of permisos) this.asignarPermiso(permiso);
  }

  static normalizarEmail(email) {
    const normalizado = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (normalizado.length > 254 || !FORMATO_EMAIL.test(normalizado)) {
      throw new ReglaNegocioError('El correo electrónico no es válido.', 'DATOS');
    }
    return normalizado;
  }

  static #validarTelefono(telefono) {
    if (telefono === null || telefono === undefined || telefono === '') return null;
    if (typeof telefono !== 'string' || !FORMATO_TELEFONO.test(telefono.trim())) {
      throw new ReglaNegocioError('El teléfono no es válido.', 'DATOS');
    }
    return telefono.trim();
  }

  /** 'cliente' | 'prestador' | 'administrador' (lo define cada subclase). */
  get rol() { throw new Error('Método abstracto'); }

  get id() { return this.#id; }
  get nombre() { return this.#nombre; }
  get apellido() { return this.#apellido; }
  get email() { return this.#email; }
  get hashContrasena() { return this.#hashContrasena; }
  get telefono() { return this.#telefono; }
  get estado() { return this.#estado; }
  get intentosFallidos() { return this.#intentosFallidos; }
  get permisos() { return [...this.#permisos]; }
  get fechaAlta() { return this.#fechaAlta; }
  get fechaUltimoAcceso() { return this.#fechaUltimoAcceso; }

  asignarId(id) {
    if (this.#id !== null) throw new Error('El usuario ya tiene identificador.');
    this.#id = id;
  }

  estaActivo() { return this.#estado.permiteIngreso(); }

  // ---- Permisos (Composite, RN-S06) ----

  tienePermiso(codigo) {
    return this.#permisos.some((p) => p.tienePermiso(codigo));
  }

  obtenerPatentes() {
    const porCodigo = new Map();
    for (const permiso of this.#permisos) {
      for (const patente of permiso.obtenerPatentes()) porCodigo.set(patente.codigo, patente);
    }
    return [...porCodigo.values()];
  }

  asignarPermiso(componente) {
    if (!(componente instanceof Componente)) throw new TypeError('Solo se pueden asignar permisos.');
    if (this.#permisos.some((p) => p.codigo === componente.codigo)) {
      throw new ReglaNegocioError(`El usuario ya tiene asignado ${componente.codigo}.`, 'RN-S06');
    }
    this.#permisos.push(componente);
  }

  quitarPermiso(codigo) {
    const indice = this.#permisos.findIndex((p) => p.codigo === codigo);
    if (indice === -1) throw new ReglaNegocioError(`El usuario no tiene asignado ${codigo}.`, 'RN-S06');
    this.#permisos.splice(indice, 1);
  }

  // ---- Ingreso y bloqueo (RN-S03) ----

  /** Devuelve true si este intento provocó el bloqueo de la cuenta. */
  registrarAccesoFallido() {
    if (!this.estaActivo()) return false;
    this.#intentosFallidos += 1;
    if (this.#intentosFallidos >= Usuario.MAX_INTENTOS_FALLIDOS) {
      this.#estado = EstadoUsuario.BLOQUEADO;
      return true;
    }
    return false;
  }

  registrarAccesoExitoso(fecha) {
    this.#intentosFallidos = 0;
    this.#fechaUltimoAcceso = fecha;
  }

  bloquear() {
    if (!this.estaActivo()) throw new ReglaNegocioError('Solo se puede bloquear un usuario activo.', 'RN-S03');
    this.#estado = EstadoUsuario.BLOQUEADO;
  }

  desbloquear() {
    if (!this.#estado.estaBloqueado()) throw new ReglaNegocioError('El usuario no está bloqueado.', 'RN-S03');
    this.#estado = EstadoUsuario.ACTIVO;
    this.#intentosFallidos = 0;
  }

  darDeBaja() {
    if (this.#estado.estaDadoDeBaja()) throw new ReglaNegocioError('El usuario ya está dado de baja.', 'DATOS');
    this.#estado = EstadoUsuario.BAJA;
  }

  /** RN-S12: la validación de la contraseña actual y de la política la hace el servicio. */
  cambiarHashContrasena(nuevoHash) {
    if (typeof nuevoHash !== 'string' || !nuevoHash) throw new TypeError('Hash inválido.');
    this.#hashContrasena = nuevoHash;
  }

  /** Lo mínimo que ve la contraparte de una contratación (R05: sin correo ni teléfono). */
  resumen() {
    return { id: this.#id, nombre: this.#nombre, apellido: this.#apellido };
  }

  /** Datos que se pueden mostrar a otros usuarios o al administrador (datos mínimos, R05). */
  datosPublicos() {
    return {
      id: this.#id,
      rol: this.rol,
      nombre: this.#nombre,
      apellido: this.#apellido,
      email: this.#email,
      estado: this.#estado.nombre,
      fechaAlta: this.#fechaAlta.toISOString(),
    };
  }

  /** Datos que ve el propio usuario sobre su cuenta. */
  perfilPropio() {
    return {
      ...this.datosPublicos(),
      telefono: this.#telefono,
      fechaUltimoAcceso: this.#fechaUltimoAcceso?.toISOString() ?? null,
      permisos: this.obtenerPatentes().map((p) => p.codigo).sort(),
    };
  }
}
