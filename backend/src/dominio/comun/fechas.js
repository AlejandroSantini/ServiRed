import { ReglaNegocioError } from '../errores.js';

/** Rosario: las fechas de calendario (fecha preferida, programada, validez) se evalúan en hora argentina. */
export const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';
export const HORA = 3_600_000;
export const DIA = 24 * HORA;

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const formateador = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Fecha de calendario local (AAAA-MM-DD) de un instante. */
export function fechaLocal(instante) {
  return formateador.format(instante);
}

/** Valida una fecha de calendario AAAA-MM-DD. */
export function validarFecha(valor, campo) {
  if (typeof valor !== 'string' || !FORMATO_FECHA.test(valor)
    || Number.isNaN(Date.parse(`${valor}T00:00:00Z`))
    || new Date(`${valor}T00:00:00Z`).toISOString().slice(0, 10) !== valor) {
    throw new ReglaNegocioError(`El campo ${campo} debe ser una fecha válida (AAAA-MM-DD).`, 'DATOS');
  }
  return valor;
}

export function sumar(instante, milisegundos) {
  return new Date(instante.getTime() + milisegundos);
}

/** Lo que devuelve la base para una columna date (texto o Date) → AAAA-MM-DD. */
export function normalizarFecha(valor) {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return String(valor).slice(0, 10);
}

export function aFechaOpcional(valor) {
  return valor ? new Date(valor) : null;
}
