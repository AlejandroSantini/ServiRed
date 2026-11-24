import { noImplementado } from './noImplementado.js';

/** Contrato de la bitácora (RN-S08): solo se agregan entradas, nunca se modifican ni borran. */
export class BitacoraRepositorio {
  async registrar(_entrada) { throw noImplementado('BitacoraRepositorio', 'registrar'); }

  /**
   * @param {{desde?:Date, hasta?:Date, idUsuario?:number, idCriticidad?:number, modulo?:string, pagina:number, tamanio:number}} _filtros
   * @returns {Promise<{items: import('../../dominio/seguridad/EntradaBitacora.js').EntradaBitacora[], total:number}>}
   */
  async listar(_filtros) { throw noImplementado('BitacoraRepositorio', 'listar'); }
}
