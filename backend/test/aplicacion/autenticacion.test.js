import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, datosCliente, loginAdmin, usuarioDeSesion, ADMIN } from '../ayudantes.js';
import { NoAutenticadoError, ReglaNegocioError, IntegridadComprometidaError } from '../../src/dominio/errores.js';

const regla = (Tipo, codigo) => (e) => e instanceof Tipo && e.codigo === codigo;

test('RF02: el cliente se registra, inicia sesión y la sesión es válida', async () => {
  const entorno = await crearEntorno();
  const { autenticacion, usuarios } = entorno.servicios;
  const cliente = await usuarios.registrarCliente(datosCliente(entorno));
  assert.equal(cliente.rol, 'cliente');
  assert.ok(cliente.tienePermiso('SOLICITUD_CREAR'));
  assert.ok(!cliente.tienePermiso('BITACORA_VER'));

  const resultado = await autenticacion.iniciarSesion({ email: 'CARLA@correo.test', contrasena: 'Segura123' });
  assert.ok(resultado.token);
  assert.equal(resultado.usuario.email, 'carla@correo.test');
  assert.equal(resultado.usuario.telefono, '341 555-1234');
  assert.equal((await usuarioDeSesion(entorno, resultado.token)).id, cliente.id);
});

test('RNF03/RN-S10: en la base la contraseña queda con hash y el teléfono cifrado', async () => {
  const entorno = await crearEntorno();
  await entorno.servicios.usuarios.registrarCliente(datosCliente(entorno));
  const fila = entorno.repositorios.bd.tabla('usuario').find((f) => f.email === 'carla@correo.test');
  assert.match(fila.hash_contrasena, /^scrypt\$/);
  assert.ok(!JSON.stringify(fila).includes('Segura123'));
  assert.ok(!fila.telefono_cifrado.includes('555'));
});

test('RN-S04: mismo mensaje si el correo no existe o la contraseña es incorrecta', async () => {
  const entorno = await crearEntorno();
  const { autenticacion } = entorno.servicios;
  const e1 = await autenticacion.iniciarSesion({ email: 'nadie@correo.test', contrasena: 'Algo12345' }).catch((e) => e);
  const e2 = await autenticacion.iniciarSesion({ email: ADMIN.email, contrasena: 'Incorrecta1' }).catch((e) => e);
  assert.ok(e1 instanceof NoAutenticadoError);
  assert.ok(e2 instanceof NoAutenticadoError);
  assert.equal(e1.message, e2.message);
});

test('RN-S03: tres intentos fallidos bloquean la cuenta; el administrador la desbloquea', async () => {
  const entorno = await crearEntorno();
  const { autenticacion, usuarios } = entorno.servicios;
  const cliente = await usuarios.registrarCliente(datosCliente(entorno));
  for (let i = 0; i < 3; i += 1) {
    await assert.rejects(autenticacion.iniciarSesion({ email: cliente.email, contrasena: 'Equivocada1' }), NoAutenticadoError);
  }
  // Con la contraseña correcta recién se informa el bloqueo.
  await assert.rejects(autenticacion.iniciarSesion({ email: cliente.email, contrasena: 'Segura123' }), regla(ReglaNegocioError, 'RN-S03'));

  const admin = await usuarioDeSesion(entorno, (await loginAdmin(entorno)).token);
  await usuarios.desbloquear(cliente.id, admin);
  const resultado = await autenticacion.iniciarSesion({ email: cliente.email, contrasena: 'Segura123' });
  assert.ok(resultado.token);

  const eventos = (await entorno.servicios.bitacora.consultar({ tamanio: 100 })).items.map((e) => e.evento);
  assert.ok(eventos.includes('Cuenta bloqueada'));
  assert.ok(eventos.includes('Desbloqueo de usuario'));
});

test('RN-S05: el logout invalida la sesión y el token vence a la hora', async () => {
  const entorno = await crearEntorno();
  const { autenticacion } = entorno.servicios;

  const primera = await loginAdmin(entorno);
  const { usuario, sesion } = await autenticacion.validarSesion(primera.token);
  await autenticacion.cerrarSesion(sesion, usuario);
  await assert.rejects(autenticacion.validarSesion(primera.token), regla(NoAutenticadoError, 'RN-S05'));

  const segunda = await loginAdmin(entorno);
  entorno.reloj.avanzar(60 * 60_000 + 1);
  await assert.rejects(autenticacion.validarSesion(segunda.token), NoAutenticadoError);
});

test('RN-S12: cambiar la contraseña exige la actual y cierra todas las sesiones', async () => {
  const entorno = await crearEntorno();
  const { autenticacion } = entorno.servicios;
  const { token } = await loginAdmin(entorno);
  const otraSesion = (await loginAdmin(entorno)).token;
  const admin = await usuarioDeSesion(entorno, token);

  await assert.rejects(autenticacion.cambiarContrasena(admin, { actual: 'mal', nueva: 'NuevaClave9' }), regla(ReglaNegocioError, 'RN-S12'));
  await assert.rejects(autenticacion.cambiarContrasena(admin, { actual: ADMIN.contrasena, nueva: ADMIN.contrasena }), regla(ReglaNegocioError, 'RN-S12'));
  await assert.rejects(autenticacion.cambiarContrasena(admin, { actual: ADMIN.contrasena, nueva: 'corta' }), regla(ReglaNegocioError, 'RN-S01'));

  await autenticacion.cambiarContrasena(admin, { actual: ADMIN.contrasena, nueva: 'NuevaClave9' });
  await assert.rejects(autenticacion.validarSesion(token), NoAutenticadoError);
  await assert.rejects(autenticacion.validarSesion(otraSesion), NoAutenticadoError);
  assert.ok((await autenticacion.iniciarSesion({ email: ADMIN.email, contrasena: 'NuevaClave9' })).token);
});

test('RN-S09: si alguien modifica la base a mano, solo ingresa quien puede gestionar la integridad', async () => {
  const entorno = await crearEntorno();
  const { autenticacion, usuarios, integridad } = entorno.servicios;
  const cliente = await usuarios.registrarCliente(datosCliente(entorno));
  assert.equal((await integridad.verificar()).integra, true);

  // Alteración externa: alguien desbloquea una cuenta o resetea los intentos directo en la tabla.
  entorno.repositorios.bd.tabla('usuario').find((f) => f.id_usuario === cliente.id).intentos_fallidos = 2;

  const resultado = await integridad.verificar();
  assert.equal(resultado.integra, false);
  assert.deepEqual(resultado.inconsistencias, [{ tabla: 'usuario', tipo: 'DVH', fila: { id_usuario: cliente.id } }]);

  await assert.rejects(autenticacion.iniciarSesion({ email: cliente.email, contrasena: 'Segura123' }), regla(IntegridadComprometidaError, 'RN-S09'));
  const sesionAdmin = await loginAdmin(entorno);
  assert.equal(sesionAdmin.integridad.integra, false, 'el administrador entra y ve el problema');

  const admin = await usuarioDeSesion(entorno, sesionAdmin.token);
  assert.equal((await integridad.recalcular(admin)).integra, true);
  assert.ok((await autenticacion.iniciarSesion({ email: cliente.email, contrasena: 'Segura123' })).token);
});

test('RN-S09: borrar una fila de la bitácora se detecta por el DVV y no se "tapa" con escrituras nuevas', async () => {
  const entorno = await crearEntorno();
  const { integridad } = entorno.servicios;
  await loginAdmin(entorno);
  entorno.repositorios.bd.tabla('bitacora').splice(0, 1);

  assert.deepEqual((await integridad.verificar()).inconsistencias, [{ tabla: 'bitacora', tipo: 'DVV' }]);
  await loginAdmin(entorno); // genera nuevas entradas de bitácora
  assert.equal((await integridad.verificar()).integra, false);
});

test('RN-S09: inyectar un permiso en una familia (escalar privilegios) también se detecta', async () => {
  const entorno = await crearEntorno();
  const { bd } = entorno.repositorios;
  const id = (codigo) => bd.tabla('permiso').find((f) => f.codigo === codigo).id_permiso;
  bd.tabla('permiso_hijo').push({ id_padre: id('FAM_CLIENTE'), id_hijo: id('FAM_SEGURIDAD'), dvh: 'falso' });
  const { inconsistencias } = await entorno.servicios.integridad.verificar();
  assert.ok(inconsistencias.some((i) => i.tabla === 'permiso_hijo' && i.tipo === 'DVH'));
  assert.ok(inconsistencias.some((i) => i.tabla === 'permiso_hijo' && i.tipo === 'DVV'));
});
