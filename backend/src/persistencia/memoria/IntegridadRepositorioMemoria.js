import { IntegridadRepositorio } from '../contratos/IntegridadRepositorio.js';
import { compararPorClave, claveDeFila } from '../tablasControladas.js';

const TABLA_DVV = 'digito_verificador_vertical';

export class IntegridadRepositorioMemoria extends IntegridadRepositorio {
  #bd;

  constructor({ bd, digitoVerificador }) {
    super(digitoVerificador);
    this.#bd = bd;
  }

  async obtenerFilas(tabla) {
    return this.#bd.seleccionar(tabla).sort(compararPorClave(tabla));
  }

  async obtenerDVV(tabla) {
    return this.#bd.tabla(TABLA_DVV).find((f) => f.tabla === tabla)?.dvv ?? null;
  }

  async guardarDVV(tabla, dvv) {
    this.#bd.reemplazar(TABLA_DVV, (f) => f.tabla === tabla, [{ tabla, dvv, fecha_calculo: new Date() }]);
  }

  async actualizarDVH(tabla, fila, dvh) {
    const clave = claveDeFila(tabla, fila);
    const guardada = this.#bd.tabla(tabla).find((f) => Object.entries(clave).every(([c, v]) => f[c] === v));
    if (guardada) guardada.dvh = dvh;
  }
}
