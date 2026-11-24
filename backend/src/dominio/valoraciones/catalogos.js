import { ElementoCatalogo } from '../comun/ElementoCatalogo.js';

/** Pendiente de calificación no se persiste: es la orden Finalizada sin reseña. */
export class EstadoResena extends ElementoCatalogo {
  static PUBLICADA = new EstadoResena(1, 'Publicada');
  static EN_REVISION = new EstadoResena(2, 'En revisión moderada');
  static ELIMINADA = new EstadoResena(3, 'Eliminada');
}

export class EstadoDenuncia extends ElementoCatalogo {
  static PENDIENTE = new EstadoDenuncia(1, 'Pendiente');
  static DESESTIMADA = new EstadoDenuncia(2, 'Desestimada');
  static APROBADA = new EstadoDenuncia(3, 'Aprobada');
}

/** RN-V05: motivos admitidos para denunciar una reseña. */
export class MotivoDenuncia extends ElementoCatalogo {
  static OFENSIVO = new MotivoDenuncia(1, 'Lenguaje obsceno u ofensivo');
  static DATOS_FALSOS = new MotivoDenuncia(2, 'Datos falsos');
}
