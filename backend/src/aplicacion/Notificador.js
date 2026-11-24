import { Notificacion } from '../dominio/contratacion/Notificacion.js';

const ETIQUETA = Object.freeze({
  solicitud: 'Solicitud',
  presupuesto: 'Presupuesto',
  orden: 'Orden de servicio',
  resena: 'Reseña',
  denuncia: 'Denuncia',
});

/**
 * RN-C13 / RF11 / RNF06: todo cambio de estado queda registrado con su fecha
 * (tabla cambio_estado) y se notifica a la contraparte.
 */
export class Notificador {
  #notificaciones;
  #historial;

  constructor({ notificacionRepositorio, historialEstadoRepositorio }) {
    this.#notificaciones = notificacionRepositorio;
    this.#historial = historialEstadoRepositorio;
  }

  /**
   * Registra los cambios pendientes de la entidad y avisa a los destinatarios.
   * @param tipo           'solicitud' | 'presupuesto' | 'orden' | 'resena' | 'denuncia'
   * @param destinatarios  usuarios a notificar (la contraparte de quien hizo el cambio)
   * @param mensaje        texto opcional; por defecto "<Entidad> #id: <estado nuevo>"
   */
  async registrarCambios(tipo, entidad, destinatarios = [], { mensaje = null } = {}) {
    for (const cambio of entidad.extraerCambios()) {
      await this.#historial.registrar({
        entidad: tipo,
        idEntidad: entidad.id,
        idEstadoAnterior: cambio.anterior?.id ?? null,
        idEstadoNuevo: cambio.nuevo.id,
        fecha: cambio.fecha,
        observacion: cambio.observacion,
      });
      const texto = mensaje ?? `${ETIQUETA[tipo]} #${entidad.id}: ${cambio.nuevo.nombre}${cambio.observacion ? ` (${cambio.observacion})` : ''}`;
      for (const usuario of destinatarios) {
        await this.#notificaciones.guardar(Notificacion.crear({ usuario, mensaje: texto, entidad: tipo, idEntidad: entidad.id, fecha: cambio.fecha }));
      }
    }
  }

  /** Aviso que no es un cambio de estado (por ejemplo, un mensaje nuevo, RF06). */
  async notificar(usuario, mensaje, { entidad = null, idEntidad = null, fecha }) {
    await this.#notificaciones.guardar(Notificacion.crear({ usuario, mensaje, entidad, idEntidad, fecha }));
  }
}
