import { ElementoCatalogo } from '../comun/ElementoCatalogo.js';

/**
 * Clases de catálogo de la Iteración 3 (devolución 4.5: una clase por cada enum eliminado).
 * Cada instancia es un registro de su tabla (estado_solicitud, estado_presupuesto,
 * estado_orden_servicio, turno) con el mismo id.
 */
export class EstadoSolicitud extends ElementoCatalogo {
  static ABIERTA = new EstadoSolicitud(1, 'Abierta');
  static ADJUDICADA = new EstadoSolicitud(2, 'Adjudicada');
  static FINALIZADA = new EstadoSolicitud(3, 'Finalizada');
  static VENCIDA = new EstadoSolicitud(4, 'Vencida');
  static CANCELADA = new EstadoSolicitud(5, 'Cancelada');
}

export class EstadoPresupuesto extends ElementoCatalogo {
  static EMITIDO = new EstadoPresupuesto(1, 'Emitido');
  static ACEPTADO = new EstadoPresupuesto(2, 'Aceptado');
  static RECHAZADO = new EstadoPresupuesto(3, 'Rechazado');
  static VENCIDO = new EstadoPresupuesto(4, 'Vencido');
  static DESCARTADO = new EstadoPresupuesto(5, 'Descartado');
}

export class EstadoOrdenServicio extends ElementoCatalogo {
  static PROGRAMADA = new EstadoOrdenServicio(1, 'Programada');
  static EN_EJECUCION = new EstadoOrdenServicio(2, 'En ejecución');
  static INTERRUMPIDA = new EstadoOrdenServicio(3, 'Interrumpida');
  static FINALIZADA = new EstadoOrdenServicio(4, 'Finalizada');
  static CERRADA = new EstadoOrdenServicio(5, 'Cerrada');
  static CANCELADA = new EstadoOrdenServicio(6, 'Cancelada');

  /** Estados que ocupan un turno de la agenda del prestador (RF07, RN-C14). */
  static activos() {
    return [EstadoOrdenServicio.PROGRAMADA, EstadoOrdenServicio.EN_EJECUCION, EstadoOrdenServicio.INTERRUMPIDA];
  }
}

/** Franja horaria del día para acordar la visita (catálogo de referencia). */
export class Turno extends ElementoCatalogo {
  static MANANA = new Turno(1, 'Mañana');
  static TARDE = new Turno(2, 'Tarde');
  static NOCHE = new Turno(3, 'Noche');
}
