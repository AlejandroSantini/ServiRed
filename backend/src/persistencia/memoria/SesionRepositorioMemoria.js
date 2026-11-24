import { SesionRepositorio } from '../contratos/SesionRepositorio.js';
import { sesionAFila, filaASesion } from '../mapeadores.js';

export class SesionRepositorioMemoria extends SesionRepositorio {
  #bd;

  constructor({ bd }) {
    super();
    this.#bd = bd;
  }

  async guardar(sesion) {
    this.#bd.reemplazar('sesion', (f) => f.id_sesion === sesion.id, [sesionAFila(sesion)]);
    return sesion;
  }

  async obtenerPorId(id) {
    const [fila] = this.#bd.seleccionar('sesion', (f) => f.id_sesion === id);
    return fila ? filaASesion(fila) : null;
  }

  async cerrarTodasDelUsuario(idUsuario, ahora) {
    for (const fila of this.#bd.tabla('sesion')) {
      if (fila.id_usuario === idUsuario && fila.fecha_cierre === null) fila.fecha_cierre = ahora;
    }
  }
}
