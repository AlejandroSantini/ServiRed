import { GestorTransacciones } from '../contratos/GestorTransacciones.js';

function esRango(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor) && !(valor instanceof Date) && ('desde' in valor || 'hasta' in valor);
}

function cumple(fila, filtro) {
  return Object.entries(filtro).every(([columna, valor]) => {
    const actual = fila[columna];
    if (valor === null) return actual === null || actual === undefined;
    if (Array.isArray(valor)) return valor.includes(actual);
    if (esRango(valor)) {
      return (valor.desde === undefined || valor.desde === null || actual >= valor.desde)
        && (valor.hasta === undefined || valor.hasta === null || actual <= valor.hasta);
    }
    return actual === valor;
  });
}

function ordenar(filas, orden = []) {
  if (!orden.length) return filas;
  return filas.sort((a, b) => {
    for (const [columna, direccion = 'asc'] of orden) {
      if (a[columna] === b[columna]) continue;
      const resultado = a[columna] < b[columna] ? -1 : 1;
      return direccion === 'desc' ? -resultado : resultado;
    }
    return 0;
  });
}

/** Implementación en memoria de las operaciones de filas de RepositorioDeFilas. */
export const conFilasMemoria = (Contrato) => class extends Contrato {
  #bd;

  constructor({ bd, ...dependencias } = {}) {
    super(dependencias);
    this.#bd = bd;
  }

  async _filas(tabla, filtro = {}, { orden } = {}) {
    return ordenar(this.#bd.seleccionar(tabla, (f) => cumple(f, filtro)), orden);
  }

  async _insertar(tabla, fila, columnaId = null) {
    const nueva = Object.fromEntries(Object.entries(fila).map(([c, v]) => [c, v === undefined ? null : v]));
    if (columnaId && (nueva[columnaId] === null || nueva[columnaId] === undefined)) nueva[columnaId] = this.#bd.siguienteId(tabla);
    this.#bd.insertar(tabla, nueva);
    return structuredClone(nueva);
  }

  async _actualizar(tabla, fila, claves) {
    const guardada = this.#bd.tabla(tabla).find((f) => claves.every((c) => f[c] === fila[c]));
    if (!guardada) throw new Error(`No existe la fila a actualizar en ${tabla}.`);
    Object.assign(guardada, structuredClone(fila));
    return structuredClone(guardada);
  }

  async _eliminar(tabla, filtro) {
    this.#bd.reemplazar(tabla, (f) => cumple(f, filtro), []);
  }
};

export class GestorTransaccionesMemoria extends GestorTransacciones {
  #bd;

  constructor({ bd }) {
    super();
    this.#bd = bd;
  }

  ejecutar(trabajo) {
    return this.#bd.transaccion(trabajo);
  }
}
