import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Patente } from '../../src/dominio/seguridad/Patente.js';
import { Familia } from '../../src/dominio/seguridad/Familia.js';
import { PoliticaContrasena } from '../../src/dominio/seguridad/PoliticaContrasena.js';
import { Administrador } from '../../src/dominio/usuarios/Administrador.js';
import { Usuario } from '../../src/dominio/usuarios/Usuario.js';
import { EstadoUsuario } from '../../src/dominio/usuarios/EstadoUsuario.js';
import { ReglaNegocioError } from '../../src/dominio/errores.js';

const regla = (codigo) => (e) => e instanceof ReglaNegocioError && e.codigo === codigo;

function arbol() {
  const ver = new Patente({ codigo: 'BITACORA_VER', nombre: 'Ver bitácora' });
  const backup = new Patente({ codigo: 'BACKUP_GESTIONAR', nombre: 'Backups' });
  const moderar = new Patente({ codigo: 'DENUNCIA_MODERAR', nombre: 'Moderar' });
  const seguridad = new Familia({ codigo: 'FAM_SEGURIDAD', nombre: 'Seguridad' });
  seguridad.agregar(ver);
  seguridad.agregar(backup);
  const admin = new Familia({ codigo: 'FAM_ADMIN', nombre: 'Admin' });
  admin.agregar(seguridad);
  admin.agregar(moderar);
  return { ver, backup, moderar, seguridad, admin };
}

test('Composite RN-S06: una familia otorga las patentes de sus hijos a cualquier profundidad', () => {
  const { admin, seguridad } = arbol();
  assert.equal(admin.tienePermiso('BITACORA_VER'), true);
  assert.equal(admin.tienePermiso('DENUNCIA_MODERAR'), true);
  assert.equal(seguridad.tienePermiso('DENUNCIA_MODERAR'), false);
  assert.deepEqual(admin.obtenerPatentes().map((p) => p.codigo).sort(), ['BACKUP_GESTIONAR', 'BITACORA_VER', 'DENUNCIA_MODERAR']);
});

test('Composite RN-S06: rechaza ciclos, hijos duplicados y patentes con hijos', () => {
  const { admin, seguridad, ver } = arbol();
  assert.throws(() => seguridad.agregar(admin), regla('RN-S06'), 'ciclo indirecto');
  assert.throws(() => admin.agregar(admin), regla('RN-S06'), 'ciclo directo');
  assert.throws(() => admin.agregar(seguridad), regla('RN-S06'), 'duplicado');
  assert.throws(() => ver.agregar(seguridad), regla('RN-S06'), 'una patente es hoja');
  assert.throws(() => new Patente({ codigo: 'minusculas', nombre: 'x' }), regla('RN-S06'));
});

test('Usuario: tiene permiso a través de sus familias y no admite asignaciones repetidas', () => {
  const { admin } = arbol();
  const usuario = new Administrador({ nombre: 'Ada', apellido: 'Lovelace', email: 'ADA@Correo.test ', hashContrasena: 'h' });
  assert.equal(usuario.email, 'ada@correo.test');
  assert.equal(usuario.tienePermiso('BACKUP_GESTIONAR'), false);
  usuario.asignarPermiso(admin);
  assert.equal(usuario.tienePermiso('BACKUP_GESTIONAR'), true);
  assert.throws(() => usuario.asignarPermiso(admin), regla('RN-S06'));
  usuario.quitarPermiso('FAM_ADMIN');
  assert.equal(usuario.tienePermiso('BACKUP_GESTIONAR'), false);
});

test('Usuario RN-S03: se bloquea al tercer intento fallido; el ingreso exitoso reinicia el contador', () => {
  const usuario = new Administrador({ nombre: 'Ada', apellido: 'L', email: 'ada@correo.test', hashContrasena: 'h' });
  assert.equal(usuario.registrarAccesoFallido(), false);
  usuario.registrarAccesoExitoso(new Date());
  assert.equal(usuario.intentosFallidos, 0);

  assert.equal(usuario.registrarAccesoFallido(), false);
  assert.equal(usuario.registrarAccesoFallido(), false);
  assert.equal(usuario.registrarAccesoFallido(), true);
  assert.equal(usuario.estado, EstadoUsuario.BLOQUEADO);
  assert.equal(usuario.estaActivo(), false);
  assert.equal(usuario.registrarAccesoFallido(), false, 'bloqueado ya no suma intentos');

  usuario.desbloquear();
  assert.equal(usuario.estaActivo(), true);
  assert.equal(usuario.intentosFallidos, 0);
  assert.throws(() => usuario.desbloquear(), regla('RN-S03'));
});

test('Usuario: es abstracta y valida sus datos', () => {
  assert.throws(() => new Usuario({ nombre: 'a', apellido: 'b', email: 'a@b.com', hashContrasena: 'h' }), TypeError);
  assert.throws(() => new Administrador({ nombre: 'a', apellido: 'b', email: 'no-es-correo', hashContrasena: 'h' }), regla('DATOS'));
  assert.throws(() => new Administrador({ nombre: ' ', apellido: 'b', email: 'a@b.com', hashContrasena: 'h' }), regla('DATOS'));
});

test('PoliticaContrasena RN-S01: longitud, letras y números, y que no contenga el correo', () => {
  assert.doesNotThrow(() => PoliticaContrasena.validar('Segura123', { email: 'carla@correo.test' }));
  assert.throws(() => PoliticaContrasena.validar('Ab1'), regla('RN-S01'));
  assert.throws(() => PoliticaContrasena.validar('solamenteletras'), regla('RN-S01'));
  assert.throws(() => PoliticaContrasena.validar('1234567890'), regla('RN-S01'));
  assert.throws(() => PoliticaContrasena.validar('Carla2026x', { email: 'carla@correo.test' }), regla('RN-S01'));
  assert.throws(() => PoliticaContrasena.validar(undefined), regla('RN-S01'));
});
