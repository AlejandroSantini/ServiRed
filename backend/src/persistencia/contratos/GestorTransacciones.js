import { noImplementado } from './noImplementado.js';

/**
 * Ejecuta un caso de uso como una unidad: si algo falla, no queda nada a medias
 * (por ejemplo, al aceptar un presupuesto se actualizan el presupuesto, la
 * solicitud, los demás presupuestos, se crea la orden y la comisión).
 */
export class GestorTransacciones {
  async ejecutar(_trabajo) { throw noImplementado('GestorTransacciones', 'ejecutar'); }
}
