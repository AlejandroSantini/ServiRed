import { ReglaNegocioError } from '../dominio/errores.js';
import { EstadoSolicitud, EstadoPresupuesto } from '../dominio/contratacion/catalogos.js';
import { EstadoComision } from '../dominio/monetizacion/catalogos.js';
import { DIA, HORA, fechaLocal } from '../dominio/comun/fechas.js';
import { fechaOpcional } from './comun.js';

const redondear = (n, decimales = 2) => Math.round(n * 10 ** decimales) / 10 ** decimales;

/**
 * RF10 – Reportes e indicadores (Iteración 7), calculados solo con datos registrados (OE5, CA7),
 * y reporte de ingresos de la plataforma (RF13, RF14).
 */
export class ReporteService {
  #reportes;
  #catalogos;
  #comisiones;
  #suscripciones;
  #reloj;

  constructor({ reporteRepositorio, catalogoRepositorio, comisionRepositorio, suscripcionRepositorio, reloj }) {
    this.#reportes = reporteRepositorio;
    this.#catalogos = catalogoRepositorio;
    this.#comisiones = comisionRepositorio;
    this.#suscripciones = suscripcionRepositorio;
    this.#reloj = reloj;
  }

  #periodo({ desde, hasta } = {}) {
    const fin = fechaOpcional(hasta, 'hasta') ?? this.#reloj.ahora();
    const inicio = fechaOpcional(desde, 'desde') ?? new Date(fin.getTime() - 90 * DIA);
    if (inicio > fin) throw new ReglaNegocioError('La fecha desde debe ser anterior a hasta.', 'DATOS');
    return { desde: inicio, hasta: fin };
  }

  async indicadores(filtros) {
    const periodo = this.#periodo(filtros);
    const [solicitudes, presupuestos, zonas, categorias] = await Promise.all([
      this.#reportes.solicitudesEntre(periodo.desde, periodo.hasta),
      this.#reportes.presupuestosEntre(periodo.desde, periodo.hasta),
      this.#catalogos.listarZonas(),
      this.#catalogos.listarCategorias(),
    ]);
    const nombreZona = new Map(zonas.map((z) => [z.id, z.nombre]));
    const nombreCategoria = new Map(categorias.map((c) => [c.id, c.nombre]));
    const categoriaDeSolicitud = new Map(solicitudes.map((s) => [s.id, s.idCategoria]));
    const creacionDeSolicitud = new Map(solicitudes.map((s) => [s.id, s.fechaCreacion]));

    // Demanda por zona y por categoría
    const contar = (lista, clave, nombres) => [...lista.reduce((m, s) => m.set(s[clave], (m.get(s[clave]) ?? 0) + 1), new Map())]
      .map(([id, cantidad]) => ({ id, nombre: nombres.get(id), solicitudes: cantidad }))
      .sort((a, b) => b.solicitudes - a.solicitudes);

    // Tiempo de respuesta: desde que se crea la solicitud hasta cada presupuesto
    const tiempos = presupuestos.filter((p) => creacionDeSolicitud.has(p.idSolicitud))
      .map((p) => (p.fechaEmision - creacionDeSolicitud.get(p.idSolicitud)) / HORA);

    // Conversión de presupuestos y de solicitudes
    const aceptados = presupuestos.filter((p) => p.idEstado === EstadoPresupuesto.ACEPTADO.id);
    const adjudicadas = solicitudes.filter((s) => [EstadoSolicitud.ADJUDICADA.id, EstadoSolicitud.FINALIZADA.id].includes(s.idEstado)).length;

    // Tendencia de precios: promedio mensual del monto aceptado por categoría
    const grupos = new Map();
    for (const p of aceptados) {
      const idCategoria = categoriaDeSolicitud.get(p.idSolicitud);
      if (!idCategoria) continue;
      const clave = `${idCategoria}|${fechaLocal(p.fechaEmision).slice(0, 7)}`;
      const g = grupos.get(clave) ?? { idCategoria, mes: clave.split('|')[1], suma: 0, cantidad: 0 };
      g.suma += p.monto;
      g.cantidad += 1;
      grupos.set(clave, g);
    }

    return {
      periodo: { desde: periodo.desde.toISOString(), hasta: periodo.hasta.toISOString() },
      demandaPorZona: contar(solicitudes, 'idZona', nombreZona),
      demandaPorCategoria: contar(solicitudes, 'idCategoria', nombreCategoria),
      tiempoRespuestaPromedioHoras: tiempos.length ? redondear(tiempos.reduce((a, b) => a + b, 0) / tiempos.length, 1) : null,
      conversion: {
        presupuestosEmitidos: presupuestos.length,
        presupuestosAceptados: aceptados.length,
        tasaPresupuestos: presupuestos.length ? redondear(aceptados.length / presupuestos.length, 4) : null,
        solicitudes: solicitudes.length,
        solicitudesAdjudicadas: adjudicadas,
        tasaSolicitudes: solicitudes.length ? redondear(adjudicadas / solicitudes.length, 4) : null,
      },
      tendenciaPrecios: [...grupos.values()]
        .map((g) => ({ categoria: nombreCategoria.get(g.idCategoria), mes: g.mes, promedio: redondear(g.suma / g.cantidad), cantidad: g.cantidad }))
        .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.mes.localeCompare(b.mes)),
    };
  }

  /** Ingresos de la plataforma: comisiones (RF13) y planes de visibilidad (RF14). */
  async ingresos(filtros) {
    const periodo = this.#periodo(filtros);
    const [comisiones, suscripciones] = await Promise.all([
      this.#comisiones.filasEntre(periodo.desde, periodo.hasta),
      this.#suscripciones.filasEntre(periodo.desde, periodo.hasta),
    ]);
    const suma = (lista) => redondear(lista.reduce((t, x) => t + x.monto, 0));
    const porMes = new Map();
    const acumular = (fecha, campo, monto) => {
      const mes = fechaLocal(fecha).slice(0, 7);
      const fila = porMes.get(mes) ?? { mes, comisiones: 0, planes: 0 };
      fila[campo] = redondear(fila[campo] + monto);
      porMes.set(mes, fila);
    };
    comisiones.forEach((c) => acumular(c.fechaRegistro, 'comisiones', c.monto));
    suscripciones.forEach((s) => acumular(s.fechaContratacion, 'planes', s.monto));
    return {
      periodo: { desde: periodo.desde.toISOString(), hasta: periodo.hasta.toISOString() },
      comisiones: {
        registradas: suma(comisiones),
        liquidadas: suma(comisiones.filter((c) => c.idEstado === EstadoComision.LIQUIDADA.id)),
        pendientes: suma(comisiones.filter((c) => c.idEstado === EstadoComision.PENDIENTE.id)),
      },
      planes: suma(suscripciones),
      total: redondear(suma(comisiones) + suma(suscripciones)),
      porMes: [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes)),
    };
  }
}
