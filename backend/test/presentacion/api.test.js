import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../../src/app.js';
import { crearEntorno, datosCliente, datosPrestador, ADMIN } from '../ayudantes.js';

let servidor;
let base;
let entorno;

before(async () => {
  entorno = await crearEntorno();
  servidor = crearApp(entorno).listen(0);
  await new Promise((r) => servidor.once('listening', r));
  base = `http://127.0.0.1:${servidor.address().port}/api`;
});

after(() => servidor.close());

async function pedir(metodo, ruta, { token, cuerpo } = {}) {
  const respuesta = await fetch(base + ruta, {
    method: metodo,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: cuerpo === undefined ? undefined : typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  });
  const texto = await respuesta.text();
  return { estado: respuesta.status, cuerpo: texto ? JSON.parse(texto) : null, cabeceras: respuesta.headers };
}

test('API: flujo de seguridad completo por HTTP', async () => {
  // Registro público y login
  const alta = await pedir('POST', '/usuarios/clientes', { cuerpo: datosCliente(entorno) });
  assert.equal(alta.estado, 201);
  assert.equal(alta.cuerpo.hashContrasena, undefined);
  assert.equal((await pedir('POST', '/usuarios/clientes', { cuerpo: datosCliente(entorno) })).estado, 409, 'RN-S02');

  const login = await pedir('POST', '/auth/login', { cuerpo: { email: 'carla@correo.test', contrasena: 'Segura123' } });
  assert.equal(login.estado, 200);
  assert.equal(login.cabeceras.get('x-powered-by'), null);
  assert.equal(login.cabeceras.get('x-content-type-options'), 'nosniff');
  const tokenCliente = login.cuerpo.token;

  // Sin sesión → 401; cliente sin patente → 403
  assert.equal((await pedir('GET', '/auth/yo')).estado, 401);
  assert.equal((await pedir('GET', '/auth/yo', { token: tokenCliente })).cuerpo.rol, 'cliente');
  assert.equal((await pedir('GET', '/seguridad/bitacora', { token: tokenCliente })).estado, 403);

  // Administrador
  const admin = await pedir('POST', '/auth/login', { cuerpo: { email: ADMIN.email, contrasena: ADMIN.contrasena } });
  const tokenAdmin = admin.cuerpo.token;
  const bitacora = await pedir('GET', '/seguridad/bitacora?idCriticidad=2', { token: tokenAdmin });
  assert.equal(bitacora.estado, 200);
  assert.ok(bitacora.cuerpo.items.some((e) => e.evento === 'Acceso denegado'), 'el 403 quedó registrado');
  assert.equal((await pedir('GET', '/seguridad/integridad', { token: tokenAdmin })).cuerpo.integra, true);

  // Asignar una patente al cliente habilita la ruta sin volver a loguearse
  const permiso = await pedir('POST', `/usuarios/${alta.cuerpo.id}/permisos`, { token: tokenAdmin, cuerpo: { codigo: 'BITACORA_VER' } });
  assert.equal(permiso.estado, 200);
  assert.equal((await pedir('GET', '/seguridad/bitacora', { token: tokenCliente })).estado, 200);

  // Logout
  assert.equal((await pedir('POST', '/auth/logout', { token: tokenCliente })).estado, 204);
  assert.equal((await pedir('GET', '/auth/yo', { token: tokenCliente })).estado, 401);
});

test('API: contratación por HTTP con las patentes de cada rol', async () => {
  const login = async (email, contrasena) => (await pedir('POST', '/auth/login', { cuerpo: { email, contrasena } })).cuerpo.token;
  await pedir('POST', '/usuarios/prestadores', { cuerpo: datosPrestador(entorno, { email: 'pp@correo.test' }) });
  await pedir('POST', '/usuarios/clientes', { cuerpo: datosCliente(entorno, { email: 'cc@correo.test' }) });
  const tCliente = await login('cc@correo.test', 'Segura123');
  const tPrestador = await login('pp@correo.test', 'Tuberia2026');
  const tAdmin = await login(ADMIN.email, ADMIN.contrasena);

  const busqueda = await pedir('GET', `/prestadores?idCategoria=${entorno.categorias[0].id}`, { token: tCliente });
  assert.equal(busqueda.estado, 200);
  const prestador = busqueda.cuerpo.items.find((p) => p.nombre === 'Pedro');

  const solicitud = await pedir('POST', '/solicitudes', {
    token: tCliente,
    cuerpo: {
      idCategoria: entorno.categorias[0].id, idZona: entorno.zonas[0].id, idTurnoPreferido: 2, descripcion: 'Canilla que gotea',
      direccion: 'Mitre 500', fechaPreferida: '2026-11-27', idsPrestadores: [prestador.id],
    },
  });
  assert.equal(solicitud.estado, 201);
  assert.equal((await pedir('POST', '/solicitudes', { token: tPrestador, cuerpo: {} })).estado, 403, 'el prestador no tiene SOLICITUD_CREAR');

  const presupuesto = await pedir('POST', `/solicitudes/${solicitud.cuerpo.id}/presupuestos`, {
    token: tPrestador, cuerpo: { montoEstimado: 8000, tiempoEstimadoHoras: 1, fechaValidez: '2026-11-29' },
  });
  assert.equal(presupuesto.estado, 201);
  assert.equal((await pedir('POST', `/presupuestos/${presupuesto.cuerpo.id}/aceptar`, { token: tPrestador })).estado, 403);
  const orden = await pedir('POST', `/presupuestos/${presupuesto.cuerpo.id}/aceptar`, { token: tCliente });
  assert.equal(orden.estado, 201);
  assert.equal(orden.cuerpo.estado, 'Programada');
  assert.equal((await pedir('POST', `/ordenes/${orden.cuerpo.id}/iniciar`, { token: tPrestador })).cuerpo.regla, 'RN-C08');

  assert.equal((await pedir('GET', '/agenda', { token: tPrestador })).cuerpo.ordenes.length, 1);
  assert.equal((await pedir('GET', '/notificaciones', { token: tPrestador })).cuerpo.noLeidas, 3, 'solicitud recibida, presupuesto aceptado y orden nueva');
  assert.equal((await pedir('GET', '/comisiones/balance', { token: tPrestador })).cuerpo.pendiente, 800);
  assert.equal((await pedir('GET', '/reportes/indicadores', { token: tPrestador })).estado, 403);
  assert.equal((await pedir('GET', '/reportes/indicadores', { token: tAdmin })).cuerpo.conversion.presupuestosAceptados, 1);
});

test('API: errores de formato no exponen detalles internos', async () => {
  const malformado = await pedir('POST', '/auth/login', { cuerpo: '{no es json' });
  assert.equal(malformado.estado, 400);
  assert.equal((await pedir('GET', '/no-existe')).estado, 404);
  const sinDatos = await pedir('POST', '/auth/login', { cuerpo: {} });
  assert.equal(sinDatos.estado, 401);
  assert.equal(sinDatos.cuerpo.regla, 'RN-S04');
});
