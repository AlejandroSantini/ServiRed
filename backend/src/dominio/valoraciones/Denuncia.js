import { EntidadConEstado } from '../comun/EntidadConEstado.js';
import { ReglaNegocioError } from '../errores.js';
import { textoOpcional } from '../comun/validaciones.js';
import { Prestador } from '../usuarios/Prestador.js';
import { Administrador } from '../usuarios/Administrador.js';
import { EstadoDenuncia, MotivoDenuncia } from './catalogos.js';
import { Resena } from './Resena.js';

const { PENDIENTE, DESESTIMADA, APROBADA } = EstadoDenuncia;

/**
 * Denuncia de una reseña por parte del prestador evaluado (RF12).
 * Navegabilidad: Denuncia → Reseña, Prestador, Administrador (0..1) y su Estado.
 * Es la denuncia la que cambia el estado de la reseña.
 */
export class Denuncia extends EntidadConEstado {
  #id;
  #resena;
  #prestador;
  #administrador;
  #motivo;
  #detalle;
  #fechaDenuncia;
  #fechaResolucion;
  #comentarioResolucion;

  constructor({
    id = null, resena, prestador, administrador = null, motivo, detalle = null, fechaDenuncia,
    fechaResolucion = null, comentarioResolucion = null, estado,
  }) {
    super(estado);
    if (!(resena instanceof Resena)) throw new TypeError('Se esperaba una Resena.');
    if (!(prestador instanceof Prestador)) throw new ReglaNegocioError('Solo un prestador puede denunciar reseñas.', 'RN-V05');
    if (!(motivo instanceof MotivoDenuncia)) throw new ReglaNegocioError('Debe indicar el motivo de la denuncia.', 'RN-V05');
    this.#id = id;
    this.#resena = resena;
    this.#prestador = prestador;
    this.#administrador = administrador;
    this.#motivo = motivo;
    this.#detalle = textoOpcional(detalle, 'detalle', 1000);
    this.#fechaDenuncia = fechaDenuncia;
    this.#fechaResolucion = fechaResolucion;
    this.#comentarioResolucion = comentarioResolucion;
  }

  /** [inicio] → Pendiente; la reseña pasa a En revisión moderada (RN-V05). */
  static registrar({ resena, prestador, motivo, detalle, ahora, hayPendiente }) {
    if (resena.prestador.id !== prestador?.id) throw new ReglaNegocioError('Solo el prestador evaluado puede denunciar la reseña.', 'RN-V05');
    if (hayPendiente) throw new ReglaNegocioError('Ya existe una denuncia pendiente para esta reseña.', 'RN-V05');
    const denuncia = new Denuncia({ resena, prestador, motivo, detalle, fechaDenuncia: ahora, estado: null });
    resena.ocultar(ahora);
    denuncia._transicionar(PENDIENTE, ahora, { regla: 'RN-V05' });
    return denuncia;
  }

  get id() { return this.#id; }
  get resena() { return this.#resena; }
  get prestador() { return this.#prestador; }
  get administrador() { return this.#administrador; }
  get motivo() { return this.#motivo; }
  get detalle() { return this.#detalle; }
  get fechaDenuncia() { return this.#fechaDenuncia; }
  get fechaResolucion() { return this.#fechaResolucion; }
  get comentarioResolucion() { return this.#comentarioResolucion; }

  asignarId(id) {
    if (this.#id !== null) throw new Error('La denuncia ya tiene identificador.');
    this.#id = id;
  }

  /** Pendiente → Desestimada; la reseña vuelve a Publicada (RN-V06, RN-V08). */
  desestimar(administrador, comentario, ahora) {
    this.#resolver(DESESTIMADA, administrador, comentario, ahora, 'RN-V06');
    this.#resena.restaurar(ahora);
  }

  /** Pendiente → Aprobada; la reseña pasa a Eliminada (RN-V07, RN-V08). */
  aprobar(administrador, comentario, ahora) {
    this.#resolver(APROBADA, administrador, comentario, ahora, 'RN-V07');
    this.#resena.eliminar(ahora);
  }

  #resolver(estado, administrador, comentario, ahora, regla) {
    if (!(administrador instanceof Administrador)) throw new ReglaNegocioError('Solo un administrador resuelve denuncias.', 'RN-V08');
    if (typeof comentario !== 'string' || !comentario.trim()) {
      throw new ReglaNegocioError('Debe fundamentar la resolución.', 'RN-V08');
    }
    this._transicionar(estado, ahora, { desde: [PENDIENTE], regla, observacion: comentario.trim().slice(0, 1000) });
    this.#administrador = administrador;
    this.#comentarioResolucion = comentario.trim().slice(0, 1000);
    this.#fechaResolucion = ahora;
  }

  aJSON() {
    return {
      id: this.#id,
      estado: this.estado.nombre,
      motivo: this.#motivo.toJSON(),
      detalle: this.#detalle,
      fechaDenuncia: this.#fechaDenuncia.toISOString(),
      prestador: this.#prestador.resumen(),
      resena: { ...this.#resena.aJSON(), comentario: this.#resena.comentario },
      administrador: this.#administrador?.resumen() ?? null,
      fechaResolucion: this.#fechaResolucion?.toISOString() ?? null,
      comentarioResolucion: this.#comentarioResolucion,
    };
  }
}
