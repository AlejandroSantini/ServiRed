import { NoEncontradoError, ReglaNegocioError } from '../dominio/errores.js';
import { Cliente } from '../dominio/usuarios/Cliente.js';
import { Prestador } from '../dominio/usuarios/Prestador.js';
import { Mensaje } from '../dominio/mensajeria/Mensaje.js';
import { idOpcional } from './comun.js';

/** RF06 – Mensajería interna asociada a una solicitud (Iteración 5). */
export class MensajeriaService {
  #mensajes;
  #solicitudes;
  #transacciones;
  #notificador;
  #reloj;

  constructor({ mensajeRepositorio, solicitudRepositorio, transacciones, notificador, reloj }) {
    this.#mensajes = mensajeRepositorio;
    this.#solicitudes = solicitudRepositorio;
    this.#transacciones = transacciones;
    this.#notificador = notificador;
    this.#reloj = reloj;
  }

  /** El cliente indica a qué prestador escribe; el prestador siempre le escribe al cliente. */
  async enviar(remitente, idSolicitud, { idPrestador, texto } = {}) {
    const { solicitud, prestador } = await this.#conversacion(remitente, idSolicitud, idPrestador);
    const destinatario = remitente instanceof Cliente ? prestador : solicitud.cliente;
    const ahora = this.#reloj.ahora();
    const mensaje = Mensaje.enviar({ solicitud, remitente, destinatario, texto, ahora });
    await this.#transacciones.ejecutar(async () => {
      await this.#mensajes.guardar(mensaje);
      await this.#notificador.notificar(destinatario, `Nuevo mensaje de ${remitente.nombre} en la solicitud #${solicitud.id}.`, {
        entidad: 'solicitud', idEntidad: solicitud.id, fecha: ahora,
      });
    });
    return mensaje.aJSON();
  }

  /** Lista la conversación y marca como leídos los mensajes dirigidos al usuario. */
  async conversacion(usuario, idSolicitud, idPrestador) {
    const { solicitud, prestador } = await this.#conversacion(usuario, idSolicitud, idPrestador);
    const mensajes = await this.#mensajes.listarConversacion(solicitud, prestador.id);
    const noLeidos = mensajes.filter((m) => m.destinatario.id === usuario.id && !m.leido);
    if (noLeidos.length) {
      await this.#transacciones.ejecutar(async () => {
        for (const m of noLeidos) {
          m.marcarLeido();
          await this.#mensajes.guardar(m);
        }
      });
    }
    return mensajes.map((m) => m.aJSON());
  }

  async #conversacion(usuario, idSolicitud, idPrestador) {
    const solicitud = await this.#solicitudes.obtenerPorId(idOpcional(idSolicitud, 'solicitud') ?? -1);
    if (!solicitud || !(solicitud.esDelCliente(usuario) || solicitud.esDestinatario(usuario))) {
      throw new NoEncontradoError('La solicitud no existe.');
    }
    let prestador;
    if (usuario instanceof Prestador) {
      prestador = usuario;
    } else {
      const id = idOpcional(idPrestador, 'idPrestador');
      prestador = solicitud.destinatarios.find((p) => p.id === id);
      if (!prestador) throw new ReglaNegocioError('Indique a qué prestador de la solicitud le escribe.', 'RN-M01');
    }
    return { solicitud, prestador };
  }
}
