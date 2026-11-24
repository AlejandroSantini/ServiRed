import { ReglaNegocioError } from '../dominio/errores.js';
import { Prestador } from '../dominio/usuarios/Prestador.js';
import { Suscripcion } from '../dominio/monetizacion/Suscripcion.js';
import { PlanVisibilidad } from '../dominio/monetizacion/catalogos.js';
import { EstadoPresupuesto } from '../dominio/contratacion/catalogos.js';
import { Criticidad } from '../dominio/seguridad/Criticidad.js';
import { DIA } from '../dominio/comun/fechas.js';
import { exigirTipo, fechaOpcional } from './comun.js';

/** RF14 – Destacados y suscripciones (Iteración 8). */
export class SuscripcionService {
  #suscripciones;
  #visitas;
  #reportes;
  #bitacora;
  #reloj;

  constructor({ suscripcionRepositorio, visitaPerfilRepositorio, reporteRepositorio, bitacora, reloj }) {
    this.#suscripciones = suscripcionRepositorio;
    this.#visitas = visitaPerfilRepositorio;
    this.#reportes = reporteRepositorio;
    this.#bitacora = bitacora;
    this.#reloj = reloj;
  }

  planes() {
    return PlanVisibilidad.valores().map((p) => p.toJSON());
  }

  /** RN-D01 (encadena con el plan vigente) y RN-D03 (el cobro es externo; se registra el monto). */
  async contratar(prestador, { idPlan } = {}) {
    exigirTipo(prestador, Prestador, 'prestadores');
    let plan;
    try {
      plan = PlanVisibilidad.desdeId(idPlan);
    } catch {
      throw new ReglaNegocioError('El plan no existe.', 'RN-D01');
    }
    const ahora = this.#reloj.ahora();
    const anteriores = await this.#suscripciones.listarDePrestador(prestador);
    const finUltima = anteriores.reduce((max, s) => (s.fechaFin > (max ?? 0) ? s.fechaFin : max), null);
    const suscripcion = Suscripcion.contratar({ prestador, plan, ahora, finUltimaSuscripcion: finUltima });
    await this.#suscripciones.guardar(suscripcion);
    await this.#bitacora.registrar({
      usuario: prestador, modulo: 'Planes', evento: 'Contratación de plan', criticidad: Criticidad.BAJA,
      descripcion: `${plan.nombre} desde ${suscripcion.fechaInicio.toISOString()} ($${plan.precio})`,
    });
    return suscripcion.aJSON(ahora);
  }

  async misSuscripciones(prestador) {
    exigirTipo(prestador, Prestador, 'prestadores');
    const ahora = this.#reloj.ahora();
    return (await this.#suscripciones.listarDePrestador(prestador)).map((s) => s.aJSON(ahora));
  }

  /** RF14 / RN-D04: panel de visitas y conversión, solo con un plan vigente. */
  async panel(prestador, filtros = {}) {
    exigirTipo(prestador, Prestador, 'prestadores');
    const ahora = this.#reloj.ahora();
    const suscripciones = await this.#suscripciones.listarDePrestador(prestador);
    const vigente = suscripciones.find((s) => s.estaVigente(ahora));
    if (!vigente) throw new ReglaNegocioError('El panel de estadísticas requiere un plan de visibilidad vigente.', 'RN-D04');
    const hasta = fechaOpcional(filtros.hasta, 'hasta') ?? ahora;
    const desde = fechaOpcional(filtros.desde, 'desde') ?? new Date(hasta.getTime() - 30 * DIA);

    const [visitas, solicitudes, presupuestos] = await Promise.all([
      this.#visitas.contar(prestador.id, desde, hasta),
      this.#reportes.solicitudesRecibidasEntre(prestador.id, desde, hasta),
      this.#reportes.presupuestosEntre(desde, hasta, { idPrestador: prestador.id }),
    ]);
    const aceptados = presupuestos.filter((p) => p.idEstado === EstadoPresupuesto.ACEPTADO.id).length;
    const tasa = (a, b) => (b ? Math.round((a / b) * 10_000) / 10_000 : null);
    return {
      plan: vigente.plan.nombre,
      vigenteHasta: vigente.fechaFin.toISOString(),
      periodo: { desde: desde.toISOString(), hasta: hasta.toISOString() },
      visitas,
      solicitudesRecibidas: solicitudes,
      presupuestosEmitidos: presupuestos.length,
      presupuestosAceptados: aceptados,
      conversionVisitasASolicitudes: tasa(solicitudes, visitas),
      conversionPresupuestos: tasa(aceptados, presupuestos.length),
    };
  }
}
