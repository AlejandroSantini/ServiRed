import { ElementoCatalogo } from '../comun/ElementoCatalogo.js';

export class EstadoComision extends ElementoCatalogo {
  static PENDIENTE = new EstadoComision(1, 'Pendiente');
  static LIQUIDADA = new EstadoComision(2, 'Liquidada');
}

/**
 * Planes de visibilidad (RF14). Tabla plan_visibilidad con los mismos valores.
 * prioridad: cuanto más alta, antes aparece en la búsqueda (RN-D02).
 */
export class PlanVisibilidad extends ElementoCatalogo {
  #precio;
  #duracionDias;
  #prioridad;

  constructor(id, nombre, precio, duracionDias, prioridad) {
    super(id, nombre);
    this.#precio = precio;
    this.#duracionDias = duracionDias;
    this.#prioridad = prioridad;
  }

  static VERIFICADO = new PlanVisibilidad(1, 'Verificado', 5000, 30, 1);
  static PREMIUM = new PlanVisibilidad(2, 'Premium', 12000, 30, 2);

  get precio() { return this.#precio; }
  get duracionDias() { return this.#duracionDias; }
  get prioridad() { return this.#prioridad; }

  toJSON() {
    return { ...super.toJSON(), precio: this.#precio, duracionDias: this.#duracionDias, prioridad: this.#prioridad };
  }
}
