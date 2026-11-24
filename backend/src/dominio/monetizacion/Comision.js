import { EntidadConEstado } from '../comun/EntidadConEstado.js';
import { ReglaNegocioError } from '../errores.js';
import { Presupuesto } from '../contratacion/Presupuesto.js';
import { EstadoPresupuesto } from '../contratacion/catalogos.js';
import { EstadoComision } from './catalogos.js';

/**
 * Comisión de la plataforma por un presupuesto aceptado (RF13).
 * El pago se hace fuera del sistema: acá solo se registra y se liquida el balance.
 * Navegabilidad: Comisión → Presupuesto.
 */
export class Comision extends EntidadConEstado {
  #id;
  #presupuesto;
  #porcentaje;
  #monto;
  #fechaRegistro;
  #fechaLiquidacion;

  constructor({ id = null, presupuesto, porcentaje, monto, fechaRegistro, fechaLiquidacion = null, estado }) {
    super(estado);
    if (!(presupuesto instanceof Presupuesto)) throw new TypeError('Se esperaba un Presupuesto.');
    this.#id = id;
    this.#presupuesto = presupuesto;
    this.#porcentaje = Number(porcentaje);
    this.#monto = Number(monto);
    this.#fechaRegistro = fechaRegistro;
    this.#fechaLiquidacion = fechaLiquidacion;
  }

  /** RN-K01: monto = monto estimado × porcentaje, redondeado a centavos. */
  static calcularMonto(montoPresupuesto, porcentaje) {
    return Math.round(montoPresupuesto * porcentaje) / 100;
  }

  /** [inicio] → Pendiente al aceptarse el presupuesto (RN-K02). */
  static registrar({ presupuesto, porcentaje, ahora }) {
    if (!presupuesto.estaEn(EstadoPresupuesto.ACEPTADO)) {
      throw new ReglaNegocioError('La comisión se registra al aceptarse el presupuesto.', 'RN-K02');
    }
    const comision = new Comision({
      presupuesto, porcentaje, monto: Comision.calcularMonto(presupuesto.montoEstimado, porcentaje), fechaRegistro: ahora, estado: null,
    });
    comision._transicionar(EstadoComision.PENDIENTE, ahora, { regla: 'RN-K02' });
    return comision;
  }

  get id() { return this.#id; }
  get presupuesto() { return this.#presupuesto; }
  get prestador() { return this.#presupuesto.prestador; }
  get porcentaje() { return this.#porcentaje; }
  get monto() { return this.#monto; }
  get fechaRegistro() { return this.#fechaRegistro; }
  get fechaLiquidacion() { return this.#fechaLiquidacion; }

  asignarId(id) {
    if (this.#id !== null) throw new Error('La comisión ya tiene identificador.');
    this.#id = id;
  }

  /** Pendiente → Liquidada (RN-K03). */
  liquidar(ahora) {
    this._transicionar(EstadoComision.LIQUIDADA, ahora, { desde: [EstadoComision.PENDIENTE], regla: 'RN-K03' });
    this.#fechaLiquidacion = ahora;
  }

  aJSON() {
    return {
      id: this.#id, idPresupuesto: this.#presupuesto.id, estado: this.estado.nombre, porcentaje: this.#porcentaje,
      montoPresupuesto: this.#presupuesto.montoEstimado, monto: this.#monto,
      fechaRegistro: this.#fechaRegistro.toISOString(), fechaLiquidacion: this.#fechaLiquidacion?.toISOString() ?? null,
    };
  }
}
