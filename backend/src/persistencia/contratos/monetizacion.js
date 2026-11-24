/** Contratos de las Iteraciones 7 (comisiones y reportes) y 8 (suscripciones y visitas). */
import { RepositorioDeFilas } from './RepositorioDeFilas.js';
import { TasaComision } from '../../dominio/monetizacion/TasaComision.js';
import { Comision } from '../../dominio/monetizacion/Comision.js';
import { Suscripcion } from '../../dominio/monetizacion/Suscripcion.js';
import { EstadoComision, PlanVisibilidad } from '../../dominio/monetizacion/catalogos.js';
import { EstadoPresupuesto } from '../../dominio/contratacion/catalogos.js';
import { aFechaOpcional } from '../../dominio/comun/fechas.js';

const ids = (filas, columna) => filas.map((f) => Number(f[columna]));

export class TasaComisionRepositorio extends RepositorioDeFilas {
  #catalogos;

  constructor({ catalogoRepositorio } = {}) {
    super();
    this.#catalogos = catalogoRepositorio;
  }

  async listar() {
    return Promise.all((await this._filas('tasa_comision', {}, { orden: [['id_tasa', 'asc']] })).map((f) => this.#reconstruir(f)));
  }

  async obtenerGeneral() {
    const fila = await this._primera('tasa_comision', { id_categoria: null });
    return fila ? this.#reconstruir(fila) : null;
  }

  async obtenerDeCategoria(idCategoria) {
    const fila = await this._primera('tasa_comision', { id_categoria: Number(idCategoria) });
    return fila ? this.#reconstruir(fila) : null;
  }

  async guardar(tasa) {
    return this._guardarEntidad(tasa, 'tasa_comision', 'id_tasa', {
      id_categoria: tasa.categoria?.id ?? null, porcentaje: tasa.porcentaje, fecha_actualizacion: tasa.fechaActualizacion,
    });
  }

  async #reconstruir(fila) {
    const categoria = fila.id_categoria === null ? null : (await this.#catalogos.obtenerCategorias([fila.id_categoria]))[0];
    return new TasaComision({
      id: Number(fila.id_tasa), categoria, porcentaje: Number(fila.porcentaje), fechaActualizacion: new Date(fila.fecha_actualizacion),
    });
  }
}

export class ComisionRepositorio extends RepositorioDeFilas {
  #presupuestos;

  constructor({ presupuestoRepositorio } = {}) {
    super();
    this.#presupuestos = presupuestoRepositorio;
  }

  /** RN-K02: una comisión por presupuesto. */
  async existeParaPresupuesto(idPresupuesto) {
    return (await this._filas('comision', { id_presupuesto: idPresupuesto })).length > 0;
  }

  async listarDePrestador(idPrestador, estados = null) {
    const presupuestos = await this._filas('presupuesto', { id_prestador: idPrestador, id_estado: EstadoPresupuesto.ACEPTADO.id });
    const filtro = { id_presupuesto: ids(presupuestos, 'id_presupuesto') };
    if (estados) filtro.id_estado = estados.map((e) => e.id);
    const filas = await this._filas('comision', filtro, { orden: [['fecha_registro', 'asc']] });
    return Promise.all(filas.map((f) => this.#reconstruir(f)));
  }

  /** Filas livianas para el reporte de ingresos. */
  async filasEntre(desde, hasta) {
    return (await this._filas('comision', { fecha_registro: { desde, hasta } })).map((f) => ({
      monto: Number(f.monto), idEstado: Number(f.id_estado), fechaRegistro: new Date(f.fecha_registro),
    }));
  }

  async guardar(comision) {
    return this._guardarEntidad(comision, 'comision', 'id_comision', {
      id_presupuesto: comision.presupuesto.id,
      id_estado: comision.estado.id,
      porcentaje: comision.porcentaje,
      monto: comision.monto,
      fecha_registro: comision.fechaRegistro,
      fecha_liquidacion: comision.fechaLiquidacion,
    });
  }

  async #reconstruir(fila) {
    return new Comision({
      id: Number(fila.id_comision),
      presupuesto: await this.#presupuestos.obtenerPorId(fila.id_presupuesto),
      porcentaje: Number(fila.porcentaje),
      monto: Number(fila.monto),
      fechaRegistro: new Date(fila.fecha_registro),
      fechaLiquidacion: aFechaOpcional(fila.fecha_liquidacion),
      estado: EstadoComision.desdeId(fila.id_estado),
    });
  }
}

export class SuscripcionRepositorio extends RepositorioDeFilas {
  constructor() { super(); }

  async guardar(suscripcion) {
    return this._guardarEntidad(suscripcion, 'suscripcion', 'id_suscripcion', {
      id_prestador: suscripcion.prestador.id,
      id_plan: suscripcion.plan.id,
      fecha_contratacion: suscripcion.fechaContratacion,
      fecha_inicio: suscripcion.fechaInicio,
      fecha_fin: suscripcion.fechaFin,
      monto: suscripcion.monto,
    });
  }

  /** Recibe el prestador ya cargado. */
  async listarDePrestador(prestador) {
    const filas = await this._filas('suscripcion', { id_prestador: prestador.id }, { orden: [['fecha_inicio', 'asc']] });
    return filas.map((f) => new Suscripcion({
      id: Number(f.id_suscripcion), prestador, plan: PlanVisibilidad.desdeId(f.id_plan),
      fechaContratacion: new Date(f.fecha_contratacion), fechaInicio: new Date(f.fecha_inicio), fechaFin: new Date(f.fecha_fin), monto: Number(f.monto),
    }));
  }

  /** RN-D02: plan vigente de mayor prioridad por prestador (para ordenar la búsqueda). */
  async planesVigentes(ahora) {
    const filas = await this._filas('suscripcion', { fecha_inicio: { hasta: ahora }, fecha_fin: { desde: ahora } });
    const planes = new Map();
    for (const f of filas) {
      if (new Date(f.fecha_fin).getTime() === ahora.getTime()) continue;
      const plan = PlanVisibilidad.desdeId(f.id_plan);
      const actual = planes.get(Number(f.id_prestador));
      if (!actual || plan.prioridad > actual.prioridad) planes.set(Number(f.id_prestador), plan);
    }
    return planes;
  }

  async filasEntre(desde, hasta) {
    return (await this._filas('suscripcion', { fecha_contratacion: { desde, hasta } })).map((f) => ({
      monto: Number(f.monto), idPlan: Number(f.id_plan), fechaContratacion: new Date(f.fecha_contratacion),
    }));
  }
}

export class VisitaPerfilRepositorio extends RepositorioDeFilas {
  constructor() { super(); }

  async registrar({ idPrestador, idVisitante = null, fecha }) {
    await this._insertar('visita_perfil', { id_visita: null, id_prestador: idPrestador, id_visitante: idVisitante, fecha }, 'id_visita');
  }

  async contar(idPrestador, desde, hasta) {
    return (await this._filas('visita_perfil', { id_prestador: idPrestador, fecha: { desde, hasta } })).length;
  }
}

/** Lecturas livianas (sin reconstruir entidades) para los reportes e indicadores (RF10, RF14). */
export class ReporteRepositorio extends RepositorioDeFilas {
  constructor() { super(); }

  async solicitudesEntre(desde, hasta) {
    return (await this._filas('solicitud_servicio', { fecha_creacion: { desde, hasta } })).map((f) => ({
      id: Number(f.id_solicitud), idZona: Number(f.id_zona), idCategoria: Number(f.id_categoria),
      idEstado: Number(f.id_estado), fechaCreacion: new Date(f.fecha_creacion),
    }));
  }

  async presupuestosEntre(desde, hasta, { idPrestador = null } = {}) {
    const filtro = { fecha_emision: { desde, hasta } };
    if (idPrestador) filtro.id_prestador = idPrestador;
    return (await this._filas('presupuesto', filtro)).map((f) => ({
      id: Number(f.id_presupuesto), idSolicitud: Number(f.id_solicitud), idPrestador: Number(f.id_prestador),
      idEstado: Number(f.id_estado), monto: Number(f.monto_estimado), fechaEmision: new Date(f.fecha_emision),
    }));
  }

  async solicitudesRecibidasEntre(idPrestador, desde, hasta) {
    const idsSolicitud = ids(await this._filas('solicitud_destinatario', { id_prestador: idPrestador }), 'id_solicitud');
    return (await this._filas('solicitud_servicio', { id_solicitud: idsSolicitud, fecha_creacion: { desde, hasta } })).length;
  }
}
