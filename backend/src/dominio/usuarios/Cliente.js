import { Usuario } from './Usuario.js';
import { Zona } from './Zona.js';
import { ReglaNegocioError } from '../errores.js';

/** Usuario que demanda servicios técnicos y reside en una zona (RF02). */
export class Cliente extends Usuario {
  #zona;

  constructor({ zona, ...datos }) {
    super(datos);
    if (!(zona instanceof Zona)) throw new ReglaNegocioError('La zona es obligatoria.', 'DATOS');
    this.#zona = zona;
  }

  get rol() { return 'cliente'; }
  get zona() { return this.#zona; }

  perfilPropio() {
    return { ...super.perfilPropio(), zona: this.#zona.toJSON() };
  }
}
