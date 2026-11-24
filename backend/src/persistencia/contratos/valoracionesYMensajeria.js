/** Contratos de la Iteración 6 (valoraciones) y la Iteración 5 (mensajería). */
import { RepositorioDeFilas } from './RepositorioDeFilas.js';
import { Resena } from '../../dominio/valoraciones/Resena.js';
import { Denuncia } from '../../dominio/valoraciones/Denuncia.js';
import { EstadoResena, EstadoDenuncia, MotivoDenuncia } from '../../dominio/valoraciones/catalogos.js';
import { EstadoPresupuesto } from '../../dominio/contratacion/catalogos.js';
import { Mensaje } from '../../dominio/mensajeria/Mensaje.js';
import { aFechaOpcional } from '../../dominio/comun/fechas.js';

const ids = (filas, columna) => filas.map((f) => Number(f[columna]));

export class ResenaRepositorio extends RepositorioDeFilas {
  #ordenes;

  constructor({ ordenServicioRepositorio } = {}) {
    super();
    this.#ordenes = ordenServicioRepositorio;
  }

  async obtenerPorId(id) {
    const fila = await this._primera('resena', { id_resena: Number(id) });
    return fila ? this.#reconstruir(fila) : null;
  }

  /** RN-V01: una reseña por orden. */
  async existeParaOrden(idOrden) {
    return (await this._filas('resena', { id_orden: idOrden })).length > 0;
  }

  async listarDePrestador(idPrestador, { estados = null, limite = null } = {}) {
    const filas = await this.#filasDePrestador(idPrestador, estados);
    return Promise.all((limite ? filas.slice(0, limite) : filas).map((f) => this.#reconstruir(f)));
  }

  /** RN-V03: puntajes de las reseñas Publicadas del prestador. */
  async puntajesPublicados(idPrestador) {
    return (await this.#filasDePrestador(idPrestador, [EstadoResena.PUBLICADA])).map((f) => Number(f.puntaje));
  }

  async guardar(resena) {
    return this._guardarEntidad(resena, 'resena', 'id_resena', {
      id_orden: resena.orden.id,
      id_estado: resena.estado.id,
      puntaje: resena.puntaje,
      comentario: resena.comentario,
      fecha_feedback: resena.fechaFeedback,
    });
  }

  /** Reseña → Orden → Presupuesto → Prestador (el prestador no guarda sus reseñas). */
  async #filasDePrestador(idPrestador, estados) {
    const presupuestos = await this._filas('presupuesto', { id_prestador: idPrestador, id_estado: EstadoPresupuesto.ACEPTADO.id });
    const ordenes = await this._filas('orden_servicio', { id_presupuesto: ids(presupuestos, 'id_presupuesto') });
    const filtro = { id_orden: ids(ordenes, 'id_orden') };
    if (estados) filtro.id_estado = estados.map((e) => e.id);
    return this._filas('resena', filtro, { orden: [['fecha_feedback', 'desc']] });
  }

  async #reconstruir(fila) {
    return new Resena({
      id: Number(fila.id_resena),
      orden: await this.#ordenes.obtenerPorId(fila.id_orden),
      puntaje: Number(fila.puntaje),
      comentario: fila.comentario,
      fechaFeedback: new Date(fila.fecha_feedback),
      estado: EstadoResena.desdeId(fila.id_estado),
    });
  }
}

export class DenunciaRepositorio extends RepositorioDeFilas {
  #resenas;
  #usuarios;

  constructor({ resenaRepositorio, usuarioRepositorio } = {}) {
    super();
    this.#resenas = resenaRepositorio;
    this.#usuarios = usuarioRepositorio;
  }

  async obtenerPorId(id) {
    const fila = await this._primera('denuncia', { id_denuncia: Number(id) });
    return fila ? this.#reconstruir(fila) : null;
  }

  /** RN-V05 */
  async hayPendiente(idResena) {
    return (await this._filas('denuncia', { id_resena: idResena, id_estado: EstadoDenuncia.PENDIENTE.id })).length > 0;
  }

  async listarPorEstado(estado) {
    const filas = await this._filas('denuncia', { id_estado: estado.id }, { orden: [['fecha_denuncia', 'asc']] });
    return Promise.all(filas.map((f) => this.#reconstruir(f)));
  }

  async guardar(denuncia) {
    return this._guardarEntidad(denuncia, 'denuncia', 'id_denuncia', {
      id_resena: denuncia.resena.id,
      id_prestador: denuncia.prestador.id,
      id_administrador: denuncia.administrador?.id ?? null,
      id_estado: denuncia.estado.id,
      id_motivo: denuncia.motivo.id,
      detalle: denuncia.detalle,
      fecha_denuncia: denuncia.fechaDenuncia,
      fecha_resolucion: denuncia.fechaResolucion,
      comentario_resolucion: denuncia.comentarioResolucion,
    });
  }

  async #reconstruir(fila) {
    const resena = await this.#resenas.obtenerPorId(fila.id_resena);
    return new Denuncia({
      id: Number(fila.id_denuncia),
      resena,
      prestador: resena.prestador,
      administrador: fila.id_administrador === null ? null : await this.#usuarios.obtenerPorId(fila.id_administrador),
      motivo: MotivoDenuncia.desdeId(fila.id_motivo),
      detalle: fila.detalle,
      fechaDenuncia: new Date(fila.fecha_denuncia),
      fechaResolucion: aFechaOpcional(fila.fecha_resolucion),
      comentarioResolucion: fila.comentario_resolucion,
      estado: EstadoDenuncia.desdeId(fila.id_estado),
    });
  }
}

export class MensajeRepositorio extends RepositorioDeFilas {
  constructor() { super(); }

  async guardar(mensaje) {
    return this._guardarEntidad(mensaje, 'mensaje', 'id_mensaje', {
      id_solicitud: mensaje.solicitud.id,
      id_prestador: mensaje.prestador.id,
      id_remitente: mensaje.remitente.id,
      id_destinatario: mensaje.destinatario.id,
      texto: mensaje.texto,
      fecha: mensaje.fecha,
      leido: mensaje.leido,
    });
  }

  /** Recibe la solicitud ya cargada: remitente y destinatario salen de sus participantes. */
  async listarConversacion(solicitud, idPrestador) {
    const participantes = new Map([solicitud.cliente, ...solicitud.destinatarios].map((u) => [u.id, u]));
    const filas = await this._filas('mensaje', { id_solicitud: solicitud.id, id_prestador: idPrestador }, { orden: [['fecha', 'asc'], ['id_mensaje', 'asc']] });
    return filas.map((f) => new Mensaje({
      id: Number(f.id_mensaje),
      solicitud,
      remitente: participantes.get(Number(f.id_remitente)),
      destinatario: participantes.get(Number(f.id_destinatario)),
      texto: f.texto,
      fecha: new Date(f.fecha),
      leido: Boolean(f.leido),
    }));
  }
}
