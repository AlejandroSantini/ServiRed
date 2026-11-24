import { randomUUID } from 'node:crypto';
import { NoAutenticadoError, ReglaNegocioError, IntegridadComprometidaError } from '../dominio/errores.js';
import { Usuario } from '../dominio/usuarios/Usuario.js';
import { Sesion } from '../dominio/seguridad/Sesion.js';
import { Criticidad } from '../dominio/seguridad/Criticidad.js';
import { PoliticaContrasena } from '../dominio/seguridad/PoliticaContrasena.js';
import { PATENTE } from '../dominio/seguridad/permisosDelSistema.js';

const MODULO = 'Autenticación';
/** RN-S04: mismo mensaje si el correo no existe o si la contraseña es incorrecta. */
const MENSAJE_GENERICO = 'Correo o contraseña incorrectos.';

/** Inicio y cierre de sesión, validación de sesión y cambio de contraseña (RF02, RNF03). */
export class AutenticacionService {
  #usuarios;
  #sesiones;
  #hasher;
  #tokens;
  #bitacora;
  #integridad;
  #reloj;
  #duracionSesionMs;
  #hashFicticio = null;

  constructor({ usuarioRepositorio, sesionRepositorio, hasher, tokens, bitacora, integridad, reloj, duracionSesionMs }) {
    this.#usuarios = usuarioRepositorio;
    this.#sesiones = sesionRepositorio;
    this.#hasher = hasher;
    this.#tokens = tokens;
    this.#bitacora = bitacora;
    this.#integridad = integridad;
    this.#reloj = reloj;
    this.#duracionSesionMs = duracionSesionMs;
  }

  async iniciarSesion({ email, contrasena, ip = null } = {}) {
    if (typeof email !== 'string' || typeof contrasena !== 'string' || !email || !contrasena) {
      throw new NoAutenticadoError(MENSAJE_GENERICO, 'RN-S04');
    }

    const usuario = await this.#usuarios.obtenerPorEmail(email);
    if (!usuario || usuario.estado.estaDadoDeBaja()) {
      // Se calcula igual un hash para que el tiempo de respuesta no revele si el correo existe.
      await this.#hasher.verificar(contrasena, await this.#obtenerHashFicticio());
      await this.#registrar(null, 'Ingreso fallido', 'Correo inexistente o dado de baja', Criticidad.MEDIA, ip);
      throw new NoAutenticadoError(MENSAJE_GENERICO, 'RN-S04');
    }

    if (!(await this.#hasher.verificar(contrasena, usuario.hashContrasena))) {
      const seBloqueo = usuario.registrarAccesoFallido();
      await this.#usuarios.guardar(usuario);
      await this.#registrar(
        usuario,
        seBloqueo ? 'Cuenta bloqueada' : 'Ingreso fallido',
        seBloqueo
          ? `Se alcanzaron ${Usuario.MAX_INTENTOS_FALLIDOS} intentos fallidos consecutivos`
          : `Contraseña incorrecta (intento ${usuario.intentosFallidos} de ${Usuario.MAX_INTENTOS_FALLIDOS})`,
        seBloqueo ? Criticidad.ALTA : Criticidad.MEDIA,
        ip,
      );
      throw new NoAutenticadoError(MENSAJE_GENERICO, 'RN-S04');
    }

    // El estado de bloqueo se informa solo a quien demostró conocer la contraseña.
    if (usuario.estado.estaBloqueado()) {
      await this.#registrar(usuario, 'Ingreso a cuenta bloqueada', 'Credenciales correctas sobre una cuenta bloqueada', Criticidad.MEDIA, ip);
      throw new ReglaNegocioError('La cuenta está bloqueada por superar los intentos permitidos. Contacte al administrador.', 'RN-S03');
    }

    // RN-S09: con la base alterada solo ingresa quien puede revisar la integridad.
    const integridad = await this.#integridad.verificar();
    if (!integridad.integra && !usuario.tienePermiso(PATENTE.INTEGRIDAD_GESTIONAR)) {
      await this.#registrar(usuario, 'Ingreso rechazado por integridad',
        `Inconsistencias detectadas: ${integridad.inconsistencias.length}`, Criticidad.ALTA, ip);
      throw new IntegridadComprometidaError('El sistema no está disponible por mantenimiento. Intente más tarde.', 'RN-S09');
    }

    const ahora = this.#reloj.ahora();
    usuario.registrarAccesoExitoso(ahora);
    await this.#usuarios.guardar(usuario);

    const sesion = Sesion.iniciar({ id: randomUUID(), idUsuario: usuario.id, ahora, duracionMs: this.#duracionSesionMs, ip });
    await this.#sesiones.guardar(sesion);
    const token = this.#tokens.firmar({
      sub: usuario.id,
      jti: sesion.id,
      rol: usuario.rol,
      iat: Math.floor(ahora.getTime() / 1000),
      exp: Math.floor(sesion.fechaExpiracion.getTime() / 1000),
    });
    await this.#registrar(usuario, 'Inicio de sesión', '', Criticidad.BAJA, ip);

    return {
      token,
      expira: sesion.fechaExpiracion.toISOString(),
      usuario: usuario.perfilPropio(),
      integridad: integridad.integra ? null : integridad,
    };
  }

  /** Lo usa el middleware en cada pedido: token válido + sesión abierta + usuario activo. */
  async validarSesion(token) {
    const ahora = this.#reloj.ahora();
    const contenido = this.#tokens.verificar(token, ahora);
    const sesion = await this.#sesiones.obtenerPorId(contenido.jti);
    if (!sesion || !sesion.estaVigente(ahora) || sesion.idUsuario !== contenido.sub) {
      throw new NoAutenticadoError('La sesión no es válida. Inicie sesión nuevamente.', 'RN-S05');
    }
    const usuario = await this.#usuarios.obtenerPorId(contenido.sub);
    if (!usuario || !usuario.estaActivo()) {
      throw new NoAutenticadoError('La sesión no es válida. Inicie sesión nuevamente.', 'RN-S05');
    }
    return { usuario, sesion };
  }

  async cerrarSesion(sesion, usuario, { ip = null } = {}) {
    sesion.cerrar(this.#reloj.ahora());
    await this.#sesiones.guardar(sesion);
    await this.#registrar(usuario, 'Cierre de sesión', '', Criticidad.BAJA, ip);
  }

  /** RN-S12: exige la contraseña actual, aplica la política y cierra todas las sesiones. */
  async cambiarContrasena(usuario, { actual, nueva } = {}, { ip = null } = {}) {
    if (typeof actual !== 'string' || !(await this.#hasher.verificar(actual, usuario.hashContrasena))) {
      await this.#registrar(usuario, 'Cambio de contraseña rechazado', 'Contraseña actual incorrecta', Criticidad.MEDIA, ip);
      throw new ReglaNegocioError('La contraseña actual no es correcta.', 'RN-S12');
    }
    PoliticaContrasena.validar(nueva, { email: usuario.email });
    if (await this.#hasher.verificar(nueva, usuario.hashContrasena)) {
      throw new ReglaNegocioError('La nueva contraseña debe ser distinta de la actual.', 'RN-S12');
    }
    usuario.cambiarHashContrasena(await this.#hasher.generar(nueva));
    await this.#usuarios.guardar(usuario);
    await this.#sesiones.cerrarTodasDelUsuario(usuario.id, this.#reloj.ahora());
    await this.#registrar(usuario, 'Cambio de contraseña', 'Se cerraron todas las sesiones abiertas', Criticidad.MEDIA, ip);
  }

  async #obtenerHashFicticio() {
    this.#hashFicticio ??= await this.#hasher.generar(randomUUID());
    return this.#hashFicticio;
  }

  #registrar(usuario, evento, descripcion, criticidad, ip) {
    return this.#bitacora.registrar({ usuario, modulo: MODULO, evento, descripcion, criticidad, ip });
  }
}
