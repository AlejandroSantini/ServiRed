import { noImplementado } from './noImplementado.js';

export const FORMATO_NOMBRE_BACKUP = /^servired_\d{8}_\d{6}_\d{3}\.backup$/;

export function nombreBackup(fecha) {
  const d = (n, largo = 2) => String(n).padStart(largo, '0');
  return `servired_${fecha.getUTCFullYear()}${d(fecha.getUTCMonth() + 1)}${d(fecha.getUTCDate())}_`
    + `${d(fecha.getUTCHours())}${d(fecha.getUTCMinutes())}${d(fecha.getUTCSeconds())}_${d(fecha.getUTCMilliseconds(), 3)}.backup`;
}

/** Contrato del respaldo y restauración de la base (RN-S11). */
export class EjecutorBackup {
  /** @returns {Promise<{nombre:string, fecha:Date}>} */
  async respaldar(_fecha) { throw noImplementado('EjecutorBackup', 'respaldar'); }

  /** @returns {Promise<Array<{nombre:string, fecha:Date, tamanio:number}>>} */
  async listar() { throw noImplementado('EjecutorBackup', 'listar'); }

  async existe(_nombre) { throw noImplementado('EjecutorBackup', 'existe'); }

  async restaurar(_nombre) { throw noImplementado('EjecutorBackup', 'restaurar'); }
}
