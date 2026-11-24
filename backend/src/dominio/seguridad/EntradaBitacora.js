import { textoObligatorio } from '../comun/validaciones.js';
import { Criticidad } from './Criticidad.js';

/**
 * RN-S08: registro inmutable de un evento de seguridad.
 *
 * Guarda una "foto" del usuario (id y correo al momento del evento) en vez del
 * objeto Usuario: la bitácora no debe cambiar si después se modifica o se da de
 * baja el usuario. Solo tiene getters: una vez creada no se puede modificar.
 */
export class EntradaBitacora {
  #id;
  #fecha;
  #idUsuario;
  #emailUsuario;
  #modulo;
  #evento;
  #descripcion;
  #criticidad;
  #ip;

  constructor({ id = null, fecha, idUsuario = null, emailUsuario = null, modulo, evento, descripcion = '', criticidad, ip = null }) {
    if (!(fecha instanceof Date)) throw new TypeError('La entrada de bitácora necesita una fecha.');
    if (!(criticidad instanceof Criticidad)) throw new TypeError('La entrada de bitácora necesita una criticidad.');
    this.#id = id;
    this.#fecha = fecha;
    this.#idUsuario = idUsuario;
    this.#emailUsuario = emailUsuario;
    this.#modulo = textoObligatorio(modulo, 'módulo', 50);
    this.#evento = textoObligatorio(evento, 'evento', 100);
    this.#descripcion = String(descripcion ?? '').slice(0, 500);
    this.#criticidad = criticidad;
    this.#ip = ip ? String(ip).slice(0, 45) : null;
  }

  get id() { return this.#id; }
  get fecha() { return this.#fecha; }
  get idUsuario() { return this.#idUsuario; }
  get emailUsuario() { return this.#emailUsuario; }
  get modulo() { return this.#modulo; }
  get evento() { return this.#evento; }
  get descripcion() { return this.#descripcion; }
  get criticidad() { return this.#criticidad; }
  get ip() { return this.#ip; }

  asignarId(id) {
    if (this.#id !== null) throw new Error('La entrada de bitácora ya tiene identificador.');
    this.#id = id;
  }

  toJSON() {
    return {
      id: this.#id,
      fecha: this.#fecha.toISOString(),
      idUsuario: this.#idUsuario,
      emailUsuario: this.#emailUsuario,
      modulo: this.#modulo,
      evento: this.#evento,
      descripcion: this.#descripcion,
      criticidad: this.#criticidad.nombre,
      ip: this.#ip,
    };
  }
}
