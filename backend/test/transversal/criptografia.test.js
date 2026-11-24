import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { HashContrasena } from '../../src/transversal/HashContrasena.js';
import { Cifrador } from '../../src/transversal/Cifrador.js';
import { DigitoVerificador } from '../../src/transversal/DigitoVerificador.js';
import { GestorTokens } from '../../src/transversal/GestorTokens.js';
import { NoAutenticadoError } from '../../src/dominio/errores.js';

test('HashContrasena: verifica la contraseña correcta, rechaza la incorrecta y usa sal distinta', async () => {
  const hasher = new HashContrasena({ costo: 2 ** 10 });
  const h1 = await hasher.generar('Segura123');
  const h2 = await hasher.generar('Segura123');
  assert.notEqual(h1, h2, 'dos hashes de la misma contraseña deben diferir por la sal');
  assert.ok(!h1.includes('Segura123'));
  assert.equal(await hasher.verificar('Segura123', h1), true);
  assert.equal(await hasher.verificar('Segura124', h1), false);
  assert.equal(await hasher.verificar('Segura123', 'basura'), false);
});

test('Cifrador: cifra y descifra; detecta alteraciones del texto cifrado', () => {
  const cifrador = new Cifrador(randomBytes(32));
  const cifrado = cifrador.cifrar('341 555-1234');
  assert.notEqual(cifrado, '341 555-1234');
  assert.notEqual(cifrador.cifrar('341 555-1234'), cifrado, 'IV aleatorio');
  assert.equal(cifrador.descifrar(cifrado), '341 555-1234');
  assert.equal(cifrador.cifrar(null), null);

  const partes = cifrado.split(':');
  partes[3] = Buffer.from('otro texto').toString('base64');
  assert.throws(() => cifrador.descifrar(partes.join(':')));
  assert.throws(() => new Cifrador(randomBytes(32)).descifrar(cifrado), 'otra clave no descifra');
});

test('DigitoVerificador: cambia ante cualquier modificación y depende de la clave', () => {
  const clave = randomBytes(32);
  const dv = new DigitoVerificador(clave);
  const original = dv.calcularDVH([1, 'a@b.com', 'hash', 1, 0]);
  assert.equal(dv.calcularDVH([1, 'a@b.com', 'hash', 1, 0]), original);
  assert.notEqual(dv.calcularDVH([1, 'a@b.com', 'hash', 2, 0]), original);
  assert.notEqual(dv.calcularDVH(['a|', 'b']), dv.calcularDVH(['a', '|b']));
  assert.notEqual(new DigitoVerificador(randomBytes(32)).calcularDVH([1, 'a@b.com', 'hash', 1, 0]), original);
  assert.notEqual(dv.calcularDVV(['x', 'y']), dv.calcularDVV(['y', 'x']));
});

test('GestorTokens: acepta un token válido y rechaza firma alterada, alg distinto y token vencido', () => {
  const tokens = new GestorTokens(randomBytes(32));
  const ahora = new Date('2026-11-23T12:00:00Z');
  const exp = Math.floor(ahora.getTime() / 1000) + 3600;
  const token = tokens.firmar({ sub: 1, jti: 'abc', exp });
  assert.equal(tokens.verificar(token, ahora).sub, 1);

  const [h, , f] = token.split('.');
  const cuerpoFalso = Buffer.from(JSON.stringify({ sub: 2, jti: 'abc', exp })).toString('base64url');
  assert.throws(() => tokens.verificar(`${h}.${cuerpoFalso}.${f}`, ahora), NoAutenticadoError);

  const sinFirma = `${Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')}.${cuerpoFalso}.`;
  assert.throws(() => tokens.verificar(sinFirma, ahora), NoAutenticadoError);

  assert.throws(() => tokens.verificar(token, new Date(ahora.getTime() + 3601_000)), /expiró/);
  assert.throws(() => new GestorTokens(randomBytes(32)).verificar(token, ahora), NoAutenticadoError);
});
