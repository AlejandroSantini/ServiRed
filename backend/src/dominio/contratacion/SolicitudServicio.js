import { EntidadConEstado } from '../comun/EntidadConEstado.js';
import { ReglaNegocioError } from '../errores.js';
import { textoObligatorio } from '../comun/validaciones.js';
import { DIA, fechaLocal, sumar, validarFecha } from '../comun/fechas.js';
import { Cliente } from '../usuarios/Cliente.js';
import { Prestador } from '../usuarios/Prestador.js';
import { Zona } from '../usuarios/Zona.js';
import { CategoriaOficio } from '../usuarios/CategoriaOficio.js';
import { EstadoSolicitud, Turno } from './catalogos.js';

const { ABIERTA, ADJUDICADA, FINALIZADA, VENCIDA, CANCELADA } = EstadoSolicitud;

/**
 * Pedido del cliente a 1..3 prestadores (RF04).
 * Navegabilidad (12.2.5): guarda cliente, categoría, zona, turno, estado y los
 * destinatarios (colección acotada por RN-C01). NO guarda la lista de
 * presupuestos: SinPresupuestos/ConPresupuestos se derivan con una consulta.
 */
export class SolicitudServicio extends EntidadConEstado {
  static MAX_DESTINATARIOS = 3;
  static DIAS_VIGENCIA = 15;

  #id;
  #cliente;
  #categoria;
  #zona;
  #descripcion;
  #direccion;
  #fechaPreferida;
  #turnoPreferido;
  #destinatarios;
  #fechaCreacion;
  #fechaLimite;

  constructor({
    id = null, cliente, categoria, zona, descripcion, direccion, fechaPreferida, turnoPreferido,
    destinatarios, fechaCreacion, fechaLimite, estado,
  }) {
    super(estado);
    if (!(cliente instanceof Cliente)) throw new ReglaNegocioError('Solo un cliente puede solicitar presupuestos.', 'RF04');
    if (!(categoria instanceof CategoriaOficio)) throw new ReglaNegocioError('La categoría de oficio es obligatoria.', 'DATOS');
    if (!(zona instanceof Zona)) throw new ReglaNegocioError('La zona es obligatoria.', 'DATOS');
    if (!(turnoPreferido instanceof Turno)) throw new ReglaNegocioError('El turno preferido es obligatorio.', 'DATOS');
    this.#id = id;
    this.#cliente = cliente;
    this.#categoria = categoria;
    this.#zona = zona;
    this.#descripcion = textoObligatorio(descripcion, 'descripción del problema', 1000);
    this.#direccion = textoObligatorio(direccion, 'dirección del servicio', 200);
    this.#fechaPreferida = validarFecha(fechaPreferida, 'fecha preferida');
    this.#turnoPreferido = turnoPreferido;
    this.#destinatarios = [...destinatarios];
    this.#fechaCreacion = fechaCreacion;
    this.#fechaLimite = fechaLimite;
  }

  /** [inicio] → Abierta. Valida RN-C01 y fija fechaLimite = creación + 15 días (RN-C07). */
  static crear({ cliente, categoria, zona, descripcion, direccion, fechaPreferida, turnoPreferido, destinatarios, ahora }) {
    if (!Array.isArray(destinatarios) || destinatarios.length < 1 || destinatarios.length > SolicitudServicio.MAX_DESTINATARIOS) {
      throw new ReglaNegocioError('La solicitud debe dirigirse a entre 1 y 3 prestadores.', 'RN-C01');
    }
    if (new Set(destinatarios.map((p) => p?.id)).size !== destinatarios.length) {
      throw new ReglaNegocioError('Un prestador no puede figurar dos veces como destinatario.', 'RN-C01');
    }
    for (const prestador of destinatarios) {
      if (!(prestador instanceof Prestador)) throw new ReglaNegocioError('Los destinatarios deben ser prestadores.', 'RN-C01');
      const nombre = `${prestador.nombre} ${prestador.apellido}`;
      if (!prestador.estaDisponible()) throw new ReglaNegocioError(`${nombre} no tiene disponibilidad activa.`, 'RN-C01');
      if (!prestador.ofreceCategoria(categoria)) throw new ReglaNegocioError(`${nombre} no ofrece la categoría ${categoria?.nombre}.`, 'RN-C01');
      if (!prestador.cubreZona(zona)) throw new ReglaNegocioError(`${nombre} no cubre la zona ${zona?.nombre}.`, 'RN-C01');
    }
    if (validarFecha(fechaPreferida, 'fecha preferida') < fechaLocal(ahora)) {
      throw new ReglaNegocioError('La fecha preferida no puede ser anterior a hoy.', 'DATOS');
    }
    const solicitud = new SolicitudServicio({
      cliente, categoria, zona, descripcion, direccion, fechaPreferida, turnoPreferido, destinatarios,
      fechaCreacion: ahora,
      fechaLimite: sumar(ahora, SolicitudServicio.DIAS_VIGENCIA * DIA),
      estado: null,
    });
    solicitud._transicionar(ABIERTA, ahora, { regla: 'RN-C01' });
    return solicitud;
  }

  get id() { return this.#id; }
  get cliente() { return this.#cliente; }
  get categoria() { return this.#categoria; }
  get zona() { return this.#zona; }
  get descripcion() { return this.#descripcion; }
  get direccion() { return this.#direccion; }
  get fechaPreferida() { return this.#fechaPreferida; }
  get turnoPreferido() { return this.#turnoPreferido; }
  get destinatarios() { return [...this.#destinatarios]; }
  get fechaCreacion() { return this.#fechaCreacion; }
  get fechaLimite() { return this.#fechaLimite; }

  asignarId(id) {
    if (this.#id !== null) throw new Error('La solicitud ya tiene identificador.');
    this.#id = id;
  }

  esDelCliente(usuario) { return usuario?.id === this.#cliente.id; }

  esDestinatario(usuario) { return this.#destinatarios.some((p) => p.id === usuario?.id); }

  /** Abierta y dentro de los 15 días (RN-C07). */
  admitePresupuestos(ahora) {
    return this.estaEn(ABIERTA) && ahora.getTime() < this.#fechaLimite.getTime();
  }

  /** Abierta → Adjudicada (RN-C05). */
  adjudicar(ahora) {
    if (!this.admitePresupuestos(ahora)) throw new ReglaNegocioError('La solicitud ya no admite la aceptación de presupuestos.', 'RN-C07');
    this._transicionar(ADJUDICADA, ahora, { desde: [ABIERTA], regla: 'RN-C05' });
  }

  /** Abierta → Vencida a los 15 días sin aceptación (RN-C07). */
  vencerSiCorresponde(ahora) {
    if (!this.estaEn(ABIERTA) || ahora.getTime() < this.#fechaLimite.getTime()) return false;
    this._transicionar(VENCIDA, ahora, { desde: [ABIERTA], regla: 'RN-C07' });
    return true;
  }

  /** Abierta → Cancelada por el cliente (RN-C12). */
  cancelarPorCliente(cliente, ahora) {
    if (!this.esDelCliente(cliente)) throw new ReglaNegocioError('Solo el cliente puede cancelar su solicitud.', 'RN-C12');
    this._transicionar(CANCELADA, ahora, { desde: [ABIERTA], regla: 'RN-C12' });
  }

  /** Adjudicada → Cancelada cuando se cancela su orden (RN-C10, RN-C12). */
  cancelarPorOrden(ahora, observacion) {
    this._transicionar(CANCELADA, ahora, { desde: [ADJUDICADA], regla: 'RN-C10', observacion });
  }

  /** Adjudicada → Finalizada cuando su orden se cierra (RN-C11). */
  finalizar(ahora) {
    this._transicionar(FINALIZADA, ahora, { desde: [ADJUDICADA], regla: 'RN-C11' });
  }

  aJSON() {
    return {
      id: this.#id,
      estado: this.estado.nombre,
      categoria: this.#categoria.toJSON(),
      zona: this.#zona.toJSON(),
      descripcion: this.#descripcion,
      direccion: this.#direccion,
      fechaPreferida: this.#fechaPreferida,
      turnoPreferido: this.#turnoPreferido.toJSON(),
      fechaCreacion: this.#fechaCreacion.toISOString(),
      fechaLimite: this.#fechaLimite.toISOString(),
      cliente: this.#cliente.resumen(),
      destinatarios: this.#destinatarios.map((p) => p.resumen()),
    };
  }
}
