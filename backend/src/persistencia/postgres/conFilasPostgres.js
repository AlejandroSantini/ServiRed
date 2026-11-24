import { GestorTransacciones } from '../contratos/GestorTransacciones.js';

function esRango(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor) && !(valor instanceof Date) && ('desde' in valor || 'hasta' in valor);
}

/** Arma el WHERE con parámetros. Las columnas salen del código, nunca del usuario. */
function construirDonde(filtro) {
  const condiciones = [];
  const parametros = [];
  const parametro = (valor) => {
    parametros.push(valor);
    return `$${parametros.length}`;
  };
  for (const [columna, valor] of Object.entries(filtro)) {
    if (valor === null) condiciones.push(`${columna} IS NULL`);
    else if (Array.isArray(valor)) condiciones.push(`${columna} = ANY(${parametro(valor)})`);
    else if (esRango(valor)) {
      if (valor.desde !== undefined && valor.desde !== null) condiciones.push(`${columna} >= ${parametro(valor.desde)}`);
      if (valor.hasta !== undefined && valor.hasta !== null) condiciones.push(`${columna} <= ${parametro(valor.hasta)}`);
    } else condiciones.push(`${columna} = ${parametro(valor)}`);
  }
  return { donde: condiciones.length ? ` WHERE ${condiciones.join(' AND ')}` : '', parametros };
}

/** Implementación PostgreSQL de las operaciones de filas de RepositorioDeFilas. */
export const conFilasPostgres = (Contrato) => class extends Contrato {
  #bd;

  constructor({ bd, ...dependencias } = {}) {
    super(dependencias);
    this.#bd = bd;
  }

  /** Para consultas propias de PostgreSQL en las subclases (por ejemplo, la búsqueda). */
  get _bd() { return this.#bd; }

  async _filas(tabla, filtro = {}, { orden = [] } = {}) {
    const { donde, parametros } = construirDonde(filtro);
    const ordenSql = orden.length
      ? ` ORDER BY ${orden.map(([c, d = 'asc']) => `${c} ${d === 'desc' ? 'DESC' : 'ASC'}`).join(', ')}` : '';
    return (await this.#bd.consultar(`SELECT * FROM ${tabla}${donde}${ordenSql}`, parametros)).rows;
  }

  async _insertar(tabla, fila, columnaId = null) {
    const datos = { ...fila };
    if (columnaId && (datos[columnaId] === null || datos[columnaId] === undefined)) delete datos[columnaId];
    return this.#bd.insertar(tabla, datos);
  }

  async _actualizar(tabla, fila, claves) {
    return this.#bd.actualizar(tabla, fila, claves);
  }

  async _eliminar(tabla, filtro) {
    const { donde, parametros } = construirDonde(filtro);
    if (!donde) throw new Error('No se permite un DELETE sin filtro.');
    await this.#bd.consultar(`DELETE FROM ${tabla}${donde}`, parametros);
  }
};

export class GestorTransaccionesPostgres extends GestorTransacciones {
  #bd;

  constructor({ bd }) {
    super();
    this.#bd = bd;
  }

  ejecutar(trabajo) {
    return this.#bd.transaccion(() => trabajo());
  }
}
