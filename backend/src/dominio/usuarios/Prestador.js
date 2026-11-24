import { Usuario } from './Usuario.js';
import { Zona } from './Zona.js';
import { CategoriaOficio } from './CategoriaOficio.js';
import { ReglaNegocioError } from '../errores.js';
import { textoOpcional } from '../comun/validaciones.js';

/**
 * Usuario que ofrece uno o más oficios en una o más zonas (RF01).
 * Guarda sus zonas y categorías: colecciones acotadas y propias del perfil
 * (excepción documentada del criterio de navegabilidad, 12.2.5).
 * No guarda la lista de presupuestos ni de reseñas: se consultan por repositorio.
 */
export class Prestador extends Usuario {
  #zonas;
  #categorias;
  #tarifaBase;
  #descripcion;
  #disponibilidad;
  #disponibilidadActiva;
  #reputacionPromedio;

  constructor({
    zonas, categorias, tarifaBase, descripcion = null, disponibilidad = null,
    disponibilidadActiva = true, reputacionPromedio = 0, ...datos
  }) {
    super(datos);
    this.#zonas = Prestador.#validarColeccion(zonas, Zona, 'una zona de cobertura');
    this.#categorias = Prestador.#validarColeccion(categorias, CategoriaOficio, 'una categoría de oficio');
    const tarifa = Number(tarifaBase);
    if (!Number.isFinite(tarifa) || tarifa <= 0) throw new ReglaNegocioError('La tarifa base debe ser mayor que 0.', 'DATOS');
    this.#tarifaBase = Math.round(tarifa * 100) / 100;
    this.#descripcion = textoOpcional(descripcion, 'descripción profesional', 1000);
    this.#disponibilidad = textoOpcional(disponibilidad, 'disponibilidad horaria', 500);
    this.#disponibilidadActiva = Boolean(disponibilidadActiva);
    this.#reputacionPromedio = Number(reputacionPromedio);
  }

  static #validarColeccion(elementos, Clase, descripcion) {
    if (!Array.isArray(elementos) || elementos.length === 0) {
      throw new ReglaNegocioError(`El prestador debe indicar al menos ${descripcion}.`, 'DATOS');
    }
    const unicos = new Map();
    for (const elemento of elementos) {
      if (!(elemento instanceof Clase)) throw new TypeError(`Se esperaba ${Clase.name}.`);
      unicos.set(elemento.id, elemento);
    }
    return [...unicos.values()];
  }

  get rol() { return 'prestador'; }
  get zonas() { return [...this.#zonas]; }
  get categorias() { return [...this.#categorias]; }
  get tarifaBase() { return this.#tarifaBase; }
  get descripcion() { return this.#descripcion; }
  get disponibilidad() { return this.#disponibilidad; }
  get disponibilidadActiva() { return this.#disponibilidadActiva; }
  get reputacionPromedio() { return this.#reputacionPromedio; }

  ofreceCategoria(categoria) {
    return this.#categorias.some((c) => c.id === categoria?.id);
  }

  cubreZona(zona) {
    return this.#zonas.some((z) => z.id === zona?.id);
  }

  /** Precondición de RF05: activo y con disponibilidad activa. */
  estaDisponible() {
    return this.estaActivo() && this.#disponibilidadActiva;
  }

  /** RN-V03: promedio aritmético simple de los puntajes de las reseñas Publicadas. */
  recalcularReputacion(puntajes) {
    const suma = puntajes.reduce((total, p) => total + p, 0);
    this.#reputacionPromedio = puntajes.length ? Math.round((suma / puntajes.length) * 100) / 100 : 0;
  }

  /** RF07: los cambios de disponibilidad se reflejan en el perfil. */
  actualizarDisponibilidad({ disponibilidad, disponibilidadActiva } = {}) {
    if (disponibilidad !== undefined) this.#disponibilidad = textoOpcional(disponibilidad, 'disponibilidad horaria', 500);
    if (disponibilidadActiva !== undefined) {
      if (typeof disponibilidadActiva !== 'boolean') throw new ReglaNegocioError('disponibilidadActiva debe ser verdadero o falso.', 'DATOS');
      this.#disponibilidadActiva = disponibilidadActiva;
    }
  }

  datosPublicos() {
    return {
      ...super.datosPublicos(),
      zonas: this.#zonas.map((z) => z.toJSON()),
      categorias: this.#categorias.map((c) => c.toJSON()),
      tarifaBase: this.#tarifaBase,
      descripcion: this.#descripcion,
      disponibilidad: this.#disponibilidad,
      disponibilidadActiva: this.#disponibilidadActiva,
      reputacionPromedio: this.#reputacionPromedio,
    };
  }
}
