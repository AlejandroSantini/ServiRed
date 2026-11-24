import { EntidadConEstado } from '../comun/EntidadConEstado.js';
import { ReglaNegocioError } from '../errores.js';
import { OrdenServicio } from '../contratacion/OrdenServicio.js';
import { EstadoResena } from './catalogos.js';

const { PUBLICADA, EN_REVISION, ELIMINADA } = EstadoResena;

/**
 * Valoración del cliente sobre una orden finalizada (RF09).
 * Navegabilidad: Reseña → OrdenServicio y Reseña → EstadoResena. La orden no conoce
 * su reseña: la unicidad (una por orden) la valida el servicio y la clave única de la base.
 * RN-V04: no hay métodos para editar puntaje ni comentario.
 */
export class Resena extends EntidadConEstado {
  static MAX_COMENTARIO = 500;

  #id;
  #orden;
  #puntaje;
  #comentario;
  #fechaFeedback;

  constructor({ id = null, orden, puntaje, comentario = null, fechaFeedback, estado }) {
    super(estado);
    if (!(orden instanceof OrdenServicio)) throw new TypeError('Se esperaba una OrdenServicio.');
    this.#id = id;
    this.#orden = orden;
    this.#puntaje = Resena.#validarPuntaje(puntaje);
    this.#comentario = comentario;
    this.#fechaFeedback = fechaFeedback;
  }

  /** [orden Finalizada sin reseña] → Publicada (RN-V01, RN-V02). */
  static registrar({ orden, cliente, puntaje, comentario, ahora, ordenYaValorada }) {
    if (!orden.esDelCliente(cliente)) throw new ReglaNegocioError('Solo el cliente de la orden puede valorarla.', 'RN-V01');
    if (ordenYaValorada) throw new ReglaNegocioError('La orden ya tiene una valoración.', 'RN-V01');
    if (!orden.dentroDeVentanaDeConfirmacion(ahora)) {
      throw new ReglaNegocioError('Solo se puede valorar una orden Finalizada dentro de las 48 h de su finalización.', 'RN-V01');
    }
    // RN-V02 / CU09.1 6.b: el comentario es opcional y el excedente de 500 caracteres se trunca.
    const texto = typeof comentario === 'string' && comentario.trim() ? comentario.trim().slice(0, Resena.MAX_COMENTARIO) : null;
    const resena = new Resena({ orden, puntaje, comentario: texto, fechaFeedback: ahora, estado: null });
    resena._transicionar(PUBLICADA, ahora, { regla: 'RN-V01' });
    return resena;
  }

  static #validarPuntaje(puntaje) {
    const valor = Number(puntaje);
    if (puntaje === null || puntaje === undefined || puntaje === '' || !Number.isInteger(valor) || valor < 1 || valor > 5) {
      throw new ReglaNegocioError('Debe asignar una puntuación para continuar (de 1 a 5 estrellas).', 'RN-V02');
    }
    return valor;
  }

  get id() { return this.#id; }
  get orden() { return this.#orden; }
  get prestador() { return this.#orden.prestador; }
  get cliente() { return this.#orden.cliente; }
  get puntaje() { return this.#puntaje; }
  get comentario() { return this.#comentario; }
  get fechaFeedback() { return this.#fechaFeedback; }

  asignarId(id) {
    if (this.#id !== null) throw new Error('La reseña ya tiene identificador.');
    this.#id = id;
  }

  /** RN-V03: solo las Publicadas suman al promedio. */
  sumaAlPromedio() { return this.estaEn(PUBLICADA); }

  /** Publicada → En revisión moderada (RN-V05). */
  ocultar(ahora) { this._transicionar(EN_REVISION, ahora, { desde: [PUBLICADA], regla: 'RN-V05' }); }

  /** En revisión moderada → Publicada (RN-V06). */
  restaurar(ahora) { this._transicionar(PUBLICADA, ahora, { desde: [EN_REVISION], regla: 'RN-V06' }); }

  /** En revisión moderada → Eliminada (RN-V07). */
  eliminar(ahora) { this._transicionar(ELIMINADA, ahora, { desde: [EN_REVISION], regla: 'RN-V07' }); }

  /** Vista pública: sin datos del cliente más allá de su nombre. */
  aJSON() {
    return {
      id: this.#id,
      idOrden: this.#orden.id,
      estado: this.estado.nombre,
      puntaje: this.#puntaje,
      comentario: this.#comentario,
      fechaFeedback: this.#fechaFeedback.toISOString(),
      cliente: { nombre: this.cliente.nombre },
      categoria: this.#orden.solicitud.categoria.nombre,
    };
  }
}
