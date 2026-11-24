import { ReglaNegocioError } from '../errores.js';
import { textoObligatorio } from '../comun/validaciones.js';
import { SolicitudServicio } from '../contratacion/SolicitudServicio.js';
import { EstadoSolicitud } from '../contratacion/catalogos.js';
import { Usuario } from '../usuarios/Usuario.js';

/**
 * Mensaje interno entre cliente y prestador, asociado a una solicitud (RF06).
 * Una conversación es el par (solicitud, prestador destinatario).
 * Navegabilidad: Mensaje → Solicitud, remitente y destinatario.
 */
export class Mensaje {
  static MAX_TEXTO = 1000;

  #id;
  #solicitud;
  #remitente;
  #destinatario;
  #texto;
  #fecha;
  #leido;

  constructor({ id = null, solicitud, remitente, destinatario, texto, fecha, leido = false }) {
    if (!(solicitud instanceof SolicitudServicio)) throw new TypeError('Se esperaba una SolicitudServicio.');
    if (!(remitente instanceof Usuario) || !(destinatario instanceof Usuario)) throw new TypeError('Se esperaban usuarios.');
    this.#id = id;
    this.#solicitud = solicitud;
    this.#remitente = remitente;
    this.#destinatario = destinatario;
    this.#texto = texto;
    this.#fecha = fecha;
    this.#leido = leido;
  }

  static enviar({ solicitud, remitente, destinatario, texto, ahora }) {
    // RN-M01: solo el cliente de la solicitud y sus prestadores destinatarios, entre ellos.
    const clienteAPrestador = solicitud.esDelCliente(remitente) && solicitud.esDestinatario(destinatario);
    const prestadorACliente = solicitud.esDestinatario(remitente) && solicitud.esDelCliente(destinatario);
    if (!clienteAPrestador && !prestadorACliente) {
      throw new ReglaNegocioError('Solo el cliente y los prestadores de la solicitud pueden intercambiar mensajes.', 'RN-M01');
    }
    // RN-M03: una solicitud Vencida o Cancelada ya no admite mensajes nuevos.
    if (solicitud.estaEn(EstadoSolicitud.VENCIDA, EstadoSolicitud.CANCELADA)) {
      throw new ReglaNegocioError(`La solicitud está ${solicitud.estado.nombre}: no se pueden enviar mensajes.`, 'RN-M03');
    }
    // RN-M02: texto obligatorio de hasta 1000 caracteres.
    let contenido;
    try {
      contenido = textoObligatorio(texto, 'mensaje', Mensaje.MAX_TEXTO);
    } catch (error) {
      throw new ReglaNegocioError(error.message, 'RN-M02');
    }
    return new Mensaje({ solicitud, remitente, destinatario, texto: contenido, fecha: ahora });
  }

  get id() { return this.#id; }
  get solicitud() { return this.#solicitud; }
  get remitente() { return this.#remitente; }
  get destinatario() { return this.#destinatario; }
  get texto() { return this.#texto; }
  get fecha() { return this.#fecha; }
  get leido() { return this.#leido; }

  /** El prestador de la conversación (sea remitente o destinatario). */
  get prestador() {
    return this.#solicitud.esDestinatario(this.#remitente) ? this.#remitente : this.#destinatario;
  }

  asignarId(id) {
    if (this.#id !== null) throw new Error('El mensaje ya tiene identificador.');
    this.#id = id;
  }

  marcarLeido() { this.#leido = true; }

  aJSON() {
    return {
      id: this.#id, idSolicitud: this.#solicitud.id, remitente: this.#remitente.resumen(),
      destinatario: this.#destinatario.resumen(), texto: this.#texto, fecha: this.#fecha.toISOString(), leido: this.#leido,
    };
  }
}
