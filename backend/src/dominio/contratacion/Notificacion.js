import { Usuario } from '../usuarios/Usuario.js';

/** Aviso a un usuario ante un cambio de estado o un mensaje nuevo (RF11, RN-C13). Notificación → Usuario. */
export class Notificacion {
  #id;
  #usuario;
  #mensaje;
  #entidad;
  #idEntidad;
  #fecha;
  #leida;

  constructor({ id = null, usuario, mensaje, entidad = null, idEntidad = null, fecha, leida = false }) {
    if (!(usuario instanceof Usuario)) throw new TypeError('La notificación necesita su destinatario.');
    this.#id = id;
    this.#usuario = usuario;
    this.#mensaje = String(mensaje).slice(0, 300);
    this.#entidad = entidad;
    this.#idEntidad = idEntidad;
    this.#fecha = fecha;
    this.#leida = leida;
  }

  static crear({ usuario, mensaje, entidad, idEntidad, fecha }) {
    return new Notificacion({ usuario, mensaje, entidad, idEntidad, fecha });
  }

  get id() { return this.#id; }
  get usuario() { return this.#usuario; }
  get mensaje() { return this.#mensaje; }
  get entidad() { return this.#entidad; }
  get idEntidad() { return this.#idEntidad; }
  get fecha() { return this.#fecha; }
  get leida() { return this.#leida; }

  asignarId(id) {
    if (this.#id !== null) throw new Error('La notificación ya tiene identificador.');
    this.#id = id;
  }

  marcarLeida() { this.#leida = true; }

  aJSON() {
    return {
      id: this.#id, mensaje: this.#mensaje, entidad: this.#entidad, idEntidad: this.#idEntidad,
      fecha: this.#fecha.toISOString(), leida: this.#leida,
    };
  }
}
