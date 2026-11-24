/**
 * Controladores de las Iteraciones 2 a 8. Reciben el pedido, toman el usuario
 * logueado (req.usuario) y llaman al servicio. Sin reglas de negocio.
 */
const estado = (codigo) => (res, datos) => res.status(codigo).json(datos);
const ok = estado(200);
const creado = estado(201);

export class BusquedaController {
  #busqueda;
  #valoraciones;

  constructor({ busqueda, valoraciones }) {
    this.#busqueda = busqueda;
    this.#valoraciones = valoraciones;
  }

  buscar = async (req, res) => ok(res, await this.#busqueda.buscar(req.query));
  // ?vista=resumen: se muestran solo los datos (por ejemplo, en el formulario de solicitud) y no cuenta como visita.
  perfil = async (req, res) => ok(res, await this.#busqueda.perfil(req.params.id, req.query.vista === 'resumen' ? null : req.usuario));
  resenas = async (req, res) => ok(res, await this.#valoraciones.resenasPublicas(req.params.id));
}

export class ContratacionController {
  #contratacion;

  constructor({ contratacion }) {
    this.#contratacion = contratacion;
  }

  solicitar = async (req, res) => creado(res, await this.#contratacion.solicitarPresupuesto(req.usuario, req.body));
  listarSolicitudes = async (req, res) => ok(res, await this.#contratacion.listarSolicitudes(req.usuario));
  obtenerSolicitud = async (req, res) => ok(res, await this.#contratacion.obtenerSolicitud(req.usuario, req.params.id));
  cancelarSolicitud = async (req, res) => ok(res, await this.#contratacion.cancelarSolicitud(req.usuario, req.params.id));
  emitirPresupuesto = async (req, res) => creado(res, await this.#contratacion.emitirPresupuesto(req.usuario, req.params.id, req.body));
  aceptarPresupuesto = async (req, res) => creado(res, await this.#contratacion.aceptarPresupuesto(req.usuario, req.params.id, req.body ?? {}));
  rechazarPresupuesto = async (req, res) => ok(res, await this.#contratacion.rechazarPresupuesto(req.usuario, req.params.id));
  listarOrdenes = async (req, res) => ok(res, await this.#contratacion.listarOrdenes(req.usuario));
  obtenerOrden = async (req, res) => ok(res, await this.#contratacion.obtenerOrden(req.usuario, req.params.id));
  iniciar = async (req, res) => ok(res, await this.#contratacion.iniciarServicio(req.usuario, req.params.id));
  interrumpir = async (req, res) => ok(res, await this.#contratacion.registrarInterrupcion(req.usuario, req.params.id, req.body?.motivo));
  reanudar = async (req, res) => ok(res, await this.#contratacion.reanudarServicio(req.usuario, req.params.id));
  finalizar = async (req, res) => ok(res, await this.#contratacion.informarFinalizacion(req.usuario, req.params.id));
  confirmar = async (req, res) => ok(res, await this.#contratacion.confirmarFinalizacion(req.usuario, req.params.id));
  cancelarOrden = async (req, res) => ok(res, await this.#contratacion.cancelarOrden(req.usuario, req.params.id, req.body?.motivo));
}

export class AgendaController {
  #agenda;

  constructor({ agenda }) {
    this.#agenda = agenda;
  }

  agenda = async (req, res) => ok(res, await this.#agenda.agenda(req.usuario, req.query));
  disponibilidad = async (req, res) => ok(res, await this.#agenda.actualizarDisponibilidad(req.usuario, req.body));
  historial = async (req, res) => ok(res, await this.#agenda.historial(req.usuario, req.query));
}

export class MensajeriaController {
  #mensajeria;
  #notificaciones;

  constructor({ mensajeria, notificaciones }) {
    this.#mensajeria = mensajeria;
    this.#notificaciones = notificaciones;
  }

  enviar = async (req, res) => creado(res, await this.#mensajeria.enviar(req.usuario, req.params.id, req.body));
  conversacion = async (req, res) => ok(res, await this.#mensajeria.conversacion(req.usuario, req.params.id, req.query.idPrestador));
  notificaciones = async (req, res) => ok(res, await this.#notificaciones.listar(req.usuario, { soloNoLeidas: req.query.noLeidas === 'true' }));
  leerNotificacion = async (req, res) => ok(res, await this.#notificaciones.marcarLeida(req.usuario, req.params.id));
}

export class ValoracionController {
  #valoraciones;

  constructor({ valoraciones }) {
    this.#valoraciones = valoraciones;
  }

  evaluar = async (req, res) => creado(res, await this.#valoraciones.evaluarOrden(req.usuario, req.params.id, req.body));
  recibidas = async (req, res) => ok(res, await this.#valoraciones.resenasRecibidas(req.usuario));
  denunciar = async (req, res) => creado(res, await this.#valoraciones.denunciar(req.usuario, req.params.id, req.body));
  pendientes = async (_req, res) => ok(res, await this.#valoraciones.denunciasPendientes());
  moderar = async (req, res) => ok(res, await this.#valoraciones.moderar(req.usuario, req.params.id, req.body));
}

export class MonetizacionController {
  #comisiones;
  #reportes;
  #suscripciones;

  constructor({ comisiones, reportes, suscripciones }) {
    this.#comisiones = comisiones;
    this.#reportes = reportes;
    this.#suscripciones = suscripciones;
  }

  tasas = async (_req, res) => ok(res, await this.#comisiones.listarTasas());
  configurarTasa = async (req, res) => ok(res, await this.#comisiones.configurarTasa(req.usuario, req.body));
  balancePropio = async (req, res) => ok(res, await this.#comisiones.balancePropio(req.usuario));
  balance = async (req, res) => ok(res, await this.#comisiones.balance(req.params.id));
  liquidar = async (req, res) => ok(res, await this.#comisiones.liquidar(req.usuario, req.params.id));
  indicadores = async (req, res) => ok(res, await this.#reportes.indicadores(req.query));
  ingresos = async (req, res) => ok(res, await this.#reportes.ingresos(req.query));
  planes = async (_req, res) => ok(res, this.#suscripciones.planes());
  contratar = async (req, res) => creado(res, await this.#suscripciones.contratar(req.usuario, req.body));
  misSuscripciones = async (req, res) => ok(res, await this.#suscripciones.misSuscripciones(req.usuario));
  panel = async (req, res) => ok(res, await this.#suscripciones.panel(req.usuario, req.query));
}
