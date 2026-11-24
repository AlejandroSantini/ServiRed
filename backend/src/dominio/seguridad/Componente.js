import { ReglaNegocioError } from '../errores.js';
import { textoObligatorio } from '../comun/validaciones.js';

const FORMATO_CODIGO = /^[A-Z][A-Z0-9_]{2,49}$/;

/**
 * Patrón Composite (RN-S06): un permiso es una Patente (hoja) o una Familia
 * (compuesto que agrupa patentes y otras familias). El usuario solo conoce
 * sus componentes y pregunta tienePermiso(codigo) sin importar la profundidad.
 */
export class Componente {
  #id;
  #codigo;
  #nombre;

  constructor({ id = null, codigo, nombre }) {
    if (new.target === Componente) throw new TypeError('Componente es abstracta: usar Patente o Familia.');
    if (typeof codigo !== 'string' || !FORMATO_CODIGO.test(codigo)) {
      throw new ReglaNegocioError('El código del permiso debe estar en mayúsculas (A-Z, 0-9, _), entre 3 y 50 caracteres.', 'RN-S06');
    }
    this.#id = id;
    this.#codigo = codigo;
    this.#nombre = textoObligatorio(nombre, 'nombre del permiso', 100);
  }

  get id() { return this.#id; }
  get codigo() { return this.#codigo; }
  get nombre() { return this.#nombre; }

  asignarId(id) {
    if (this.#id !== null) throw new Error('El permiso ya tiene identificador.');
    this.#id = id;
  }

  esFamilia() { return false; }

  /** Hijos directos (vacío en una patente). */
  get hijos() { return []; }

  /** ¿Este componente otorga la patente `codigo`? */
  tienePermiso(_codigo) { throw new Error('Método abstracto'); }

  /** Patentes que otorga, sin repetir. */
  obtenerPatentes() { throw new Error('Método abstracto'); }

  /** ¿Contiene (a cualquier profundidad) al componente indicado? */
  contiene(_componente) { return false; }

  agregar(_componente) {
    throw new ReglaNegocioError('Una patente no puede contener otros permisos.', 'RN-S06');
  }

  quitar(_codigo) {
    throw new ReglaNegocioError('Una patente no contiene otros permisos.', 'RN-S06');
  }

  toJSON() {
    return {
      codigo: this.#codigo,
      nombre: this.#nombre,
      tipo: this.esFamilia() ? 'familia' : 'patente',
      hijos: this.hijos.map((h) => h.toJSON()),
    };
  }
}
