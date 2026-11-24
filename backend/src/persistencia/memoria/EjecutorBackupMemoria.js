import { EjecutorBackup, nombreBackup } from '../contratos/EjecutorBackup.js';

/** Backup en memoria: guarda una copia completa de todas las tablas. */
export class EjecutorBackupMemoria extends EjecutorBackup {
  #bd;
  #copias = new Map();

  constructor({ bd }) {
    super();
    this.#bd = bd;
  }

  async respaldar(fecha) {
    const nombre = nombreBackup(fecha);
    this.#copias.set(nombre, { fecha, datos: this.#bd.instantanea() });
    return { nombre, fecha };
  }

  async listar() {
    return [...this.#copias].map(([nombre, { fecha }]) => ({ nombre, fecha, tamanio: null }))
      .sort((a, b) => b.fecha - a.fecha);
  }

  async existe(nombre) {
    return this.#copias.has(nombre);
  }

  async restaurar(nombre) {
    this.#bd.restaurar(this.#copias.get(nombre).datos);
  }
}
