import { randomBytes } from 'node:crypto';

function leerClave(env, nombre, esProduccion) {
  const valor = env[nombre];
  if (valor) {
    const clave = Buffer.from(valor, 'base64');
    if (clave.length < 32) throw new Error(`${nombre} debe tener al menos 32 bytes codificados en base64.`);
    return clave;
  }
  if (esProduccion) throw new Error(`Falta la variable de entorno ${nombre}.`);
  if (env.PERSISTENCIA === 'postgres') {
    console.warn(`[config] ${nombre} no está definida: se usa una clave temporal. Los datos cifrados y los dígitos `
      + 'verificadores dejarán de ser válidos al reiniciar. Definila en .env.');
  }
  return randomBytes(32);
}

export function cargarConfiguracion(env = process.env) {
  const entorno = env.NODE_ENV ?? 'development';
  const esProduccion = entorno === 'production';
  const persistencia = env.PERSISTENCIA ?? 'memoria';
  if (!['memoria', 'postgres'].includes(persistencia)) throw new Error('PERSISTENCIA debe ser "memoria" o "postgres".');
  if (persistencia === 'postgres' && !env.DATABASE_URL) throw new Error('Falta DATABASE_URL.');

  return Object.freeze({
    entorno,
    esProduccion,
    puerto: Number(env.PUERTO ?? 3000),
    persistencia,
    urlBaseDatos: env.DATABASE_URL ?? null,
    origenFrontend: env.ORIGEN_FRONTEND ?? 'http://localhost:5173',
    tls: { certificado: env.TLS_CERT ?? null, clave: env.TLS_KEY ?? null },
    detrasDeProxyHttps: env.DETRAS_DE_PROXY_HTTPS === 'true',
    claves: Object.freeze({
      token: leerClave(env, 'CLAVE_TOKEN', esProduccion),
      cifrado: leerClave(env, 'CLAVE_CIFRADO', esProduccion),
      integridad: leerClave(env, 'CLAVE_INTEGRIDAD', esProduccion),
    }),
    duracionSesionMs: Number(env.SESION_MINUTOS ?? 60) * 60_000,
    backups: Object.freeze({
      directorio: env.DIRECTORIO_BACKUPS ?? './backups',
      pgDump: env.PG_DUMP ?? 'pg_dump',
      pgRestore: env.PG_RESTORE ?? 'pg_restore',
    }),
    administradorInicial: env.ADMIN_EMAIL
      ? { email: env.ADMIN_EMAIL, contrasena: env.ADMIN_CONTRASENA, nombre: env.ADMIN_NOMBRE ?? 'Administrador', apellido: env.ADMIN_APELLIDO ?? 'ServiRed' }
      : null,
  });
}
