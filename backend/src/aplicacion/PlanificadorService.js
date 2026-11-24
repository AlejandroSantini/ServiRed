import { EstadoSolicitud, EstadoPresupuesto, EstadoOrdenServicio } from '../dominio/contratacion/catalogos.js';

/**
 * Actor "Sistema" de RF05: aplica las reglas que dependen del paso del tiempo.
 *  - CU05.8: presupuestos con fecha de validez superada → Vencido (RN-C04).
 *  - CU05.8: solicitudes Abiertas con 15 días → Vencida (RN-C07).
 *  - CU05.7: órdenes Finalizadas sin confirmación tras 48 h → Cerrada (RN-C11).
 * El servidor lo ejecuta periódicamente; los servicios también aplican estas
 * reglas en el momento si alguien opera sobre una entidad vencida.
 */
export class PlanificadorService {
  #solicitudes;
  #presupuestos;
  #ordenes;
  #transacciones;
  #notificador;
  #reloj;

  constructor({ solicitudRepositorio, presupuestoRepositorio, ordenServicioRepositorio, transacciones, notificador, reloj }) {
    this.#solicitudes = solicitudRepositorio;
    this.#presupuestos = presupuestoRepositorio;
    this.#ordenes = ordenServicioRepositorio;
    this.#transacciones = transacciones;
    this.#notificador = notificador;
    this.#reloj = reloj;
  }

  async ejecutar() {
    const ahora = this.#reloj.ahora();
    const resultado = { presupuestosVencidos: 0, solicitudesVencidas: 0, ordenesCerradas: 0 };

    for (const presupuesto of await this.#presupuestos.listarPorEstado(EstadoPresupuesto.EMITIDO)) {
      if (!presupuesto.vencerSiCorresponde(ahora)) continue;
      await this.#transacciones.ejecutar(async () => {
        await this.#presupuestos.guardar(presupuesto);
        await this.#notificador.registrarCambios('presupuesto', presupuesto, [presupuesto.prestador, presupuesto.solicitud.cliente]);
      });
      resultado.presupuestosVencidos += 1;
    }

    for (const solicitud of await this.#solicitudes.listarPorEstado(EstadoSolicitud.ABIERTA)) {
      if (!solicitud.vencerSiCorresponde(ahora)) continue;
      await this.#transacciones.ejecutar(async () => {
        await this.#solicitudes.guardar(solicitud);
        await this.#notificador.registrarCambios('solicitud', solicitud, [solicitud.cliente, ...solicitud.destinatarios]);
      });
      resultado.solicitudesVencidas += 1;
    }

    for (const orden of await this.#ordenes.listarPorEstado(EstadoOrdenServicio.FINALIZADA)) {
      if (!orden.cerrarAutomaticamente(ahora)) continue;
      orden.solicitud.finalizar(ahora);
      await this.#transacciones.ejecutar(async () => {
        await this.#ordenes.guardar(orden);
        await this.#solicitudes.guardar(orden.solicitud);
        await this.#notificador.registrarCambios('orden', orden, [orden.cliente, orden.prestador]);
        await this.#notificador.registrarCambios('solicitud', orden.solicitud, []);
      });
      resultado.ordenesCerradas += 1;
    }
    return resultado;
  }
}
