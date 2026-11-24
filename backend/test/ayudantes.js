import { randomBytes } from 'node:crypto';
import { crearContenedor } from '../src/contenedor.js';
import { HashContrasena } from '../src/transversal/HashContrasena.js';
import { ZONAS_INICIALES, CATEGORIAS_INICIALES, TASA_GENERAL_INICIAL } from '../src/datosIniciales.js';
import { aplicarEsquema } from '../src/persistencia/postgres/esquema.js';

export const ADMIN = Object.freeze({ email: 'admin@servired.test', contrasena: 'Clave2026x', nombre: 'Ada', apellido: 'Admin' });

/** Reloj que las pruebas pueden adelantar. */
export function crearRelojFalso(inicio = new Date('2026-11-23T12:00:00.000Z')) {
  let actual = inicio.getTime();
  return {
    ahora: () => new Date(actual),
    avanzar: (ms) => { actual += ms; },
  };
}

export function configuracionDePrueba(cambios = {}) {
  return {
    entorno: 'test',
    esProduccion: false,
    persistencia: 'memoria',
    origenFrontend: 'http://localhost:5173',
    tls: { certificado: null, clave: null },
    detrasDeProxyHttps: false,
    claves: { token: randomBytes(32), cifrado: randomBytes(32), integridad: randomBytes(32) },
    duracionSesionMs: 60 * 60_000,
    backups: {},
    ...cambios,
  };
}

/** PostgreSQL real embebido (PGlite) con el esquema de db/ aplicado, presentado como un pool de pg. */
async function crearPoolPGlite() {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite({ parsers: { 1082: (v) => v } });
  await aplicarEsquema((sql) => db.exec(sql));
  const consultar = (sql, parametros = []) => db.query(sql, parametros);
  return { db, pool: { query: consultar, connect: async () => ({ query: consultar, release() {} }), end: () => db.close() } };
}

/**
 * Contenedor con permisos, catálogos, comisión general (10 %) y un administrador cargados.
 * postgres: true → usa los repositorios PostgreSQL sobre PGlite en lugar de memoria.
 */
export async function crearEntorno({ reloj = crearRelojFalso(), config = configuracionDePrueba(), postgres = false } = {}) {
  let pool;
  let db = null;
  if (postgres) {
    ({ db, pool } = await crearPoolPGlite());
    config = { ...config, persistencia: 'postgres', urlBaseDatos: 'pglite://memoria' };
  }
  // Costo bajo de scrypt para que las pruebas sean rápidas.
  const contenedor = await crearContenedor(config, { reloj, hasher: new HashContrasena({ costo: 2 ** 10 }), pool });
  await contenedor.servicios.inicializacion.inicializar({
    zonas: ZONAS_INICIALES, categorias: CATEGORIAS_INICIALES, tasaGeneral: TASA_GENERAL_INICIAL, administrador: ADMIN,
  });
  const zonas = await contenedor.repositorios.catalogoRepositorio.listarZonas();
  const categorias = await contenedor.repositorios.catalogoRepositorio.listarCategorias();
  return { ...contenedor, reloj, zonas, categorias, db };
}

/** Un cliente en zonas[0] y dos prestadores de categorias[0] que cubren zonas[0]. */
export async function prepararContratacion(entorno) {
  const { usuarios } = entorno.servicios;
  const cliente = await usuarios.registrarCliente(datosCliente(entorno));
  const p1 = await usuarios.registrarPrestador(datosPrestador(entorno));
  const p2 = await usuarios.registrarPrestador(datosPrestador(entorno, {
    nombre: 'Pablo', apellido: 'Paredes', email: 'pablo@correo.test', contrasena: 'Ladrillo2026', idsZonas: [entorno.zonas[0].id],
  }));
  const admin = await entorno.repositorios.usuarioRepositorio.obtenerPorEmail(ADMIN.email);
  return { cliente, p1, p2, admin };
}

export function datosSolicitud(entorno, idsPrestadores, cambios = {}) {
  return {
    idCategoria: entorno.categorias[0].id,
    idZona: entorno.zonas[0].id,
    idTurnoPreferido: 1,
    descripcion: 'Pérdida de agua debajo de la mesada de la cocina',
    direccion: 'Bv. Oroño 1234, piso 3',
    fechaPreferida: '2026-11-25',
    idsPrestadores,
    ...cambios,
  };
}

export const HORA = 3_600_000;
export const DIA = 24 * HORA;

/** Recarga el usuario (por ejemplo, para ver la reputación actualizada). */
export function recargar(entorno, usuario) {
  return entorno.repositorios.usuarioRepositorio.obtenerPorId(usuario.id);
}

export function datosCliente(entorno, cambios = {}) {
  return {
    nombre: 'Carla', apellido: 'Cliente', email: 'carla@correo.test', contrasena: 'Segura123',
    telefono: '341 555-1234', idZona: entorno.zonas[0].id, ...cambios,
  };
}

export function datosPrestador(entorno, cambios = {}) {
  return {
    nombre: 'Pedro', apellido: 'Plomero', email: 'pedro@correo.test', contrasena: 'Tuberia2026',
    idsZonas: [entorno.zonas[0].id, entorno.zonas[1].id], idsCategorias: [entorno.categorias[0].id],
    tarifaBase: 15000, descripcion: 'Plomero matriculado con 10 años de experiencia', disponibilidad: 'Lunes a viernes de 8 a 17',
    ...cambios,
  };
}

export async function loginAdmin(entorno) {
  return entorno.servicios.autenticacion.iniciarSesion({ email: ADMIN.email, contrasena: ADMIN.contrasena });
}

export async function usuarioDeSesion(entorno, token) {
  return (await entorno.servicios.autenticacion.validarSesion(token)).usuario;
}
