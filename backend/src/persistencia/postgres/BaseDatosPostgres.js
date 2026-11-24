import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';

// Las columnas date se leen como texto AAAA-MM-DD (sin conversión de zona horaria).
pg.types.setTypeParser(1082, (valor) => valor);

/**
 * Acceso a PostgreSQL. Todas las consultas usan parámetros ($1, $2...): los
 * valores nunca se concatenan al SQL (previene inyección SQL). Los nombres de
 * tablas y columnas que se arman dinámicamente salen siempre de constantes del código.
 *
 * Transacciones: dentro de transaccion() todas las consultas usan la misma
 * conexión (AsyncLocalStorage), aunque las hagan repositorios distintos.
 */
export class BaseDatosPostgres {
  #pool;
  #contexto = new AsyncLocalStorage();

  /** @param opciones.pool  pool alternativo (las pruebas usan PGlite, PostgreSQL embebido) */
  constructor(urlConexion, { pool } = {}) {
    this.#pool = pool ?? new pg.Pool({ connectionString: urlConexion, max: 10 });
  }

  async consultar(sql, parametros = [], ejecutor) {
    return (ejecutor ?? this.#contexto.getStore() ?? this.#pool).query(sql, parametros);
  }

  async transaccion(trabajo) {
    const actual = this.#contexto.getStore();
    if (actual) return trabajo(actual);
    const cliente = await this.#pool.connect();
    try {
      await cliente.query('BEGIN');
      const resultado = await this.#contexto.run(cliente, () => trabajo(cliente));
      await cliente.query('COMMIT');
      return resultado;
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  /** INSERT ... RETURNING *; omite las columnas con valor undefined (identidades). */
  async insertar(tabla, fila, ejecutor) {
    const columnas = Object.keys(fila).filter((c) => fila[c] !== undefined);
    const sql = `INSERT INTO ${tabla} (${columnas.join(', ')}) VALUES (${columnas.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`;
    return (await this.consultar(sql, columnas.map((c) => fila[c]), ejecutor)).rows[0];
  }

  /** UPDATE ... RETURNING * por clave. */
  async actualizar(tabla, fila, claves, ejecutor) {
    const columnas = Object.keys(fila).filter((c) => !claves.includes(c) && fila[c] !== undefined);
    if (columnas.length === 0) return fila;
    const asignaciones = columnas.map((c, i) => `${c} = $${i + 1}`).join(', ');
    const condicion = claves.map((c, i) => `${c} = $${columnas.length + i + 1}`).join(' AND ');
    const parametros = [...columnas.map((c) => fila[c]), ...claves.map((c) => fila[c])];
    return (await this.consultar(`UPDATE ${tabla} SET ${asignaciones} WHERE ${condicion} RETURNING *`, parametros, ejecutor)).rows[0];
  }

  cerrar() {
    return this.#pool.end();
  }
}
