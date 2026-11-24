import { NoEncontradoError } from '../dominio/errores.js';
import { Prestador } from '../dominio/usuarios/Prestador.js';
import { TasaComision } from '../dominio/monetizacion/TasaComision.js';
import { Comision } from '../dominio/monetizacion/Comision.js';
import { EstadoComision } from '../dominio/monetizacion/catalogos.js';
import { Criticidad } from '../dominio/seguridad/Criticidad.js';
import { exigirTipo, idOpcional } from './comun.js';

/** RF13 – Comisión por servicio (Iteración 7). */
export class ComisionService {
  #tasas;
  #comisiones;
  #usuarios;
  #catalogos;
  #transacciones;
  #bitacora;
  #reloj;

  constructor({ tasaComisionRepositorio, comisionRepositorio, usuarioRepositorio, catalogoRepositorio, transacciones, bitacora, reloj }) {
    this.#tasas = tasaComisionRepositorio;
    this.#comisiones = comisionRepositorio;
    this.#usuarios = usuarioRepositorio;
    this.#catalogos = catalogoRepositorio;
    this.#transacciones = transacciones;
    this.#bitacora = bitacora;
    this.#reloj = reloj;
  }

  async listarTasas() {
    return (await this.#tasas.listar()).map((t) => t.aJSON());
  }

  /** RN-K01: el administrador configura el porcentaje general o el de una categoría. */
  async configurarTasa(administrador, { idCategoria = null, porcentaje } = {}) {
    const ahora = this.#reloj.ahora();
    const id = idOpcional(idCategoria, 'idCategoria');
    const categoria = id ? (await this.#catalogos.obtenerCategorias([id]))[0] : null;
    let tasa = categoria ? await this.#tasas.obtenerDeCategoria(categoria.id) : await this.#tasas.obtenerGeneral();
    const anterior = tasa?.porcentaje ?? null;
    if (tasa) tasa.actualizar(porcentaje, ahora);
    else tasa = new TasaComision({ categoria, porcentaje, fechaActualizacion: ahora });
    await this.#tasas.guardar(tasa);
    await this.#bitacora.registrar({
      usuario: administrador, modulo: 'Comisiones', evento: 'Cambio de comisión', criticidad: Criticidad.MEDIA,
      descripcion: `${categoria ? categoria.nombre : 'General'}: ${anterior ?? '—'}% → ${tasa.porcentaje}%`,
    });
    return tasa.aJSON();
  }

  /** RN-K01: la tasa de la categoría tiene prioridad sobre la general. */
  async porcentajePara(categoria) {
    return (await this.#tasas.obtenerDeCategoria(categoria.id))?.porcentaje
      ?? (await this.#tasas.obtenerGeneral())?.porcentaje
      ?? 0;
  }

  /** Comisión calculada al emitir (informativa para el prestador). */
  async estimar(presupuesto) {
    const porcentaje = await this.porcentajePara(presupuesto.solicitud.categoria);
    return { porcentaje, monto: Comision.calcularMonto(presupuesto.montoEstimado, porcentaje) };
  }

  /** RN-K02: al aceptarse un presupuesto se registra su comisión (una sola vez). */
  async registrarPorAceptacion(presupuesto) {
    if (await this.#comisiones.existeParaPresupuesto(presupuesto.id)) return null;
    const comision = Comision.registrar({
      presupuesto, porcentaje: await this.porcentajePara(presupuesto.solicitud.categoria), ahora: this.#reloj.ahora(),
    });
    await this.#comisiones.guardar(comision);
    return comision;
  }

  /** RN-K03: el balance de cada prestador es la suma de sus comisiones registradas. */
  async balance(idPrestador) {
    const prestador = await this.#usuarios.obtenerPorId(idOpcional(idPrestador, 'prestador') ?? -1);
    if (!(prestador instanceof Prestador)) throw new NoEncontradoError('El prestador no existe.');
    const comisiones = await this.#comisiones.listarDePrestador(prestador.id);
    const suma = (estado) => Math.round(comisiones.filter((c) => c.estaEn(estado)).reduce((t, c) => t + c.monto, 0) * 100) / 100;
    return {
      prestador: prestador.resumen(),
      pendiente: suma(EstadoComision.PENDIENTE),
      liquidado: suma(EstadoComision.LIQUIDADA),
      total: suma(EstadoComision.PENDIENTE) + suma(EstadoComision.LIQUIDADA),
      comisiones: comisiones.map((c) => c.aJSON()),
    };
  }

  balancePropio(prestador) {
    exigirTipo(prestador, Prestador, 'prestadores');
    return this.balance(prestador.id);
  }

  /** RN-K03: el pago se hace fuera del sistema; se registra la liquidación de lo pendiente. */
  async liquidar(administrador, idPrestador) {
    const prestadorId = idOpcional(idPrestador, 'prestador') ?? -1;
    const pendientes = await this.#comisiones.listarDePrestador(prestadorId, [EstadoComision.PENDIENTE]);
    const ahora = this.#reloj.ahora();
    await this.#transacciones.ejecutar(async () => {
      for (const comision of pendientes) {
        comision.liquidar(ahora);
        await this.#comisiones.guardar(comision);
      }
    });
    const balance = await this.balance(prestadorId);
    await this.#bitacora.registrar({
      usuario: administrador, modulo: 'Comisiones', evento: 'Liquidación de comisiones', criticidad: Criticidad.MEDIA,
      descripcion: `Prestador #${prestadorId}: ${pendientes.length} comisiones liquidadas`,
    });
    return balance;
  }
}
