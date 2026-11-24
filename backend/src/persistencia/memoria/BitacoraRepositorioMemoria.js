import { BitacoraRepositorio } from '../contratos/BitacoraRepositorio.js';
import { entradaAFila, filaAEntrada } from '../mapeadores.js';

export class BitacoraRepositorioMemoria extends BitacoraRepositorio {
  #bd;
  #integridad;

  constructor({ bd, integridadRepositorio }) {
    super();
    this.#bd = bd;
    this.#integridad = integridadRepositorio;
  }

  async registrar(entrada) {
    return this.#integridad.conIntegridad(['bitacora'], async () => {
      entrada.asignarId(this.#bd.siguienteId('bitacora'));
      const fila = entradaAFila(entrada);
      this.#bd.insertar('bitacora', { ...fila, dvh: this.#integridad.calcularDVH('bitacora', fila) });
      return entrada;
    });
  }

  async listar({ desde, hasta, idUsuario, idCriticidad, modulo, pagina, tamanio }) {
    const filas = this.#bd.seleccionar('bitacora', (f) => (!desde || f.fecha >= desde)
      && (!hasta || f.fecha <= hasta)
      && (!idUsuario || f.id_usuario === idUsuario)
      && (!idCriticidad || f.id_criticidad === idCriticidad)
      && (!modulo || f.modulo === modulo))
      .sort((a, b) => b.id_bitacora - a.id_bitacora);
    const inicio = (pagina - 1) * tamanio;
    return { items: filas.slice(inicio, inicio + tamanio).map(filaAEntrada), total: filas.length };
  }
}
