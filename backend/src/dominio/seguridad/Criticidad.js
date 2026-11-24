import { ElementoCatalogo } from '../comun/ElementoCatalogo.js';

/** Clase de catálogo (tabla criticidad) para clasificar los eventos de la bitácora. */
export class Criticidad extends ElementoCatalogo {
  static BAJA = new Criticidad(1, 'Baja');
  static MEDIA = new Criticidad(2, 'Media');
  static ALTA = new Criticidad(3, 'Alta');

  static todos() {
    return [Criticidad.BAJA, Criticidad.MEDIA, Criticidad.ALTA];
  }

  static desdeId(id) {
    return ElementoCatalogo.buscar(Criticidad.todos(), id, 'criticidad');
  }
}
