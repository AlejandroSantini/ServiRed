/**
 * Contratos de la Iteración 3 (y consultas de la Iteración 4).
 * Respetan la navegabilidad de 12.2.5: cada fila guarda la FK del lado «muchos»
 * y las colecciones inversas se obtienen con consultas, no con listas en la entidad.
 */
import { RepositorioDeFilas } from './RepositorioDeFilas.js';
import { SolicitudServicio } from '../../dominio/contratacion/SolicitudServicio.js';
import { Presupuesto } from '../../dominio/contratacion/Presupuesto.js';
import { OrdenServicio } from '../../dominio/contratacion/OrdenServicio.js';
import { Notificacion } from '../../dominio/contratacion/Notificacion.js';
import { EstadoSolicitud, EstadoPresupuesto, EstadoOrdenServicio, Turno } from '../../dominio/contratacion/catalogos.js';
import { normalizarFecha, aFechaOpcional } from '../../dominio/comun/fechas.js';

const ids = (filas, columna) => filas.map((f) => Number(f[columna]));

export class SolicitudRepositorio extends RepositorioDeFilas {
  #usuarios;
  #catalogos;
  #cifrador;

  constructor({ usuarioRepositorio, catalogoRepositorio, cifrador } = {}) {
    super();
    this.#usuarios = usuarioRepositorio;
    this.#catalogos = catalogoRepositorio;
    this.#cifrador = cifrador;
  }

  async obtenerPorId(id) {
    const fila = await this._primera('solicitud_servicio', { id_solicitud: Number(id) });
    return fila ? this.#reconstruir(fila) : null;
  }

  async listarDeCliente(idCliente) {
    return this.#reconstruirTodas(await this._filas('solicitud_servicio', { id_cliente: idCliente }, { orden: [['id_solicitud', 'desc']] }));
  }

  async listarDirigidasA(idPrestador) {
    const idsSolicitud = ids(await this._filas('solicitud_destinatario', { id_prestador: idPrestador }), 'id_solicitud');
    return this.#reconstruirTodas(await this._filas('solicitud_servicio', { id_solicitud: idsSolicitud }, { orden: [['id_solicitud', 'desc']] }));
  }

  async listarPorEstado(estado) {
    return this.#reconstruirTodas(await this._filas('solicitud_servicio', { id_estado: estado.id }));
  }

  async guardar(solicitud) {
    const esNueva = solicitud.id === null;
    await this._guardarEntidad(solicitud, 'solicitud_servicio', 'id_solicitud', {
      id_cliente: solicitud.cliente.id,
      id_categoria: solicitud.categoria.id,
      id_zona: solicitud.zona.id,
      id_turno_preferido: solicitud.turnoPreferido.id,
      id_estado: solicitud.estado.id,
      descripcion: solicitud.descripcion,
      direccion_cifrada: this.#cifrador.cifrar(solicitud.direccion),
      fecha_preferida: solicitud.fechaPreferida,
      fecha_creacion: solicitud.fechaCreacion,
      fecha_limite: solicitud.fechaLimite,
    });
    // Los destinatarios se fijan al crear la solicitud y no cambian.
    if (esNueva) {
      for (const prestador of solicitud.destinatarios) {
        await this._insertar('solicitud_destinatario', { id_solicitud: solicitud.id, id_prestador: prestador.id });
      }
    }
    return solicitud;
  }

  #reconstruirTodas(filas) {
    return Promise.all(filas.map((f) => this.#reconstruir(f)));
  }

  async #reconstruir(fila) {
    const idsDestinatarios = ids(await this._filas('solicitud_destinatario', { id_solicitud: fila.id_solicitud }, { orden: [['id_prestador', 'asc']] }), 'id_prestador');
    const [cliente, ...destinatarios] = await Promise.all([fila.id_cliente, ...idsDestinatarios].map((id) => this.#usuarios.obtenerPorId(id)));
    const [[zona], [categoria]] = await Promise.all([
      this.#catalogos.obtenerZonas([fila.id_zona]),
      this.#catalogos.obtenerCategorias([fila.id_categoria]),
    ]);
    return new SolicitudServicio({
      id: Number(fila.id_solicitud),
      cliente,
      categoria,
      zona,
      descripcion: fila.descripcion,
      direccion: this.#cifrador.descifrar(fila.direccion_cifrada),
      fechaPreferida: normalizarFecha(fila.fecha_preferida),
      turnoPreferido: Turno.desdeId(fila.id_turno_preferido),
      destinatarios,
      fechaCreacion: new Date(fila.fecha_creacion),
      fechaLimite: new Date(fila.fecha_limite),
      estado: EstadoSolicitud.desdeId(fila.id_estado),
    });
  }
}

export class PresupuestoRepositorio extends RepositorioDeFilas {
  #solicitudes;
  #usuarios;

  constructor({ solicitudRepositorio, usuarioRepositorio } = {}) {
    super();
    this.#solicitudes = solicitudRepositorio;
    this.#usuarios = usuarioRepositorio;
  }

  async obtenerPorId(id) {
    const fila = await this._primera('presupuesto', { id_presupuesto: Number(id) });
    return fila ? this.#reconstruir(fila) : null;
  }

  /** Recibe la solicitud ya cargada para no volver a leerla. */
  async listarDeSolicitud(solicitud) {
    const filas = await this._filas('presupuesto', { id_solicitud: solicitud.id }, { orden: [['id_presupuesto', 'asc']] });
    return Promise.all(filas.map((f) => this.#reconstruir(f, solicitud)));
  }

  async listarPorEstado(estado) {
    return Promise.all((await this._filas('presupuesto', { id_estado: estado.id })).map((f) => this.#reconstruir(f)));
  }

  /** RN-C02 */
  async existeVigente(idSolicitud, idPrestador) {
    return (await this._filas('presupuesto', { id_solicitud: idSolicitud, id_prestador: idPrestador, id_estado: EstadoPresupuesto.EMITIDO.id })).length > 0;
  }

  async guardar(presupuesto) {
    return this._guardarEntidad(presupuesto, 'presupuesto', 'id_presupuesto', {
      id_solicitud: presupuesto.solicitud.id,
      id_prestador: presupuesto.prestador.id,
      id_estado: presupuesto.estado.id,
      monto_estimado: presupuesto.montoEstimado,
      tiempo_estimado_horas: presupuesto.tiempoEstimadoHoras,
      detalle: presupuesto.detalle,
      fecha_emision: presupuesto.fechaEmision,
      fecha_validez: presupuesto.fechaValidez,
    });
  }

  async #reconstruir(fila, solicitudCargada = null) {
    const solicitud = solicitudCargada ?? await this.#solicitudes.obtenerPorId(fila.id_solicitud);
    const prestador = solicitud.destinatarios.find((p) => p.id === Number(fila.id_prestador))
      ?? await this.#usuarios.obtenerPorId(fila.id_prestador);
    return new Presupuesto({
      id: Number(fila.id_presupuesto),
      solicitud,
      prestador,
      montoEstimado: Number(fila.monto_estimado),
      tiempoEstimadoHoras: Number(fila.tiempo_estimado_horas),
      detalle: fila.detalle,
      fechaEmision: new Date(fila.fecha_emision),
      fechaValidez: normalizarFecha(fila.fecha_validez),
      estado: EstadoPresupuesto.desdeId(fila.id_estado),
    });
  }
}

export class OrdenServicioRepositorio extends RepositorioDeFilas {
  #presupuestos;

  constructor({ presupuestoRepositorio } = {}) {
    super();
    this.#presupuestos = presupuestoRepositorio;
  }

  async obtenerPorId(id) {
    const fila = await this._primera('orden_servicio', { id_orden: Number(id) });
    return fila ? this.#reconstruir(fila) : null;
  }

  async listarPorEstado(estado) {
    return Promise.all((await this._filas('orden_servicio', { id_estado: estado.id })).map((f) => this.#reconstruir(f)));
  }

  /** Órdenes del prestador (vía sus presupuestos aceptados), opcionalmente filtradas por estado. */
  async listarDePrestador(idPrestador, estados = null) {
    const filas = await this._filas('presupuesto', { id_prestador: idPrestador, id_estado: EstadoPresupuesto.ACEPTADO.id });
    return this.#listarDePresupuestos(ids(filas, 'id_presupuesto'), estados);
  }

  async listarDeCliente(idCliente, estados = null) {
    const idsSolicitud = ids(await this._filas('solicitud_servicio', { id_cliente: idCliente }), 'id_solicitud');
    const filas = await this._filas('presupuesto', { id_solicitud: idsSolicitud, id_estado: EstadoPresupuesto.ACEPTADO.id });
    return this.#listarDePresupuestos(ids(filas, 'id_presupuesto'), estados);
  }

  /** Trabajos realizados (órdenes Cerradas) por prestador, para la búsqueda y el perfil. */
  async contarCerradasPorPrestador(idsPrestador) {
    const presupuestos = await this._filas('presupuesto', { id_prestador: idsPrestador, id_estado: EstadoPresupuesto.ACEPTADO.id });
    const prestadorDe = new Map(presupuestos.map((p) => [Number(p.id_presupuesto), Number(p.id_prestador)]));
    const cerradas = await this._filas('orden_servicio', { id_presupuesto: [...prestadorDe.keys()], id_estado: EstadoOrdenServicio.CERRADA.id });
    const cantidades = new Map(idsPrestador.map((id) => [id, 0]));
    for (const orden of cerradas) {
      const idPrestador = prestadorDe.get(Number(orden.id_presupuesto));
      cantidades.set(idPrestador, (cantidades.get(idPrestador) ?? 0) + 1);
    }
    return cantidades;
  }

  async guardar(orden) {
    return this._guardarEntidad(orden, 'orden_servicio', 'id_orden', {
      id_presupuesto: orden.presupuesto.id,
      id_turno: orden.turno.id,
      id_estado: orden.estado.id,
      fecha_programada: orden.fechaProgramada,
      fecha_inicio_real: orden.fechaInicioReal,
      fecha_fin_real: orden.fechaFinReal,
      fecha_cierre: orden.fechaCierre,
      cerrada_sin_confirmacion: orden.cerradaSinConfirmacion,
      motivo_interrupcion: orden.motivoInterrupcion,
    });
  }

  async #listarDePresupuestos(idsPresupuesto, estados) {
    const filtro = { id_presupuesto: idsPresupuesto };
    if (estados) filtro.id_estado = estados.map((e) => e.id);
    const filas = await this._filas('orden_servicio', filtro, { orden: [['fecha_programada', 'asc'], ['id_turno', 'asc']] });
    return Promise.all(filas.map((f) => this.#reconstruir(f)));
  }

  async #reconstruir(fila) {
    return new OrdenServicio({
      id: Number(fila.id_orden),
      presupuesto: await this.#presupuestos.obtenerPorId(fila.id_presupuesto),
      fechaProgramada: normalizarFecha(fila.fecha_programada),
      turno: Turno.desdeId(fila.id_turno),
      fechaInicioReal: aFechaOpcional(fila.fecha_inicio_real),
      fechaFinReal: aFechaOpcional(fila.fecha_fin_real),
      fechaCierre: aFechaOpcional(fila.fecha_cierre),
      cerradaSinConfirmacion: Boolean(fila.cerrada_sin_confirmacion),
      motivoInterrupcion: fila.motivo_interrupcion,
      estado: EstadoOrdenServicio.desdeId(fila.id_estado),
    });
  }
}

export class NotificacionRepositorio extends RepositorioDeFilas {
  constructor() { super(); }

  async guardar(notificacion) {
    return this._guardarEntidad(notificacion, 'notificacion', 'id_notificacion', {
      id_usuario: notificacion.usuario.id,
      mensaje: notificacion.mensaje,
      entidad: notificacion.entidad,
      id_entidad: notificacion.idEntidad,
      fecha: notificacion.fecha,
      leida: notificacion.leida,
    });
  }

  /** Recibe el usuario ya cargado (es el dueño de las notificaciones). */
  async listarDeUsuario(usuario, { soloNoLeidas = false } = {}) {
    const filtro = { id_usuario: usuario.id };
    if (soloNoLeidas) filtro.leida = false;
    const filas = await this._filas('notificacion', filtro, { orden: [['id_notificacion', 'desc']] });
    return filas.map((f) => this.#reconstruir(f, usuario));
  }

  async obtenerDeUsuario(usuario, id) {
    const fila = await this._primera('notificacion', { id_notificacion: Number(id), id_usuario: usuario.id });
    return fila ? this.#reconstruir(fila, usuario) : null;
  }

  #reconstruir(fila, usuario) {
    return new Notificacion({
      id: Number(fila.id_notificacion), usuario, mensaje: fila.mensaje, entidad: fila.entidad,
      idEntidad: fila.id_entidad === null ? null : Number(fila.id_entidad), fecha: new Date(fila.fecha), leida: Boolean(fila.leida),
    });
  }
}

/** Registro con fecha de cada cambio de estado (RN-C13, RNF06). */
export class HistorialEstadoRepositorio extends RepositorioDeFilas {
  constructor() { super(); }

  async registrar({ entidad, idEntidad, idEstadoAnterior, idEstadoNuevo, fecha, observacion = null }) {
    await this._insertar('cambio_estado', {
      id_cambio: null, entidad, id_entidad: idEntidad, id_estado_anterior: idEstadoAnterior,
      id_estado_nuevo: idEstadoNuevo, fecha, observacion,
    }, 'id_cambio');
  }

  async listar(entidad, idEntidad) {
    const filas = await this._filas('cambio_estado', { entidad, id_entidad: Number(idEntidad) }, { orden: [['id_cambio', 'asc']] });
    return filas.map((f) => ({
      idEstadoAnterior: f.id_estado_anterior === null ? null : Number(f.id_estado_anterior),
      idEstadoNuevo: Number(f.id_estado_nuevo),
      fecha: new Date(f.fecha),
      observacion: f.observacion,
    }));
  }
}
