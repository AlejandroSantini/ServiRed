import { NoEncontradoError, ReglaNegocioError } from '../dominio/errores.js';
import { Criticidad } from '../dominio/seguridad/Criticidad.js';
import { FORMATO_NOMBRE_BACKUP } from '../persistencia/contratos/EjecutorBackup.js';

const MODULO = 'Backup';

/** RN-S11: respaldo y restauración de la base, con registro en la bitácora. */
export class BackupService {
  #ejecutor;
  #bitacora;
  #integridad;
  #reloj;

  constructor({ ejecutorBackup, bitacora, integridad, reloj }) {
    this.#ejecutor = ejecutorBackup;
    this.#bitacora = bitacora;
    this.#integridad = integridad;
    this.#reloj = reloj;
  }

  async listar() {
    return (await this.#ejecutor.listar()).map((b) => ({ ...b, fecha: b.fecha.toISOString() }));
  }

  async realizar(actor, { ip = null } = {}) {
    const respaldo = await this.#ejecutor.respaldar(this.#reloj.ahora());
    await this.#bitacora.registrar({ usuario: actor, modulo: MODULO, evento: 'Backup realizado', descripcion: respaldo.nombre, criticidad: Criticidad.ALTA, ip });
    return { nombre: respaldo.nombre, fecha: respaldo.fecha.toISOString() };
  }

  async restaurar(nombre, actor, { ip = null } = {}) {
    // El nombre se valida contra un formato fijo: evita leer archivos fuera de la carpeta de backups.
    if (typeof nombre !== 'string' || !FORMATO_NOMBRE_BACKUP.test(nombre)) {
      throw new ReglaNegocioError('El nombre del backup no es válido.', 'RN-S11');
    }
    if (!(await this.#ejecutor.existe(nombre))) throw new NoEncontradoError('El backup no existe.');
    await this.#ejecutor.restaurar(nombre);
    // La bitácora restaurada es la del backup: se registra la restauración sobre ella.
    await this.#bitacora.registrar({ usuario: actor, modulo: MODULO, evento: 'Backup restaurado', descripcion: nombre, criticidad: Criticidad.ALTA, ip });
    return { nombre, integridad: await this.#integridad.verificar() };
  }
}
