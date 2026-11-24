import { EntradaBitacora } from '../dominio/seguridad/EntradaBitacora.js';
import { Criticidad } from '../dominio/seguridad/Criticidad.js';
import { ReglaNegocioError } from '../dominio/errores.js';

/** RN-S08: registro y consulta de eventos de seguridad. */
export class BitacoraService {
  #repositorio;
  #reloj;

  constructor({ bitacoraRepositorio, reloj }) {
    this.#repositorio = bitacoraRepositorio;
    this.#reloj = reloj;
  }

  /** `usuario` es quien realiza la acción (null si es el sistema o un anónimo). */
  async registrar({ usuario = null, modulo, evento, descripcion = '', criticidad = Criticidad.BAJA, ip = null }) {
    const entrada = new EntradaBitacora({
      fecha: this.#reloj.ahora(),
      idUsuario: usuario?.id ?? null,
      emailUsuario: usuario?.email ?? null,
      modulo,
      evento,
      descripcion,
      criticidad,
      ip,
    });
    return this.#repositorio.registrar(entrada);
  }

  async consultar(filtros = {}) {
    const pagina = BitacoraService.#entero(filtros.pagina, 1, 1, Number.MAX_SAFE_INTEGER, 'pagina');
    const tamanio = BitacoraService.#entero(filtros.tamanio, 20, 1, 100, 'tamanio');
    const criterios = {
      desde: BitacoraService.#fecha(filtros.desde, 'desde'),
      hasta: BitacoraService.#fecha(filtros.hasta, 'hasta'),
      idUsuario: filtros.idUsuario ? BitacoraService.#entero(filtros.idUsuario, null, 1, Number.MAX_SAFE_INTEGER, 'idUsuario') : null,
      idCriticidad: filtros.idCriticidad ? BitacoraService.#criticidad(filtros.idCriticidad) : null,
      modulo: typeof filtros.modulo === 'string' && filtros.modulo ? filtros.modulo : null,
      pagina,
      tamanio,
    };
    const { items, total } = await this.#repositorio.listar(criterios);
    return { items: items.map((e) => e.toJSON()), total, pagina, tamanio };
  }

  static #entero(valor, porDefecto, minimo, maximo, campo) {
    if (valor === undefined || valor === null || valor === '') return porDefecto;
    const numero = Number(valor);
    if (!Number.isInteger(numero) || numero < minimo || numero > maximo) {
      throw new ReglaNegocioError(`El filtro ${campo} no es válido.`, 'DATOS');
    }
    return numero;
  }

  static #fecha(valor, campo) {
    if (!valor) return null;
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) throw new ReglaNegocioError(`El filtro ${campo} no es una fecha válida.`, 'DATOS');
    return fecha;
  }

  static #criticidad(valor) {
    try {
      return Criticidad.desdeId(valor).id;
    } catch {
      throw new ReglaNegocioError('El filtro idCriticidad no es válido.', 'DATOS');
    }
  }
}
