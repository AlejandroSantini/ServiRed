const ZONA = 'America/Argentina/Buenos_Aires';

const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });
const fechaHora = new Intl.DateTimeFormat('es-AR', { timeZone: ZONA, dateStyle: 'medium', timeStyle: 'short' });
const fechaCorta = new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });

export const formatoPesos = (monto) => (monto === null || monto === undefined ? '—' : pesos.format(monto));
export const formatoFechaHora = (iso) => (iso ? fechaHora.format(new Date(iso)) : '—');
/** Fechas de calendario AAAA-MM-DD (sin hora). */
export const formatoFecha = (dia) => (dia ? fechaCorta.format(new Date(`${dia}T12:00:00Z`)) : '—');
export const formatoPorcentaje = (tasa) => (tasa === null || tasa === undefined ? '—' : `${Math.round(tasa * 1000) / 10} %`);

/** Fecha local de hoy (AAAA-MM-DD) para los mínimos de los campos de fecha. */
export function hoy() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date());
}

export function sumarDias(dia, cantidad) {
  const fecha = new Date(`${dia}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + cantidad);
  return fecha.toISOString().slice(0, 10);
}

export const nombreCompleto = (u) => (u ? `${u.nombre} ${u.apellido ?? ''}`.trim() : '');
