import { NoEncontradoError, ReglaNegocioError } from '../dominio/errores.js';
import { Cliente } from '../dominio/usuarios/Cliente.js';
import { Prestador } from '../dominio/usuarios/Prestador.js';
import { EstadoResena } from '../dominio/valoraciones/catalogos.js';
import { idOpcional } from './comun.js';

/**
 * RF03 – Búsqueda de prestadores (Iteración 2) y perfil público.
 * Orden de los resultados (RN-D02, Iteración 8): primero los de plan vigente de
 * mayor prioridad (Premium, Verificado), después por reputación y trabajos realizados.
 */
export class BusquedaService {
  #usuarios;
  #suscripciones;
  #ordenes;
  #resenas;
  #visitas;
  #reloj;

  constructor({ usuarioRepositorio, suscripcionRepositorio, ordenServicioRepositorio, resenaRepositorio, visitaPerfilRepositorio, reloj }) {
    this.#usuarios = usuarioRepositorio;
    this.#suscripciones = suscripcionRepositorio;
    this.#ordenes = ordenServicioRepositorio;
    this.#resenas = resenaRepositorio;
    this.#visitas = visitaPerfilRepositorio;
    this.#reloj = reloj;
  }

  async buscar(filtros = {}) {
    const calificacionMinima = filtros.calificacionMinima === undefined || filtros.calificacionMinima === '' ? 0 : Number(filtros.calificacionMinima);
    if (!Number.isFinite(calificacionMinima) || calificacionMinima < 0 || calificacionMinima > 5) {
      throw new ReglaNegocioError('La calificación mínima debe estar entre 0 y 5.', 'DATOS');
    }
    const pagina = Math.max(1, Number.parseInt(filtros.pagina ?? 1, 10) || 1);
    const tamanio = Math.min(50, Math.max(1, Number.parseInt(filtros.tamanio ?? 20, 10) || 20));

    const prestadores = await this.#usuarios.buscarPrestadores({
      idCategoria: idOpcional(filtros.idCategoria, 'idCategoria'),
      idZona: idOpcional(filtros.idZona, 'idZona'),
      calificacionMinima,
    });
    const planes = await this.#suscripciones.planesVigentes(this.#reloj.ahora());
    const trabajos = await this.#ordenes.contarCerradasPorPrestador(prestadores.map((p) => p.id));

    const resultados = prestadores
      .map((p) => ({ prestador: p, plan: planes.get(p.id) ?? null, trabajos: trabajos.get(p.id) ?? 0 }))
      .sort((a, b) => (b.plan?.prioridad ?? 0) - (a.plan?.prioridad ?? 0)
        || b.prestador.reputacionPromedio - a.prestador.reputacionPromedio
        || b.trabajos - a.trabajos
        || a.prestador.id - b.prestador.id);

    const items = resultados.slice((pagina - 1) * tamanio, pagina * tamanio).map((r) => this.#tarjeta(r));
    return {
      items,
      total: resultados.length,
      pagina,
      tamanio,
      mensaje: resultados.length === 0 ? 'No encontramos prestadores para esos filtros. Probá con otra zona o una calificación menor.' : null,
    };
  }

  /** Perfil público con reseñas recientes; registra la visita para el panel del prestador (RF14). */
  async perfil(idPrestador, visitante = null) {
    const prestador = await this.#usuarios.obtenerPorId(idOpcional(idPrestador, 'prestador') ?? -1);
    if (!(prestador instanceof Prestador) || !prestador.estaActivo()) throw new NoEncontradoError('El prestador no existe.');
    const ahora = this.#reloj.ahora();
    if (visitante instanceof Cliente) await this.#visitas.registrar({ idPrestador: prestador.id, idVisitante: visitante.id, fecha: ahora });
    const plan = (await this.#suscripciones.planesVigentes(ahora)).get(prestador.id) ?? null;
    const trabajos = (await this.#ordenes.contarCerradasPorPrestador([prestador.id])).get(prestador.id) ?? 0;
    const resenas = await this.#resenas.listarDePrestador(prestador.id, { estados: [EstadoResena.PUBLICADA], limite: 10 });
    return { ...this.#tarjeta({ prestador, plan, trabajos }), resenasRecientes: resenas.map((r) => r.aJSON()) };
  }

  #tarjeta({ prestador, plan, trabajos }) {
    const datos = prestador.datosPublicos();
    delete datos.email;
    delete datos.estado;
    return { ...datos, trabajosRealizados: trabajos, plan: plan ? plan.nombre : null };
  }
}
