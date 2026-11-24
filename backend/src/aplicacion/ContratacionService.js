import { NoEncontradoError, ReglaNegocioError } from '../dominio/errores.js';
import { Cliente } from '../dominio/usuarios/Cliente.js';
import { Prestador } from '../dominio/usuarios/Prestador.js';
import { SolicitudServicio } from '../dominio/contratacion/SolicitudServicio.js';
import { Presupuesto } from '../dominio/contratacion/Presupuesto.js';
import { OrdenServicio } from '../dominio/contratacion/OrdenServicio.js';
import { EstadoSolicitud, EstadoPresupuesto, Turno } from '../dominio/contratacion/catalogos.js';
import { exigirTipo, idOpcional } from './comun.js';

/**
 * RF04, RF05, RF11 – Ciclo de contratación (Iteración 3, núcleo).
 * Cada método es un caso de uso: busca las entidades, llama a sus métodos
 * (que validan las reglas RN-C), guarda en una transacción y notifica.
 */
export class ContratacionService {
  #solicitudes;
  #presupuestos;
  #ordenes;
  #usuarios;
  #catalogos;
  #transacciones;
  #notificador;
  #comisiones;
  #reloj;

  constructor({
    solicitudRepositorio, presupuestoRepositorio, ordenServicioRepositorio, usuarioRepositorio, catalogoRepositorio,
    transacciones, notificador, comisiones = null, reloj,
  }) {
    this.#solicitudes = solicitudRepositorio;
    this.#presupuestos = presupuestoRepositorio;
    this.#ordenes = ordenServicioRepositorio;
    this.#usuarios = usuarioRepositorio;
    this.#catalogos = catalogoRepositorio;
    this.#transacciones = transacciones;
    this.#notificador = notificador;
    this.#comisiones = comisiones;
    this.#reloj = reloj;
  }

  // =================== Solicitud ===================

  /** CU05.1 Solicitar presupuesto (RN-C01, RN-C07, RN-C13). */
  async solicitarPresupuesto(cliente, datos = {}) {
    exigirTipo(cliente, Cliente, 'clientes');
    const idsPrestadores = Array.isArray(datos.idsPrestadores) ? datos.idsPrestadores : [];
    if (idsPrestadores.length > SolicitudServicio.MAX_DESTINATARIOS) {
      throw new ReglaNegocioError('La solicitud debe dirigirse a entre 1 y 3 prestadores.', 'RN-C01');
    }
    const destinatarios = await Promise.all(idsPrestadores.map(async (id) => {
      const prestador = await this.#usuarios.obtenerPorId(idOpcional(id, 'prestador') ?? -1);
      if (!(prestador instanceof Prestador)) throw new ReglaNegocioError(`El prestador ${id} no existe.`, 'RN-C01');
      return prestador;
    }));
    const [zona] = await this.#catalogos.obtenerZonas([datos.idZona]);
    const [categoria] = await this.#catalogos.obtenerCategorias([datos.idCategoria]);
    const solicitud = SolicitudServicio.crear({
      cliente,
      categoria,
      zona,
      descripcion: datos.descripcion,
      direccion: datos.direccion,
      fechaPreferida: datos.fechaPreferida,
      turnoPreferido: ContratacionService.#turno(datos.idTurnoPreferido),
      destinatarios,
      ahora: this.#reloj.ahora(),
    });
    await this.#transacciones.ejecutar(async () => {
      await this.#solicitudes.guardar(solicitud);
      await this.#notificador.registrarCambios('solicitud', solicitud, destinatarios, {
        mensaje: `Recibiste la solicitud de presupuesto #${solicitud.id} (${categoria.nombre}, ${zona.nombre}).`,
      });
    });
    return solicitud.aJSON();
  }

  /** Solicitudes propias (cliente) o recibidas (prestador) con su subestado. */
  async listarSolicitudes(usuario) {
    let solicitudes;
    if (usuario instanceof Cliente) solicitudes = await this.#solicitudes.listarDeCliente(usuario.id);
    else if (usuario instanceof Prestador) solicitudes = await this.#solicitudes.listarDirigidasA(usuario.id);
    else throw new ReglaNegocioError('Solo clientes y prestadores tienen solicitudes.', 'RF05');
    return Promise.all(solicitudes.map(async (s) => this.#vistaSolicitud(s, usuario, { conPresupuestos: false })));
  }

  async obtenerSolicitud(usuario, idSolicitud) {
    return this.#vistaSolicitud(await this.#solicitudVisible(usuario, idSolicitud), usuario, { conPresupuestos: true });
  }

  /** CU05.11 Cancelar solicitud Abierta (RN-C12): los presupuestos Emitidos se descartan. */
  async cancelarSolicitud(cliente, idSolicitud) {
    const solicitud = await this.#solicitudVisible(cliente, idSolicitud);
    const ahora = this.#reloj.ahora();
    solicitud.cancelarPorCliente(cliente, ahora);
    const presupuestos = await this.#presupuestos.listarDeSolicitud(solicitud);
    await this.#transacciones.ejecutar(async () => {
      await this.#solicitudes.guardar(solicitud);
      await this.#notificador.registrarCambios('solicitud', solicitud, solicitud.destinatarios);
      for (const p of presupuestos.filter((x) => x.estaEn(EstadoPresupuesto.EMITIDO))) {
        p.descartar(ahora);
        await this.#presupuestos.guardar(p);
        await this.#notificador.registrarCambios('presupuesto', p, [p.prestador]);
      }
    });
    return solicitud.aJSON();
  }

  // =================== Presupuesto ===================

  /** CU05.2 Emitir presupuesto (RN-C02, RN-C03, RN-C13). */
  async emitirPresupuesto(prestador, idSolicitud, datos = {}) {
    exigirTipo(prestador, Prestador, 'prestadores');
    const solicitud = await this.#solicitudVisible(prestador, idSolicitud);
    const ahora = this.#reloj.ahora();
    await this.#vencerSolicitudSiCorresponde(solicitud, ahora);
    const presupuesto = Presupuesto.emitir({
      solicitud,
      prestador,
      montoEstimado: datos.montoEstimado,
      tiempoEstimadoHoras: datos.tiempoEstimadoHoras,
      detalle: datos.detalle,
      fechaValidez: datos.fechaValidez,
      ahora,
      tieneOtroVigente: await this.#presupuestos.existeVigente(solicitud.id, prestador.id),
    });
    await this.#transacciones.ejecutar(async () => {
      await this.#presupuestos.guardar(presupuesto);
      await this.#notificador.registrarCambios('presupuesto', presupuesto, [solicitud.cliente], {
        mensaje: `${prestador.nombre} ${prestador.apellido} envió un presupuesto para tu solicitud #${solicitud.id}.`,
      });
    });
    return this.#vistaPresupuesto(presupuesto, prestador);
  }

  /**
   * CU05.3 Aceptar presupuesto + CU05.9 Generar orden (RN-C04, RN-C05, RN-C14).
   * La fecha y el turno acordados son los preferidos de la solicitud salvo que se indiquen otros.
   */
  async aceptarPresupuesto(cliente, idPresupuesto, { fechaProgramada, idTurno } = {}) {
    const presupuesto = await this.#presupuestoDelCliente(cliente, idPresupuesto);
    const solicitud = presupuesto.solicitud;
    const ahora = this.#reloj.ahora();
    await this.#vencerPresupuestoSiCorresponde(presupuesto, ahora);
    await this.#vencerSolicitudSiCorresponde(solicitud, ahora);

    const fecha = fechaProgramada ?? solicitud.fechaPreferida;
    const turno = idTurno ? ContratacionService.#turno(idTurno) : solicitud.turnoPreferido;
    await this.#verificarAgendaLibre(presupuesto.prestador, fecha, turno);

    presupuesto.aceptar(ahora);
    solicitud.adjudicar(ahora);
    const otros = (await this.#presupuestos.listarDeSolicitud(solicitud))
      .filter((p) => p.id !== presupuesto.id && p.estaEn(EstadoPresupuesto.EMITIDO));
    for (const otro of otros) otro.descartar(ahora);
    const orden = OrdenServicio.generar({ presupuesto, fechaProgramada: fecha, turno, ahora });

    await this.#transacciones.ejecutar(async () => {
      await this.#presupuestos.guardar(presupuesto);
      await this.#solicitudes.guardar(solicitud);
      await this.#ordenes.guardar(orden);
      for (const otro of otros) {
        await this.#presupuestos.guardar(otro);
        await this.#notificador.registrarCambios('presupuesto', otro, [otro.prestador]);
      }
      await this.#notificador.registrarCambios('presupuesto', presupuesto, [presupuesto.prestador]);
      await this.#notificador.registrarCambios('solicitud', solicitud, []);
      await this.#notificador.registrarCambios('orden', orden, [presupuesto.prestador], {
        mensaje: `Nueva orden de servicio #${orden.id} programada para el ${fecha} (${turno.nombre}).`,
      });
      if (this.#comisiones) await this.#comisiones.registrarPorAceptacion(presupuesto);
    });
    return orden.aJSON();
  }

  /** CU05.3 FA01 Rechazar presupuesto (RN-C06): la solicitud sigue Abierta. */
  async rechazarPresupuesto(cliente, idPresupuesto) {
    const presupuesto = await this.#presupuestoDelCliente(cliente, idPresupuesto);
    const ahora = this.#reloj.ahora();
    await this.#vencerPresupuestoSiCorresponde(presupuesto, ahora);
    presupuesto.rechazar(ahora);
    await this.#transacciones.ejecutar(async () => {
      await this.#presupuestos.guardar(presupuesto);
      await this.#notificador.registrarCambios('presupuesto', presupuesto, [presupuesto.prestador]);
    });
    return presupuesto.aJSON();
  }

  // =================== Orden de servicio ===================

  async listarOrdenes(usuario, estados = null) {
    let ordenes;
    if (usuario instanceof Cliente) ordenes = await this.#ordenes.listarDeCliente(usuario.id, estados);
    else if (usuario instanceof Prestador) ordenes = await this.#ordenes.listarDePrestador(usuario.id, estados);
    else throw new ReglaNegocioError('Solo clientes y prestadores tienen órdenes.', 'RF05');
    return ordenes.map((o) => o.aJSON());
  }

  async obtenerOrden(usuario, idOrden) {
    return (await this.#ordenVisible(usuario, idOrden)).aJSON();
  }

  /** CU05.4 Iniciar servicio (RN-C08). */
  iniciarServicio(prestador, idOrden) {
    return this.#accionSobreOrden(prestador, idOrden, (orden, ahora) => orden.iniciarServicio(prestador, ahora), 'cliente');
  }

  /** CU05.4 Registrar interrupción (RN-C09, RN-C10). */
  registrarInterrupcion(prestador, idOrden, motivo) {
    return this.#accionSobreOrden(prestador, idOrden, (orden, ahora) => orden.registrarInterrupcion(prestador, motivo, ahora), 'cliente');
  }

  /** CU05.4 Reanudar servicio (RN-C09). */
  reanudarServicio(prestador, idOrden) {
    return this.#accionSobreOrden(prestador, idOrden, (orden, ahora) => orden.reanudarServicio(prestador, ahora), 'cliente');
  }

  /** CU05.4 Informar finalización (RN-C09). */
  informarFinalizacion(prestador, idOrden) {
    return this.#accionSobreOrden(prestador, idOrden, (orden, ahora) => orden.informarFinalizacion(prestador, ahora), 'cliente', {
      mensaje: (orden) => `El prestador informó la finalización de la orden #${orden.id}. Tenés 48 h para confirmar y valorar.`,
    });
  }

  /** CU05.5 Confirmar finalización sin valorar (RN-C11, 4.a): la valoración ya no podrá registrarse. */
  async confirmarFinalizacion(cliente, idOrden) {
    const orden = await this.#ordenVisible(cliente, idOrden);
    const ahora = this.#reloj.ahora();
    await this.cerrarSiVencioLaConfirmacion(orden, ahora);
    orden.confirmarFinalizacion(cliente, ahora);
    orden.solicitud.finalizar(ahora);
    await this.#transacciones.ejecutar(async () => {
      await this.#ordenes.guardar(orden);
      await this.#solicitudes.guardar(orden.solicitud);
      await this.#notificador.registrarCambios('orden', orden, [orden.prestador]);
      await this.#notificador.registrarCambios('solicitud', orden.solicitud, []);
    });
    return orden.aJSON();
  }

  /** CU05.11 / CU05.4 Cancelar orden (RN-C10, RN-C12): la solicitud también pasa a Cancelada. */
  async cancelarOrden(usuario, idOrden, motivo) {
    const orden = await this.#ordenVisible(usuario, idOrden);
    const ahora = this.#reloj.ahora();
    orden.cancelar(usuario, motivo, ahora);
    orden.solicitud.cancelarPorOrden(ahora, motivo || 'Orden cancelada');
    const contraparte = orden.esDelCliente(usuario) ? orden.prestador : orden.cliente;
    await this.#transacciones.ejecutar(async () => {
      await this.#ordenes.guardar(orden);
      await this.#solicitudes.guardar(orden.solicitud);
      await this.#notificador.registrarCambios('orden', orden, [contraparte]);
      await this.#notificador.registrarCambios('solicitud', orden.solicitud, []);
    });
    return orden.aJSON();
  }

  /**
   * CU05.7 (también lo usa la valoración): si pasaron 48 h, cierra la orden sin
   * valoración, lo guarda y avisa que ya no se puede confirmar (RN-C11).
   */
  async cerrarSiVencioLaConfirmacion(orden, ahora) {
    if (!orden.cerrarAutomaticamente(ahora)) return;
    orden.solicitud.finalizar(ahora);
    await this.#transacciones.ejecutar(async () => {
      await this.#ordenes.guardar(orden);
      await this.#solicitudes.guardar(orden.solicitud);
      await this.#notificador.registrarCambios('orden', orden, [orden.cliente, orden.prestador]);
      await this.#notificador.registrarCambios('solicitud', orden.solicitud, []);
    });
    throw new ReglaNegocioError('Pasaron más de 48 h desde la finalización: la orden se cerró sin valoración.', 'RN-C11');
  }

  // =================== Privados ===================

  async #accionSobreOrden(usuario, idOrden, accion, avisarA, { mensaje = null } = {}) {
    exigirTipo(usuario, Prestador, 'prestadores');
    const orden = await this.#ordenVisible(usuario, idOrden);
    accion(orden, this.#reloj.ahora());
    await this.#transacciones.ejecutar(async () => {
      await this.#ordenes.guardar(orden);
      await this.#notificador.registrarCambios('orden', orden, [avisarA === 'cliente' ? orden.cliente : orden.prestador], {
        mensaje: mensaje ? mensaje(orden) : null,
      });
    });
    return orden.aJSON();
  }

  /** RN-C14 (riesgo R08): el prestador no puede tener dos órdenes activas en la misma fecha y turno. */
  async #verificarAgendaLibre(prestador, fecha, turno) {
    const ocupadas = (await this.#ordenes.listarDePrestador(prestador.id))
      .filter((o) => o.ocupaAgenda() && o.fechaProgramada === fecha && o.turno.esIgualA(turno));
    if (ocupadas.length > 0) {
      throw new ReglaNegocioError(`El prestador ya tiene una orden el ${fecha} a la ${turno.nombre}. Elija otra fecha o turno.`, 'RN-C14');
    }
  }

  /** FA02: al intentar aceptar un presupuesto vencido, queda Vencido y se informa (RN-C04). */
  async #vencerPresupuestoSiCorresponde(presupuesto, ahora) {
    if (!presupuesto.vencerSiCorresponde(ahora)) return;
    await this.#transacciones.ejecutar(async () => {
      await this.#presupuestos.guardar(presupuesto);
      await this.#notificador.registrarCambios('presupuesto', presupuesto, [presupuesto.prestador]);
    });
    throw new ReglaNegocioError('El presupuesto venció y ya no puede aceptarse ni rechazarse. Puede pedir uno nuevo.', 'RN-C04');
  }

  /** FA03: una solicitud Abierta con más de 15 días pasa a Vencida (RN-C07). */
  async #vencerSolicitudSiCorresponde(solicitud, ahora) {
    if (!solicitud.vencerSiCorresponde(ahora)) return;
    await this.#transacciones.ejecutar(async () => {
      await this.#solicitudes.guardar(solicitud);
      await this.#notificador.registrarCambios('solicitud', solicitud, [solicitud.cliente, ...solicitud.destinatarios]);
    });
    throw new ReglaNegocioError('La solicitud venció: pasaron 15 días sin aceptar un presupuesto.', 'RN-C07');
  }

  /** Solo el cliente dueño y los prestadores destinatarios ven la solicitud (si no, "no existe"). */
  async #solicitudVisible(usuario, idSolicitud) {
    const solicitud = await this.#solicitudes.obtenerPorId(idOpcional(idSolicitud, 'solicitud') ?? -1);
    if (!solicitud || !(solicitud.esDelCliente(usuario) || solicitud.esDestinatario(usuario))) {
      throw new NoEncontradoError('La solicitud no existe.');
    }
    return solicitud;
  }

  async #presupuestoDelCliente(cliente, idPresupuesto) {
    exigirTipo(cliente, Cliente, 'clientes');
    const presupuesto = await this.#presupuestos.obtenerPorId(idOpcional(idPresupuesto, 'presupuesto') ?? -1);
    if (!presupuesto || !presupuesto.solicitud.esDelCliente(cliente)) throw new NoEncontradoError('El presupuesto no existe.');
    return presupuesto;
  }

  async #ordenVisible(usuario, idOrden) {
    const orden = await this.#ordenes.obtenerPorId(idOpcional(idOrden, 'orden') ?? -1);
    if (!orden || !(orden.esDelCliente(usuario) || orden.esDelPrestador(usuario))) throw new NoEncontradoError('La orden no existe.');
    return orden;
  }

  async #vistaSolicitud(solicitud, usuario, { conPresupuestos }) {
    const presupuestos = await this.#presupuestos.listarDeSolicitud(solicitud);
    const emitidos = presupuestos.filter((p) => p.estaEn(EstadoPresupuesto.EMITIDO)).length;
    const vista = {
      ...solicitud.aJSON(),
      // Subestados de Abierta derivados de la cantidad de presupuestos (no se persisten).
      subestado: solicitud.estaEn(EstadoSolicitud.ABIERTA) ? (emitidos > 0 ? 'ConPresupuestos' : 'SinPresupuestos') : null,
      cantidadPresupuestos: emitidos,
    };
    if (usuario instanceof Prestador) {
      // El prestador no ve los presupuestos de la competencia.
      const propios = presupuestos.filter((p) => p.prestador.id === usuario.id);
      vista.respondida = propios.length > 0;
      if (conPresupuestos) vista.presupuestos = await Promise.all(propios.map((p) => this.#vistaPresupuesto(p, usuario)));
    } else if (conPresupuestos) {
      vista.presupuestos = presupuestos.map((p) => p.aJSON());
    }
    return vista;
  }

  /** RF13: el prestador ve la comisión estimada desde que emite el presupuesto. */
  async #vistaPresupuesto(presupuesto, prestador) {
    const vista = presupuesto.aJSON();
    if (this.#comisiones && presupuesto.prestador.id === prestador.id) vista.comisionEstimada = await this.#comisiones.estimar(presupuesto);
    return vista;
  }

  static #turno(id) {
    try {
      return Turno.desdeId(id);
    } catch {
      throw new ReglaNegocioError('Debe indicar un turno válido (1 Mañana, 2 Tarde, 3 Noche).', 'DATOS');
    }
  }
}
