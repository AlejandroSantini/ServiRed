import { readdir, readFile } from 'node:fs/promises';

const DIRECTORIO = new URL('../../../db/', import.meta.url);

/** Scripts SQL del esquema, uno por iteración, en orden (01_..., 02_...). */
export async function leerScriptsEsquema() {
  const archivos = (await readdir(DIRECTORIO)).filter((n) => /^\d{2}_.*\.sql$/.test(n)).sort();
  return Promise.all(archivos.map(async (nombre) => ({ nombre, sql: await readFile(new URL(nombre, DIRECTORIO), 'utf8') })));
}

/** @param ejecutarSql  función que ejecuta un script con varias sentencias */
export async function aplicarEsquema(ejecutarSql) {
  const scripts = await leerScriptsEsquema();
  for (const { sql } of scripts) await ejecutarSql(sql);
  return scripts.map((s) => s.nombre);
}
