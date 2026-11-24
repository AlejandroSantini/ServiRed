import { EntidadConEstado } from '../comun/EntidadConEstado.js';
import { ReglaNegocioError } from '../errores.js';
import { HORA, fechaLocal, sumar, validarFecha } from '../comun/fechas.js';
import { EstadoOrdenServicio, EstadoPresupuesto, Turno } from './catalogos.js';
import { Presupuesto } from './Presupuesto.js';

const { PROGRAMADA, EN_EJECUCION, INTERRUMPIDA, FINALIZADA, CERRADA, CANCELADA } = EstadoOrdenServicio;

/**
 * Compromiso formal generado al aceptar un presupuesto.
 * Navegabilidad: Orden → Presupuesto (el presupuesto no conoce su orden).
 * Cliente y prestador se obtienen navegando Orden → Presupuesto → Solicitud / Prestador.
 */
export class OrdenServicio extends EntidadConEstado {
  static HORAS_CONFIRMACION = 48;

  #id;
  #presupuesto;
  #fechaProgramada;
  #turno;
  #fechaInicioReal;
  #fechaFinReal;
  #fechaCierre;
  #cerradaSinConfirmacion;
  #motivoInterrupcion;

  constructor({
    id = null, presupuesto, fechaProgramada, turno, fechaInicioReal = null, fechaFinReal = null,
    fechaCierre = null, cerradaSinConfirmacion = false, motivoInterrupcion = null, estado,
  }) {
    super(estado);
    if (!(presupuesto instanceof Presupuesto)) throw new TypeError('Se esperaba un Presupuesto.');
    if (!(turno instanceof Turno)) throw new ReglaNegocioError('El turno es obligatorio.', 'DATOS');
    this.#id = id;
    this.#presupuesto = presupuesto;
    this.#fechaProgramada = validarFecha(fechaProgramada, 'fecha programada');
    this.#turno = turno;
    this.#fechaInicioReal = fechaInicioReal;
    this.#fechaFinReal = fechaFinReal;
    this.#fechaCierre = fechaCierre;
    this.#cerradaSinConfirmacion = cerradaSinConfirmacion;
    this.#motivoInterrupcion = motivoInterrupcion;
  }

  /** [inicio] → Programada con la fecha y el turno acordados (RN-C05, CU05.9). */
  static generar({ presupuesto, fechaProgramada, turno, ahora }) {
    if (!presupuesto.estaEn(EstadoPresupuesto.ACEPTADO)) {
      throw new ReglaNegocioError('Solo se genera una orden a partir de un presupuesto Aceptado.', 'RN-C05');
    }
    if (validarFecha(fechaProgramada, 'fecha programada') < fechaLocal(ahora)) {
      throw new ReglaNegocioError('La fecha programada no puede ser anterior a hoy.', 'DATOS');
    }
    const orden = new OrdenServicio({ presupuesto, fechaProgramada, turno, estado: null });
    orden._transicionar(PROGRAMADA, ahora, { regla: 'RN-C05' });
    return orden;
  }

  get id() { return this.#id; }
  get presupuesto() { return this.#presupuesto; }
  get solicitud() { return this.#presupuesto.solicitud; }
  get cliente() { return this.#presupuesto.solicitud.cliente; }
  get prestador() { return this.#presupuesto.prestador; }
  get fechaProgramada() { return this.#fechaProgramada; }
  get turno() { return this.#turno; }
  get fechaInicioReal() { return this.#fechaInicioReal; }
  get fechaFinReal() { return this.#fechaFinReal; }
  get fechaCierre() { return this.#fechaCierre; }
  get cerradaSinConfirmacion() { return this.#cerradaSinConfirmacion; }
  get motivoInterrupcion() { return this.#motivoInterrupcion; }

  asignarId(id) {
    if (this.#id !== null) throw new Error('La orden ya tiene identificador.');
    this.#id = id;
  }

  esDelCliente(usuario) { return usuario?.id === this.cliente.id; }
  esDelPrestador(usuario) { return usuario?.id === this.prestador.id; }

  /** Ocupa el turno en la agenda del prestador (RF07, RN-C14). */
  ocupaAgenda() { return this.estaEn(...EstadoOrdenServicio.activos()); }

  #exigirPrestador(usuario, regla) {
    if (!this.esDelPrestador(usuario)) throw new ReglaNegocioError('Solo el prestador asignado puede realizar esta acción.', regla);
  }

  /** Programada → En ejecución, no antes de la fecha programada (RN-C08). */
  iniciarServicio(prestador, ahora) {
    this.#exigirPrestador(prestador, 'RN-C08');
    if (fechaLocal(ahora) < this.#fechaProgramada) {
      throw new ReglaNegocioError('No se puede iniciar el servicio antes de la fecha programada.', 'RN-C08');
    }
    this._transicionar(EN_EJECUCION, ahora, { desde: [PROGRAMADA], regla: 'RN-C08' });
    this.#fechaInicioReal = ahora;
  }

  /** En ejecución → Interrumpida, con motivo obligatorio (RN-C09, RN-C10). */
  registrarInterrupcion(prestador, motivo, ahora) {
    this.#exigirPrestador(prestador, 'RN-C09');
    const texto = OrdenServicio.#motivo(motivo, 'Toda interrupción exige un motivo.');
    this._transicionar(INTERRUMPIDA, ahora, { desde: [EN_EJECUCION], regla: 'RN-C10', observacion: texto });
    this.#motivoInterrupcion = texto;
  }

  /** Interrumpida → En ejecución (RN-C09). */
  reanudarServicio(prestador, ahora) {
    this.#exigirPrestador(prestador, 'RN-C09');
    this._transicionar(EN_EJECUCION, ahora, { desde: [INTERRUMPIDA], regla: 'RN-C09' });
    this.#motivoInterrupcion = null;
  }

  /** En ejecución → Finalizada; fecha_fin_real no anterior a fecha_inicio_real (RN-C09). */
  informarFinalizacion(prestador, ahora) {
    this.#exigirPrestador(prestador, 'RN-C09');
    if (this.#fechaInicioReal && ahora.getTime() < this.#fechaInicioReal.getTime()) {
      throw new ReglaNegocioError('La fecha de fin no puede ser anterior a la de inicio.', 'RN-C09');
    }
    this._transicionar(FINALIZADA, ahora, { desde: [EN_EJECUCION], regla: 'RN-C09' });
    this.#fechaFinReal = ahora;
  }

  /** Finalizada y dentro de las 48 h de la finalización (RN-C11, RN-V01). */
  dentroDeVentanaDeConfirmacion(ahora) {
    return this.estaEn(FINALIZADA)
      && ahora.getTime() < sumar(this.#fechaFinReal, OrdenServicio.HORAS_CONFIRMACION * HORA).getTime();
  }

  /** Finalizada → Cerrada por confirmación del cliente dentro de las 48 h (RN-C11). */
  confirmarFinalizacion(cliente, ahora) {
    if (!this.esDelCliente(cliente)) throw new ReglaNegocioError('Solo el cliente de la orden puede confirmar la recepción.', 'RN-C11');
    if (this.estaEn(FINALIZADA) && !this.dentroDeVentanaDeConfirmacion(ahora)) {
      throw new ReglaNegocioError('Pasaron más de 48 h desde la finalización: la orden se cierra automáticamente.', 'RN-C11');
    }
    this._transicionar(CERRADA, ahora, { desde: [FINALIZADA], regla: 'RN-C11' });
    this.#fechaCierre = ahora;
  }

  /** Finalizada → Cerrada sin valoración pasadas 48 h (RN-C11, CU05.7). */
  cerrarAutomaticamente(ahora) {
    if (!this.estaEn(FINALIZADA) || this.dentroDeVentanaDeConfirmacion(ahora)) return false;
    this._transicionar(CERRADA, ahora, { desde: [FINALIZADA], regla: 'RN-C11', observacion: 'Cierre automático sin confirmación' });
    this.#fechaCierre = ahora;
    this.#cerradaSinConfirmacion = true;
    return true;
  }

  /**
   * Programada → Cancelada: el cliente o el prestador (RN-C12).
   * Interrumpida → Cancelada: el prestador, si el trabajo no puede continuar (RN-C10).
   */
  cancelar(usuario, motivo, ahora) {
    if (this.estaEn(PROGRAMADA)) {
      if (!this.esDelCliente(usuario) && !this.esDelPrestador(usuario)) {
        throw new ReglaNegocioError('Solo el cliente o el prestador de la orden pueden cancelarla.', 'RN-C12');
      }
      this._transicionar(CANCELADA, ahora, { desde: [PROGRAMADA], regla: 'RN-C12', observacion: motivo || null });
    } else if (this.estaEn(INTERRUMPIDA)) {
      this.#exigirPrestador(usuario, 'RN-C10');
      const texto = OrdenServicio.#motivo(motivo, 'Debe indicar por qué el trabajo no puede continuar.');
      this._transicionar(CANCELADA, ahora, { desde: [INTERRUMPIDA], regla: 'RN-C10', observacion: texto });
    } else {
      throw new ReglaNegocioError(`Una orden ${this.estado.nombre} no puede cancelarse.`, 'RN-C12');
    }
  }

  static #motivo(motivo, mensaje) {
    if (typeof motivo !== 'string' || !motivo.trim()) throw new ReglaNegocioError(mensaje, 'RN-C10');
    return motivo.trim().slice(0, 500);
  }

  aJSON() {
    const solicitud = this.solicitud;
    return {
      id: this.#id,
      estado: this.estado.nombre,
      fechaProgramada: this.#fechaProgramada,
      turno: this.#turno.toJSON(),
      fechaInicioReal: this.#fechaInicioReal?.toISOString() ?? null,
      fechaFinReal: this.#fechaFinReal?.toISOString() ?? null,
      fechaCierre: this.#fechaCierre?.toISOString() ?? null,
      confirmarHasta: this.#fechaFinReal && this.estaEn(FINALIZADA)
        ? sumar(this.#fechaFinReal, OrdenServicio.HORAS_CONFIRMACION * HORA).toISOString() : null,
      cerradaSinConfirmacion: this.#cerradaSinConfirmacion,
      motivoInterrupcion: this.#motivoInterrupcion,
      solicitud: { id: solicitud.id, categoria: solicitud.categoria.toJSON(), zona: solicitud.zona.toJSON(), direccion: solicitud.direccion, descripcion: solicitud.descripcion },
      cliente: this.cliente.resumen(),
      prestador: this.prestador.resumen(),
      presupuesto: this.#presupuesto.aJSON(),
    };
  }
}
