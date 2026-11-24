import { noImplementado } from './noImplementado.js';

/**
 * Base de los contratos de repositorio de las Iteraciones 2 a 8.
 *
 * El contrato (clase base) contiene la lógica de cada repositorio: qué filas
 * leer, cómo reconstruir la entidad y cómo guardarla. Las implementaciones
 * (memoria y PostgreSQL) solo aportan estas cuatro operaciones sobre filas
 * (ver conFilasMemoria y conFilasPostgres), así las dos se comportan igual.
 *
 * Filtro: { columna: valor } → igualdad; valor arreglo → "está en"; null → es nulo;
 *         { desde, hasta } → rango inclusivo.
 */
export class RepositorioDeFilas {
  async _filas(_tabla, _filtro = {}, _opciones = {}) { throw noImplementado(this.constructor.name, '_filas'); }

  /** Inserta y devuelve la fila guardada; si se indica columnaId y viene vacía, la genera. */
  async _insertar(_tabla, _fila, _columnaId = null) { throw noImplementado(this.constructor.name, '_insertar'); }

  async _actualizar(_tabla, _fila, _claves) { throw noImplementado(this.constructor.name, '_actualizar'); }

  async _eliminar(_tabla, _filtro) { throw noImplementado(this.constructor.name, '_eliminar'); }

  async _primera(tabla, filtro) {
    return (await this._filas(tabla, filtro))[0] ?? null;
  }

  /** Inserta si la entidad no tiene id (y se lo asigna) o actualiza si ya lo tiene. */
  async _guardarEntidad(entidad, tabla, columnaId, fila) {
    if (entidad.id === null) {
      const guardada = await this._insertar(tabla, { ...fila, [columnaId]: null }, columnaId);
      entidad.asignarId(Number(guardada[columnaId]));
    } else {
      await this._actualizar(tabla, { ...fila, [columnaId]: entidad.id }, [columnaId]);
    }
    return entidad;
  }
}
