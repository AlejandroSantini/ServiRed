import { spawn } from 'node:child_process';
import { mkdir, readdir, stat, access } from 'node:fs/promises';
import path from 'node:path';
import { EjecutorBackup, nombreBackup, FORMATO_NOMBRE_BACKUP } from '../contratos/EjecutorBackup.js';

/**
 * Backup con pg_dump (formato custom) y restauración con pg_restore.
 * Se ejecutan con spawn y una lista de argumentos (sin shell): ningún dato
 * del usuario puede inyectar comandos. Requiere las herramientas cliente de PostgreSQL.
 */
export class EjecutorBackupPostgres extends EjecutorBackup {
  #url;
  #directorio;
  #pgDump;
  #pgRestore;

  constructor({ urlBaseDatos, directorio = './backups', pgDump = 'pg_dump', pgRestore = 'pg_restore' }) {
    super();
    this.#url = urlBaseDatos;
    this.#directorio = path.resolve(directorio);
    this.#pgDump = pgDump;
    this.#pgRestore = pgRestore;
  }

  async respaldar(fecha) {
    await mkdir(this.#directorio, { recursive: true });
    const nombre = nombreBackup(fecha);
    await this.#ejecutar(this.#pgDump, ['--format=custom', '--no-owner', `--file=${this.#ruta(nombre)}`, `--dbname=${this.#url}`]);
    return { nombre, fecha };
  }

  async listar() {
    await mkdir(this.#directorio, { recursive: true });
    const nombres = (await readdir(this.#directorio)).filter((n) => FORMATO_NOMBRE_BACKUP.test(n));
    const lista = await Promise.all(nombres.map(async (nombre) => {
      const info = await stat(this.#ruta(nombre));
      return { nombre, fecha: info.mtime, tamanio: info.size };
    }));
    return lista.sort((a, b) => b.fecha - a.fecha);
  }

  async existe(nombre) {
    try {
      await access(this.#ruta(nombre));
      return true;
    } catch {
      return false;
    }
  }

  async restaurar(nombre) {
    await this.#ejecutar(this.#pgRestore, [
      '--clean', '--if-exists', '--no-owner', '--single-transaction', `--dbname=${this.#url}`, this.#ruta(nombre),
    ]);
  }

  #ruta(nombre) {
    if (!FORMATO_NOMBRE_BACKUP.test(nombre)) throw new Error('Nombre de backup inválido.');
    return path.join(this.#directorio, nombre);
  }

  #ejecutar(comando, argumentos) {
    return new Promise((resolver, rechazar) => {
      const proceso = spawn(comando, argumentos, { stdio: ['ignore', 'ignore', 'pipe'] });
      let errores = '';
      proceso.stderr.on('data', (d) => { errores += d; });
      proceso.on('error', (e) => rechazar(new Error(`No se pudo ejecutar ${comando}: ${e.message}`)));
      proceso.on('close', (codigo) => (codigo === 0 ? resolver() : rechazar(new Error(`${comando} terminó con código ${codigo}: ${errores.trim()}`))));
    });
  }
}
