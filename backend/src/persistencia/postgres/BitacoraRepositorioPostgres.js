import { BitacoraRepositorio } from '../contratos/BitacoraRepositorio.js';
import { entradaAFila, filaAEntrada } from '../mapeadores.js';

export class BitacoraRepositorioPostgres extends BitacoraRepositorio {
  #bd;
  #integridad;

  constructor({ bd, integridadRepositorio }) {
    super();
    this.#bd = bd;
    this.#integridad = integridadRepositorio;
  }

  async registrar(entrada) {
    return this.#bd.transaccion((cx) => this.#integridad.conIntegridad(['bitacora'], async () => {
      const fila = await this.#bd.insertar('bitacora', { ...entradaAFila(entrada), id_bitacora: undefined }, cx);
      entrada.asignarId(fila.id_bitacora);
      await this.#integridad.sellarFila('bitacora', fila, cx);
      return entrada;
    }, cx));
  }

  async listar({ desde, hasta, idUsuario, idCriticidad, modulo, pagina, tamanio }) {
    const condiciones = [];
    const parametros = [];
    const agregar = (sql, valor) => {
      parametros.push(valor);
      condiciones.push(sql.replace('?', `$${parametros.length}`));
    };
    if (desde) agregar('fecha >= ?', desde);
    if (hasta) agregar('fecha <= ?', hasta);
    if (idUsuario) agregar('id_usuario = ?', idUsuario);
    if (idCriticidad) agregar('id_criticidad = ?', idCriticidad);
    if (modulo) agregar('modulo = ?', modulo);
    const donde = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const { rows: [{ total }] } = await this.#bd.consultar(`SELECT count(*)::int AS total FROM bitacora ${donde}`, parametros);
    const { rows } = await this.#bd.consultar(
      `SELECT * FROM bitacora ${donde} ORDER BY id_bitacora DESC LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
      [...parametros, tamanio, (pagina - 1) * tamanio],
    );
    return { items: rows.map(filaAEntrada), total };
  }
}
