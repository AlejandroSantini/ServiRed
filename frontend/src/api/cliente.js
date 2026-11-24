/**
 * Único punto de acceso a la API REST. Las pantallas no usan fetch directamente.
 *
 * El token de sesión se guarda en sessionStorage: sobrevive a recargar la página
 * y se borra al cerrar la pestaña. React escapa todo el texto que muestra, lo que
 * reduce el riesgo de XSS; igual el backend invalida la sesión al cerrar sesión (RN-S05).
 */
const CLAVE_TOKEN = 'servired.token';

let token = leerToken();
let alExpirarSesion = () => {};

function leerToken() {
  try {
    return sessionStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

export function hayToken() {
  return Boolean(token);
}

export function guardarToken(nuevo) {
  token = nuevo;
  try {
    if (nuevo) sessionStorage.setItem(CLAVE_TOKEN, nuevo);
    else sessionStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // Sin almacenamiento disponible: la sesión dura lo que la pestaña abierta.
  }
}

export function alVencerSesion(funcion) {
  alExpirarSesion = funcion;
}

/** Error de la API con el código HTTP y la regla de negocio que no se cumplió (RN-C02, RN-S03...). */
export class ErrorApi extends Error {
  constructor(mensaje, estado, regla) {
    super(mensaje);
    this.estado = estado;
    this.regla = regla ?? null;
  }
}

export async function api(ruta, { metodo = 'GET', cuerpo, consulta } = {}) {
  const url = new URL(`/api${ruta}`, window.location.origin);
  for (const [clave, valor] of Object.entries(consulta ?? {})) {
    if (valor !== undefined && valor !== null && valor !== '') url.searchParams.set(clave, valor);
  }
  let respuesta;
  try {
    respuesta = await fetch(url, {
      method: metodo,
      headers: {
        ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorApi('No hay conexión con el servidor. Revisá que el backend esté funcionando.', 0);
  }
  if (respuesta.status === 204) return null;
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    if (respuesta.status === 401 && token) {
      guardarToken(null);
      alExpirarSesion();
    }
    throw new ErrorApi(datos?.error ?? `El servidor respondió ${respuesta.status}.`, respuesta.status, datos?.regla);
  }
  return datos;
}
