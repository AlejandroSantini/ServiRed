/**
 * RN-S05: sesión de un usuario. Vence a la hora fijada y el cierre la invalida
 * aunque el token todavía no haya expirado.
 *
 * Es un registro técnico de seguridad: guarda el id del usuario (no el objeto)
 * porque se valida en cada pedido y el usuario se carga aparte.
 */
export class Sesion {
  #id;
  #idUsuario;
  #fechaInicio;
  #fechaExpiracion;
  #fechaCierre;
  #ip;

  constructor({ id, idUsuario, fechaInicio, fechaExpiracion, fechaCierre = null, ip = null }) {
    this.#id = id;
    this.#idUsuario = idUsuario;
    this.#fechaInicio = fechaInicio;
    this.#fechaExpiracion = fechaExpiracion;
    this.#fechaCierre = fechaCierre;
    this.#ip = ip;
  }

  static iniciar({ id, idUsuario, ahora, duracionMs, ip }) {
    return new Sesion({ id, idUsuario, fechaInicio: ahora, fechaExpiracion: new Date(ahora.getTime() + duracionMs), ip });
  }

  get id() { return this.#id; }
  get idUsuario() { return this.#idUsuario; }
  get fechaInicio() { return this.#fechaInicio; }
  get fechaExpiracion() { return this.#fechaExpiracion; }
  get fechaCierre() { return this.#fechaCierre; }
  get ip() { return this.#ip; }

  estaVigente(ahora) {
    return this.#fechaCierre === null && ahora.getTime() < this.#fechaExpiracion.getTime();
  }

  cerrar(ahora) {
    if (this.#fechaCierre === null) this.#fechaCierre = ahora;
  }
}
