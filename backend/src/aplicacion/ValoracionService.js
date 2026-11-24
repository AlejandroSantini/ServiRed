import { NoEncontradoError, ReglaNegocioError } from '../dominio/errores.js';
import { Cliente } from '../dominio/usuarios/Cliente.js';
import { Prestador } from '../dominio/usuarios/Prestador.js';
import { Administrador } from '../dominio/usuarios/Administrador.js';
import { Resena } from '../dominio/valoraciones/Resena.js';
import { Denuncia } from '../dominio/valoraciones/Denuncia.js';
import { EstadoDenuncia, EstadoResena, MotivoDenuncia } from '../dominio/valoraciones/catalogos.js';
import { PATENTE } from '../dominio/seguridad/permisosDelSistema.js';
import { exigirTipo, idOpcional } from './comun.js';

/** RF09 Valoraciones y reputación, RF12 Moderación de reseñas (Iteración 6, núcleo). */
export class ValoracionService {
  #resenas;
  #denuncias;
  #ordenes;
  #solicitudes;
  #usuarios;
  #transacciones;
  #notificador;
  #contratacion;
  #reloj;

  constructor({
    resenaRepositorio, denunciaRepositorio, ordenServicioRepositorio, solicitudRepositorio, usuarioRepositorio,
    transacciones, notificador, contratacion, reloj,
  }) {
    this.#resenas = resenaRepositorio;
    this.#denuncias = denunciaRepositorio;
    this.#ordenes = ordenServicioRepositorio;
    this.#solicitudes = solicitudRepositorio;
    this.#usuarios = usuarioRepositorio;
    this.#transacciones = transacciones;
    this.#notificador = notificador;
    this.#contratacion = contratacion;
    this.#reloj = reloj;
  }

  /**
   * CU09.1 Evaluar orden de servicio (CU05.6 de la Iteración 3):
   * crea la reseña Publicada, recalcula la reputación (CU09.2), cierra la orden y finaliza la solicitud.
   */
  async evaluarOrden(cliente, idOrden, { puntaje, comentario } = {}) {
    exigirTipo(cliente, Cliente, 'clientes');
    const orden = await this.#ordenes.obtenerPorId(idOpcional(idOrden, 'orden') ?? -1);
    if (!orden || !orden.esDelCliente(cliente)) throw new NoEncontradoError('La orden no existe.');
    const ahora = this.#reloj.ahora();
    await this.#contratacion.cerrarSiVencioLaConfirmacion(orden, ahora);

    const resena = Resena.registrar({
      orden, cliente, puntaje, comentario, ahora, ordenYaValorada: await this.#resenas.existeParaOrden(orden.id),
    });
    orden.confirmarFinalizacion(cliente, ahora);
    orden.solicitud.finalizar(ahora);

    const reputacion = await this.#transacciones.ejecutar(async () => {
      await this.#resenas.guardar(resena);
      await this.#ordenes.guardar(orden);
      await this.#solicitudes.guardar(orden.solicitud);
      const nueva = await this.#recalcularReputacion(orden.prestador.id);
      await this.#notificador.registrarCambios('resena', resena, [orden.prestador], {
        mensaje: `Recibiste una valoración de ${resena.puntaje} estrellas por la orden #${orden.id}.`,
      });
      await this.#notificador.registrarCambios('orden', orden, [orden.prestador]);
      await this.#notificador.registrarCambios('solicitud', orden.solicitud, []);
      return nueva;
    });
    return { resena: resena.aJSON(), reputacionPromedio: reputacion };
  }

  /** Reseñas públicas de un prestador (solo Publicadas). */
  async resenasPublicas(idPrestador) {
    const prestador = await this.#usuarios.obtenerPorId(idOpcional(idPrestador, 'prestador') ?? -1);
    if (!(prestador instanceof Prestador)) throw new NoEncontradoError('El prestador no existe.');
    return (await this.#resenas.listarDePrestador(prestador.id, { estados: [EstadoResena.PUBLICADA] })).map((r) => r.aJSON());
  }

  /** Reseñas recibidas por el prestador, en cualquier estado (para poder denunciar). */
  async resenasRecibidas(prestador) {
    exigirTipo(prestador, Prestador, 'prestadores');
    const resenas = await this.#resenas.listarDePrestador(prestador.id);
    return Promise.all(resenas.map(async (r) => ({ ...r.aJSON(), comentario: r.comentario, denunciaPendiente: await this.#denuncias.hayPendiente(r.id) })));
  }

  /** CU09.3 Denunciar reseña (RN-V05): se oculta y deja de sumar al promedio. */
  async denunciar(prestador, idResena, { idMotivo, detalle } = {}) {
    exigirTipo(prestador, Prestador, 'prestadores');
    const resena = await this.#resenas.obtenerPorId(idOpcional(idResena, 'reseña') ?? -1);
    if (!resena || resena.prestador.id !== prestador.id) throw new NoEncontradoError('La reseña no existe.');
    let motivo;
    try {
      motivo = MotivoDenuncia.desdeId(idMotivo);
    } catch {
      throw new ReglaNegocioError('Debe indicar el motivo: 1 lenguaje ofensivo, 2 datos falsos.', 'RN-V05');
    }
    const ahora = this.#reloj.ahora();
    const denuncia = Denuncia.registrar({
      resena, prestador, motivo, detalle, ahora, hayPendiente: await this.#denuncias.hayPendiente(resena.id),
    });
    const administradores = (await this.#usuarios.listar())
      .filter((u) => u instanceof Administrador && u.estaActivo() && u.tienePermiso(PATENTE.DENUNCIA_MODERAR));
    await this.#transacciones.ejecutar(async () => {
      await this.#denuncias.guardar(denuncia);
      await this.#resenas.guardar(resena);
      await this.#recalcularReputacion(prestador.id);
      await this.#notificador.registrarCambios('denuncia', denuncia, administradores, {
        mensaje: `Nueva denuncia #${denuncia.id} para moderar (${motivo.nombre}).`,
      });
      await this.#notificador.registrarCambios('resena', resena, []);
    });
    return denuncia.aJSON();
  }

  async denunciasPendientes() {
    return (await this.#denuncias.listarPorEstado(EstadoDenuncia.PENDIENTE)).map((d) => d.aJSON());
  }

  /** CU09.4 Moderar denuncia (RN-V06, RN-V07, RN-V08) con recálculo de la reputación. */
  async moderar(administrador, idDenuncia, { decision, comentario } = {}) {
    exigirTipo(administrador, Administrador, 'administradores');
    const denuncia = await this.#denuncias.obtenerPorId(idOpcional(idDenuncia, 'denuncia') ?? -1);
    if (!denuncia) throw new NoEncontradoError('La denuncia no existe.');
    const ahora = this.#reloj.ahora();
    if (decision === 'aprobar') denuncia.aprobar(administrador, comentario, ahora);
    else if (decision === 'desestimar') denuncia.desestimar(administrador, comentario, ahora);
    else throw new ReglaNegocioError('La decisión debe ser "aprobar" o "desestimar".', 'RN-V08');

    const resena = denuncia.resena;
    await this.#transacciones.ejecutar(async () => {
      await this.#denuncias.guardar(denuncia);
      await this.#resenas.guardar(resena);
      await this.#recalcularReputacion(denuncia.prestador.id);
      await this.#notificador.registrarCambios('denuncia', denuncia, [denuncia.prestador]);
      await this.#notificador.registrarCambios('resena', resena, decision === 'aprobar' ? [resena.cliente] : []);
    });
    return denuncia.aJSON();
  }

  /** CU09.2 Recalcular reputación (RN-V03): promedio de las reseñas Publicadas. */
  async #recalcularReputacion(idPrestador) {
    const prestador = await this.#usuarios.obtenerPorId(idPrestador);
    prestador.recalcularReputacion(await this.#resenas.puntajesPublicados(idPrestador));
    await this.#usuarios.guardar(prestador);
    return prestador.reputacionPromedio;
  }
}
