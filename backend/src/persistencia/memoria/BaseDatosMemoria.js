/**
 * "Base de datos" en memoria: guarda filas con las mismas columnas que PostgreSQL.
 * Sirve para probar las reglas sin base real y para desarrollar sin instalar nada.
 */
export class BaseDatosMemoria {
  #tablas = new Map();
  #secuencias = new Map();

  /** Devuelve el arreglo vivo de filas (las pruebas lo usan para simular una alteración externa). */
  tabla(nombre) {
    if (!this.#tablas.has(nombre)) this.#tablas.set(nombre, []);
    return this.#tablas.get(nombre);
  }

  seleccionar(nombre, predicado = () => true) {
    return this.tabla(nombre).filter(predicado).map((f) => structuredClone(f));
  }

  reemplazar(nombre, predicado, filasNuevas) {
    const restantes = this.tabla(nombre).filter((f) => !predicado(f));
    restantes.push(...filasNuevas.map((f) => structuredClone(f)));
    this.#tablas.set(nombre, restantes);
  }

  insertar(nombre, fila) {
    this.tabla(nombre).push(structuredClone(fila));
  }

  siguienteId(nombre) {
    const siguiente = (this.#secuencias.get(nombre) ?? 0) + 1;
    this.#secuencias.set(nombre, siguiente);
    return siguiente;
  }

  #enTransaccion = false;

  /** Si el trabajo falla, se vuelve al estado previo (equivale a ROLLBACK). */
  async transaccion(trabajo) {
    if (this.#enTransaccion) return trabajo();
    const copia = this.instantanea();
    this.#enTransaccion = true;
    try {
      return await trabajo();
    } catch (error) {
      this.restaurar(copia);
      throw error;
    } finally {
      this.#enTransaccion = false;
    }
  }

  instantanea() {
    return structuredClone({ tablas: [...this.#tablas], secuencias: [...this.#secuencias] });
  }

  restaurar(instantanea) {
    const copia = structuredClone(instantanea);
    this.#tablas = new Map(copia.tablas);
    this.#secuencias = new Map(copia.secuencias);
  }
}
