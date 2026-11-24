import { NoEncontradoError } from '../dominio/errores.js';
import { idOpcional } from './comun.js';

/** RF11 – Bandeja de notificaciones del usuario. */
export class NotificacionService {
  #notificaciones;

  constructor({ notificacionRepositorio }) {
    this.#notificaciones = notificacionRepositorio;
  }

  async listar(usuario, { soloNoLeidas = false } = {}) {
    const notificaciones = await this.#notificaciones.listarDeUsuario(usuario, { soloNoLeidas });
    return { noLeidas: notificaciones.filter((n) => !n.leida).length, items: notificaciones.map((n) => n.aJSON()) };
  }

  async marcarLeida(usuario, idNotificacion) {
    const notificacion = await this.#notificaciones.obtenerDeUsuario(usuario, idOpcional(idNotificacion, 'notificación') ?? -1);
    if (!notificacion) throw new NoEncontradoError('La notificación no existe.');
    notificacion.marcarLeida();
    await this.#notificaciones.guardar(notificacion);
    return notificacion.aJSON();
  }
}
