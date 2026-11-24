import { ReglaNegocioError } from '../errores.js';
import { DIA, sumar } from '../comun/fechas.js';
import { Prestador } from '../usuarios/Prestador.js';
import { PlanVisibilidad } from './catalogos.js';

/**
 * Plan de visibilidad contratado por un prestador (RF14).
 * El cobro se hace fuera del sistema (RN-D03): se registra el monto para el reporte de ingresos.
 * Navegabilidad: Suscripción → Prestador y → Plan.
 */
export class Suscripcion {
  #id;
  #prestador;
  #plan;
  #fechaContratacion;
  #fechaInicio;
  #fechaFin;
  #monto;

  constructor({ id = null, prestador, plan, fechaContratacion, fechaInicio, fechaFin, monto }) {
    if (!(prestador instanceof Prestador)) throw new ReglaNegocioError('Solo un prestador puede contratar planes.', 'RN-D01');
    if (!(plan instanceof PlanVisibilidad)) throw new ReglaNegocioError('El plan no existe.', 'RN-D01');
    this.#id = id;
    this.#prestador = prestador;
    this.#plan = plan;
    this.#fechaContratacion = fechaContratacion;
    this.#fechaInicio = fechaInicio;
    this.#fechaFin = fechaFin;
    this.#monto = Number(monto);
  }

  /** RN-D01: si ya tiene un plan vigente, el nuevo empieza cuando termina el actual. */
  static contratar({ prestador, plan, ahora, finUltimaSuscripcion = null }) {
    const inicio = finUltimaSuscripcion && finUltimaSuscripcion.getTime() > ahora.getTime() ? finUltimaSuscripcion : ahora;
    return new Suscripcion({
      prestador, plan, fechaContratacion: ahora, fechaInicio: inicio, fechaFin: sumar(inicio, plan.duracionDias * DIA), monto: plan.precio,
    });
  }

  get id() { return this.#id; }
  get prestador() { return this.#prestador; }
  get plan() { return this.#plan; }
  get fechaContratacion() { return this.#fechaContratacion; }
  get fechaInicio() { return this.#fechaInicio; }
  get fechaFin() { return this.#fechaFin; }
  get monto() { return this.#monto; }

  asignarId(id) {
    if (this.#id !== null) throw new Error('La suscripción ya tiene identificador.');
    this.#id = id;
  }

  estaVigente(ahora) {
    return this.#fechaInicio.getTime() <= ahora.getTime() && ahora.getTime() < this.#fechaFin.getTime();
  }

  aJSON(ahora) {
    return {
      id: this.#id, plan: this.#plan.toJSON(), fechaContratacion: this.#fechaContratacion.toISOString(),
      fechaInicio: this.#fechaInicio.toISOString(), fechaFin: this.#fechaFin.toISOString(), monto: this.#monto,
      vigente: ahora ? this.estaVigente(ahora) : undefined,
    };
  }
}
