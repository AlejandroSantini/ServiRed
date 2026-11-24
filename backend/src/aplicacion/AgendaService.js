import { ReglaNegocioError } from '../dominio/errores.js';
import { Cliente } from '../dominio/usuarios/Cliente.js';
import { Prestador } from '../dominio/usuarios/Prestador.js';
import { EstadoOrdenServicio } from '../dominio/contratacion/catalogos.js';
import { validarFecha } from '../dominio/comun/fechas.js';
import { exigirTipo, idOpcional } from './comun.js';

const ESTADOS_HISTORIAL = [EstadoOrdenServicio.CERRADA, EstadoOrdenServicio.CANCELADA];

/** RF07 Agenda del prestador y RF08 Historial de servicios (Iteración 4). */
export class AgendaService {
  #ordenes;
  #usuarios;

  constructor({ ordenServicioRepositorio, usuarioRepositorio }) {
    this.#ordenes = ordenServicioRepositorio;
    this.#usuarios = usuarioRepositorio;
  }

  /** RF07: todas las órdenes Programadas y En ejecución (también Interrumpidas, que siguen ocupando el turno). */
  async agenda(prestador, { desde, hasta } = {}) {
    exigirTipo(prestador, Prestador, 'prestadores');
    const rango = AgendaService.#rango(desde, hasta);
    const ordenes = await this.#ordenes.listarDePrestador(prestador.id, EstadoOrdenServicio.activos());
    return {
      disponibilidad: prestador.disponibilidad,
      disponibilidadActiva: prestador.disponibilidadActiva,
      ordenes: ordenes.filter((o) => AgendaService.#enRango(o.fechaProgramada, rango)).map((o) => o.aJSON()),
    };
  }

  /** RF07: los cambios de disponibilidad se reflejan en el perfil. */
  async actualizarDisponibilidad(prestador, datos = {}) {
    exigirTipo(prestador, Prestador, 'prestadores');
    prestador.actualizarDisponibilidad({ disponibilidad: datos.disponibilidad, disponibilidadActiva: datos.disponibilidadActiva });
    await this.#usuarios.guardar(prestador);
    return prestador.datosPublicos();
  }

  /** RF08: órdenes cerradas y canceladas, con filtro por estado y por fecha programada. */
  async historial(usuario, { idEstado, desde, hasta } = {}) {
    let estados = ESTADOS_HISTORIAL;
    const id = idOpcional(idEstado, 'idEstado');
    if (id) {
      estados = ESTADOS_HISTORIAL.filter((e) => e.id === id);
      if (estados.length === 0) throw new ReglaNegocioError('El historial se filtra por Cerrada (5) o Cancelada (6).', 'DATOS');
    }
    const rango = AgendaService.#rango(desde, hasta);
    let ordenes;
    if (usuario instanceof Cliente) ordenes = await this.#ordenes.listarDeCliente(usuario.id, estados);
    else if (usuario instanceof Prestador) ordenes = await this.#ordenes.listarDePrestador(usuario.id, estados);
    else throw new ReglaNegocioError('Solo clientes y prestadores tienen historial.', 'RF08');
    return ordenes
      .filter((o) => AgendaService.#enRango(o.fechaProgramada, rango))
      .sort((a, b) => (a.fechaProgramada < b.fechaProgramada ? 1 : -1))
      .map((o) => o.aJSON());
  }

  static #rango(desde, hasta) {
    return {
      desde: desde ? validarFecha(desde, 'desde') : null,
      hasta: hasta ? validarFecha(hasta, 'hasta') : null,
    };
  }

  static #enRango(fecha, { desde, hasta }) {
    return (!desde || fecha >= desde) && (!hasta || fecha <= hasta);
  }
}
