import { EntidadConEstado } from '../comun/EntidadConEstado.js';
import { ReglaNegocioError } from '../errores.js';
import { textoOpcional } from '../comun/validaciones.js';
import { fechaLocal, validarFecha } from '../comun/fechas.js';
import { Prestador } from '../usuarios/Prestador.js';
import { EstadoPresupuesto } from './catalogos.js';
import { SolicitudServicio } from './SolicitudServicio.js';

const { EMITIDO, ACEPTADO, RECHAZADO, VENCIDO, DESCARTADO } = EstadoPresupuesto;

/**
 * Oferta de un prestador para una solicitud.
 * Navegabilidad (respuesta a la devolución): Presupuesto → Prestador y
 * Presupuesto → SolicitudServicio. El prestador NO tiene lista de presupuestos.
 */
export class Presupuesto extends EntidadConEstado {
  #id;
  #solicitud;
  #prestador;
  #montoEstimado;
  #tiempoEstimadoHoras;
  #detalle;
  #fechaEmision;
  #fechaValidez;

  constructor({ id = null, solicitud, prestador, montoEstimado, tiempoEstimadoHoras, detalle = null, fechaEmision, fechaValidez, estado }) {
    super(estado);
    if (!(solicitud instanceof SolicitudServicio)) throw new TypeError('Se esperaba una SolicitudServicio.');
    if (!(prestador instanceof Prestador)) throw new ReglaNegocioError('Solo un prestador puede emitir presupuestos.', 'RN-C02');
    this.#id = id;
    this.#solicitud = solicitud;
    this.#prestador = prestador;
    this.#montoEstimado = Number(montoEstimado);
    this.#tiempoEstimadoHoras = Number(tiempoEstimadoHoras);
    this.#detalle = textoOpcional(detalle, 'detalle de la propuesta', 2000);
    this.#fechaEmision = fechaEmision;
    this.#fechaValidez = fechaValidez;
  }

  /**
   * [inicio] → Emitido.
   * @param tieneOtroVigente  si el prestador ya tiene un presupuesto Emitido para la solicitud (lo consulta el servicio)
   */
  static emitir({ solicitud, prestador, montoEstimado, tiempoEstimadoHoras, detalle, fechaValidez, ahora, tieneOtroVigente }) {
    if (!solicitud.esDestinatario(prestador)) {
      throw new ReglaNegocioError('La solicitud no está dirigida a este prestador.', 'RN-C01');
    }
    if (!solicitud.admitePresupuestos(ahora)) {
      throw new ReglaNegocioError(`La solicitud está ${solicitud.estado.nombre} y no admite presupuestos.`, 'RN-C07');
    }
    if (tieneOtroVigente) {
      throw new ReglaNegocioError('Ya tiene un presupuesto vigente para esta solicitud.', 'RN-C02');
    }
    const monto = Number(montoEstimado);
    const tiempo = Number(tiempoEstimadoHoras);
    if (!Number.isFinite(monto) || monto <= 0) throw new ReglaNegocioError('El monto estimado debe ser mayor que 0.', 'RN-C03');
    if (!Number.isFinite(tiempo) || tiempo <= 0) throw new ReglaNegocioError('El tiempo estimado debe ser mayor que 0.', 'RN-C03');
    if (validarFecha(fechaValidez, 'fecha de validez') <= fechaLocal(ahora)) {
      throw new ReglaNegocioError('La fecha de validez debe ser posterior a la fecha de emisión.', 'RN-C03');
    }
    const presupuesto = new Presupuesto({
      solicitud, prestador, detalle, fechaValidez, fechaEmision: ahora,
      montoEstimado: Math.round(monto * 100) / 100,
      tiempoEstimadoHoras: Math.round(tiempo * 10) / 10,
      estado: null,
    });
    presupuesto._transicionar(EMITIDO, ahora, { regla: 'RN-C02' });
    return presupuesto;
  }

  get id() { return this.#id; }
  get solicitud() { return this.#solicitud; }
  get prestador() { return this.#prestador; }
  get montoEstimado() { return this.#montoEstimado; }
  get tiempoEstimadoHoras() { return this.#tiempoEstimadoHoras; }
  get detalle() { return this.#detalle; }
  get fechaEmision() { return this.#fechaEmision; }
  get fechaValidez() { return this.#fechaValidez; }

  asignarId(id) {
    if (this.#id !== null) throw new Error('El presupuesto ya tiene identificador.');
    this.#id = id;
  }

  /** Emitido y sin superar la fecha de validez (RN-C04). */
  estaVigente(ahora) {
    return this.estaEn(EMITIDO) && fechaLocal(ahora) <= this.#fechaValidez;
  }

  /** Emitido → Vencido al superar fecha_validez (RN-C04, CU05.8). */
  vencerSiCorresponde(ahora) {
    if (!this.estaEn(EMITIDO) || this.estaVigente(ahora)) return false;
    this._transicionar(VENCIDO, ahora, { desde: [EMITIDO], regla: 'RN-C04' });
    return true;
  }

  /** Emitido → Aceptado (RN-C04). */
  aceptar(ahora) {
    if (!this.estaVigente(ahora)) throw new ReglaNegocioError('Solo un presupuesto Emitido y vigente puede aceptarse.', 'RN-C04');
    this._transicionar(ACEPTADO, ahora, { desde: [EMITIDO], regla: 'RN-C04' });
  }

  /** Emitido → Rechazado; la solicitud sigue Abierta (RN-C06). */
  rechazar(ahora) {
    if (!this.estaVigente(ahora)) throw new ReglaNegocioError('Solo un presupuesto Emitido y vigente puede rechazarse.', 'RN-C04');
    this._transicionar(RECHAZADO, ahora, { desde: [EMITIDO], regla: 'RN-C06' });
  }

  /** Emitido → Descartado al aceptarse otro o cancelarse la solicitud (RN-C05). */
  descartar(ahora) {
    this._transicionar(DESCARTADO, ahora, { desde: [EMITIDO], regla: 'RN-C05' });
  }

  aJSON() {
    return {
      id: this.#id,
      idSolicitud: this.#solicitud.id,
      estado: this.estado.nombre,
      prestador: { ...this.#prestador.resumen(), reputacionPromedio: this.#prestador.reputacionPromedio },
      montoEstimado: this.#montoEstimado,
      tiempoEstimadoHoras: this.#tiempoEstimadoHoras,
      detalle: this.#detalle,
      fechaEmision: this.#fechaEmision.toISOString(),
      fechaValidez: this.#fechaValidez,
    };
  }
}
