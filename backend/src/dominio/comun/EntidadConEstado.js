import { ReglaNegocioError } from '../errores.js';

/**
 * Base de las entidades con diagrama de estados (solicitud, presupuesto, orden,
 * reseña, denuncia, comisión).
 *
 * Cada transición del diagrama es un método de la subclase que llama a
 * _transicionar() indicando desde qué estados se permite: así "las transiciones
 * no permitidas son rechazadas" (criterio de RF05). Cada cambio queda pendiente
 * para que el servicio lo registre con su fecha y lo notifique (RN-C13, RNF06).
 */
export class EntidadConEstado {
  #estado;
  #cambios = [];

  constructor(estado) {
    this.#estado = estado ?? null;
  }

  get estado() { return this.#estado; }

  estaEn(...estados) {
    return estados.some((e) => e.esIgualA(this.#estado));
  }

  /** "Protegido": solo lo usan las subclases. */
  _transicionar(nuevo, fecha, { desde = null, regla = 'RF05', observacion = null } = {}) {
    if (desde && !this.estaEn(...desde)) {
      throw new ReglaNegocioError(`Transición no permitida: ${this.#estado?.nombre ?? 'inicio'} → ${nuevo.nombre}.`, regla);
    }
    this.#cambios.push({ anterior: this.#estado, nuevo, fecha, observacion });
    this.#estado = nuevo;
  }

  /** Devuelve los cambios de estado pendientes de registrar y los limpia. */
  extraerCambios() {
    const cambios = this.#cambios;
    this.#cambios = [];
    return cambios;
  }
}
