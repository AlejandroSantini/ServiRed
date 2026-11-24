import { Componente } from './Componente.js';

/** Hoja del Composite: habilita una operación concreta del sistema. */
export class Patente extends Componente {
  tienePermiso(codigo) {
    return this.codigo === codigo;
  }

  obtenerPatentes() {
    return [this];
  }
}
