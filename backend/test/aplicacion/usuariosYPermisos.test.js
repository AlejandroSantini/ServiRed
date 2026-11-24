import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, datosCliente, datosPrestador, loginAdmin, usuarioDeSesion } from '../ayudantes.js';
import { ReglaNegocioError, NoAutenticadoError } from '../../src/dominio/errores.js';

const regla = (codigo) => (e) => e instanceof ReglaNegocioError && e.codigo === codigo;

async function entornoConAdmin() {
  const entorno = await crearEntorno();
  const sesion = await loginAdmin(entorno);
  return { entorno, admin: await usuarioDeSesion(entorno, sesion.token) };
}

test('RF01: el prestador se registra con zonas, categorías y tarifa; recibe la familia Prestador', async () => {
  const entorno = await crearEntorno();
  const prestador = await entorno.servicios.usuarios.registrarPrestador(datosPrestador(entorno));
  assert.equal(prestador.rol, 'prestador');
  assert.equal(prestador.zonas.length, 2);
  assert.ok(prestador.tienePermiso('PRESUPUESTO_EMITIR'));
  assert.ok(!prestador.tienePermiso('SOLICITUD_CREAR'));

  const recuperado = await entorno.repositorios.usuarioRepositorio.obtenerPorId(prestador.id);
  assert.equal(recuperado.tarifaBase, 15000);
  assert.deepEqual(recuperado.categorias.map((c) => c.id), [entorno.categorias[0].id]);
});

test('RF01/RN-S02: se rechaza un correo ya registrado (sin importar mayúsculas)', async () => {
  const entorno = await crearEntorno();
  const { usuarios } = entorno.servicios;
  await usuarios.registrarCliente(datosCliente(entorno));
  await assert.rejects(usuarios.registrarPrestador(datosPrestador(entorno, { email: 'Carla@Correo.TEST' })), regla('RN-S02'));
});

test('RF01: datos obligatorios del prestador', async () => {
  const entorno = await crearEntorno();
  const { usuarios } = entorno.servicios;
  await assert.rejects(usuarios.registrarPrestador(datosPrestador(entorno, { idsZonas: [] })), regla('DATOS'));
  await assert.rejects(usuarios.registrarPrestador(datosPrestador(entorno, { tarifaBase: 0 })), regla('DATOS'));
  await assert.rejects(usuarios.registrarPrestador(datosPrestador(entorno, { idsCategorias: [9999] })), regla('DATOS'));
  await assert.rejects(usuarios.registrarCliente(datosCliente(entorno, { contrasena: 'debil' })), regla('RN-S01'));
});

test('RN-S06: el administrador arma una familia nueva y se la asigna a un usuario', async () => {
  const { entorno, admin } = await entornoConAdmin();
  const { usuarios, permisos } = entorno.servicios;
  const cliente = await usuarios.registrarCliente(datosCliente(entorno));

  await permisos.crearFamilia({ codigo: 'FAM_AUDITOR', nombre: 'Auditor', hijos: ['BITACORA_VER', 'REPORTES_VER'] }, admin);
  await permisos.asignarAUsuario(cliente.id, 'FAM_AUDITOR', admin);
  assert.ok((await usuarios.obtener(cliente.id)).tienePermiso('BITACORA_VER'));

  await assert.rejects(permisos.agregarHijo('FAM_AUDITOR', 'FAM_AUDITOR', admin), regla('RN-S06'));
  await assert.rejects(permisos.agregarHijo('BITACORA_VER', 'REPORTES_VER', admin), regla('RN-S06'));

  await permisos.quitarHijo('FAM_AUDITOR', 'BITACORA_VER', admin);
  assert.ok(!(await usuarios.obtener(cliente.id)).tienePermiso('BITACORA_VER'), 'el cambio de familia impacta en todos sus usuarios');
});

test('RN-S07: no se puede dejar al sistema sin quien gestione permisos', async () => {
  const { entorno, admin } = await entornoConAdmin();
  const { usuarios, permisos } = entorno.servicios;

  await assert.rejects(permisos.quitarAUsuario(admin.id, 'FAM_ADMINISTRADOR', admin), regla('RN-S07'));
  await assert.rejects(permisos.quitarHijo('FAM_SEGURIDAD', 'PERMISO_GESTIONAR', admin), regla('RN-S07'));
  await assert.rejects(usuarios.bloquear(admin.id, admin), regla('RN-S07'), 'no puede bloquearse a sí mismo');

  // Con un segundo administrador sí se puede.
  const otro = await usuarios.crearAdministrador({ nombre: 'Beto', apellido: 'Admin', email: 'beto@servired.test', contrasena: 'ClaveSegura7' }, admin);
  await usuarios.bloquear(otro.id, admin);
  await permisos.quitarHijo('FAM_SEGURIDAD', 'BACKUP_GESTIONAR', admin);
});

test('Bloquear o dar de baja cierra las sesiones abiertas del usuario', async () => {
  const { entorno, admin } = await entornoConAdmin();
  const { usuarios, autenticacion } = entorno.servicios;
  const cliente = await usuarios.registrarCliente(datosCliente(entorno));
  const { token } = await autenticacion.iniciarSesion({ email: cliente.email, contrasena: 'Segura123' });
  await usuarios.darDeBaja(cliente.id, admin);
  await assert.rejects(autenticacion.validarSesion(token), NoAutenticadoError);
  await assert.rejects(autenticacion.iniciarSesion({ email: cliente.email, contrasena: 'Segura123' }), NoAutenticadoError);
});

test('RN-S11: backup y restauración devuelven la base al estado anterior y quedan en la bitácora', async () => {
  const { entorno, admin } = await entornoConAdmin();
  const { usuarios, backups, bitacora } = entorno.servicios;
  const respaldo = await backups.realizar(admin);
  const cliente = await usuarios.registrarCliente(datosCliente(entorno));

  entorno.reloj.avanzar(1000);
  const resultado = await backups.restaurar(respaldo.nombre, admin);
  assert.equal(resultado.integridad.integra, true);
  assert.equal(await entorno.repositorios.usuarioRepositorio.obtenerPorId(cliente.id), null);

  const eventos = (await bitacora.consultar({ tamanio: 100 })).items.map((e) => e.evento);
  assert.equal(eventos[0], 'Backup restaurado');
  await assert.rejects(backups.restaurar('../../etc/passwd', admin), regla('RN-S11'));
});

test('RN-S08: la bitácora se filtra por criticidad y pagina', async () => {
  const { entorno } = await entornoConAdmin();
  const { bitacora, autenticacion } = entorno.servicios;
  await autenticacion.iniciarSesion({ email: 'nadie@correo.test', contrasena: 'Algo12345' }).catch(() => {});
  const medias = await bitacora.consultar({ idCriticidad: 2 });
  assert.ok(medias.items.every((e) => e.criticidad === 'Media'));
  assert.ok(medias.items.some((e) => e.evento === 'Ingreso fallido'));
  const pagina = await bitacora.consultar({ tamanio: 1, pagina: 1 });
  assert.equal(pagina.items.length, 1);
  await assert.rejects(bitacora.consultar({ tamanio: 1000 }), regla('DATOS'));
});
