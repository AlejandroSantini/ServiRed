import { IntegridadRepositorio } from '../contratos/IntegridadRepositorio.js';
import { definicionTabla } from '../tablasControladas.js';

export class IntegridadRepositorioPostgres extends IntegridadRepositorio {
  #bd;

  constructor({ bd, digitoVerificador }) {
    super(digitoVerificador);
    this.#bd = bd;
  }

  async obtenerFilas(tabla, ejecutor) {
    const { clave, columnas } = definicionTabla(tabla);
    const seleccion = [...new Set([...clave, ...columnas, 'dvh'])].join(', ');
    return (await this.#bd.consultar(`SELECT ${seleccion} FROM ${tabla} ORDER BY ${clave.join(', ')}`, [], ejecutor)).rows;
  }

  async obtenerDVV(tabla, ejecutor) {
    const { rows } = await this.#bd.consultar('SELECT dvv FROM digito_verificador_vertical WHERE tabla = $1', [tabla], ejecutor);
    return rows[0]?.dvv ?? null;
  }

  async guardarDVV(tabla, dvv, ejecutor) {
    await this.#bd.consultar(
      `INSERT INTO digito_verificador_vertical (tabla, dvv) VALUES ($1, $2)
       ON CONFLICT (tabla) DO UPDATE SET dvv = EXCLUDED.dvv, fecha_calculo = now()`,
      [tabla, dvv],
      ejecutor,
    );
  }

  async actualizarDVH(tabla, fila, dvh, ejecutor) {
    const { clave } = definicionTabla(tabla);
    const condicion = clave.map((c, i) => `${c} = $${i + 2}`).join(' AND ');
    await this.#bd.consultar(`UPDATE ${tabla} SET dvh = $1 WHERE ${condicion}`, [dvh, ...clave.map((c) => fila[c])], ejecutor);
  }

  async transaccion(trabajo) {
    return this.#bd.transaccion(trabajo);
  }

  /** Serializa el cálculo del DVV de una tabla entre transacciones concurrentes. */
  async bloquearTabla(tabla, ejecutor) {
    if (ejecutor) await this.#bd.consultar('SELECT pg_advisory_xact_lock(hashtext($1))', [`dvv:${tabla}`], ejecutor);
  }
}
