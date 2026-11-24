/**
 * Las mismas reglas contra PostgreSQL real (PGlite, sin servidor): valida el
 * esquema de db/ (PK, FK, UK, CHECK, índices parciales y triggers) y los
 * repositorios PostgreSQL.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, prepararContratacion, datosSolicitud, DIA } from '../ayudantes.js';
import { flujoPrincipal, flujoModeracion } from '../escenarios.js';

test('PostgreSQL: flujo principal de contratación, valoración y moderación (CA3)', async () => {
  const entorno = await crearEntorno({ postgres: true });
  const resultado = await flujoPrincipal(entorno);
  const admin = await entorno.repositorios.usuarioRepositorio.obtenerPorEmail('admin@servired.test');
  await flujoModeracion(entorno, { ...resultado, admin });
  assert.equal((await entorno.servicios.integridad.verificar()).integra, true, 'los dígitos verificadores siguen íntegros');
  await entorno.cerrar();
});

test('PostgreSQL: la base también hace cumplir las reglas aunque se saltee la aplicación', async () => {
  const entorno = await crearEntorno({ postgres: true });
  const { db } = entorno;
  const { cliente, p1, p2 } = await prepararContratacion(entorno);
  const { contratacion } = entorno.servicios;
  const s = await contratacion.solicitarPresupuesto(cliente, datosSolicitud(entorno, [p1.id]));
  const p = await contratacion.emitirPresupuesto(p1, s.id, { montoEstimado: 1000, tiempoEstimadoHoras: 1, fechaValidez: '2026-11-30' });

  const insertarPresupuesto = (idPrestador, monto, validez) => db.query(
    `INSERT INTO presupuesto (id_solicitud, id_prestador, id_estado, monto_estimado, tiempo_estimado_horas, fecha_emision, fecha_validez)
     VALUES ($1, $2, 1, $3, 1, now(), $4)`, [s.id, idPrestador, monto, validez]);

  await assert.rejects(insertarPresupuesto(p1.id, 500, '2027-01-01'), /uk_presupuesto_vigente/, 'RN-C02');
  await assert.rejects(insertarPresupuesto(p2.id, 500, '2027-01-01'), /fk_presupuesto_destinatario/, 'RN-C01');
  await assert.rejects(db.query('UPDATE presupuesto SET monto_estimado = 0 WHERE id_presupuesto = $1', [p.id]), /check/i, 'RN-C03');
  await assert.rejects(db.query("UPDATE presupuesto SET fecha_validez = '2020-01-01' WHERE id_presupuesto = $1", [p.id]), /ck_presupuesto_validez/);
  await assert.rejects(db.query('INSERT INTO solicitud_destinatario VALUES ($1, $2)', [s.id, p1.id]), /duplicate|llave duplicada|unique/i);

  const orden = await contratacion.aceptarPresupuesto(cliente, p.id);
  entorno.reloj.avanzar(2 * DIA);
  await contratacion.iniciarServicio(p1, orden.id);
  await contratacion.informarFinalizacion(p1, orden.id);
  const { resena } = await entorno.servicios.valoraciones.evaluarOrden(cliente, orden.id, { puntaje: 5 });

  await assert.rejects(db.query('UPDATE resena SET puntaje = 1 WHERE id_resena = $1', [resena.id]), /RN-V04/);
  await assert.rejects(db.query(
    'INSERT INTO resena (id_orden, id_estado, puntaje, fecha_feedback) VALUES ($1, 1, 3, now())', [orden.id]), /uk_resena_orden/, 'RN-V01');
  await assert.rejects(db.query(
    'INSERT INTO denuncia (id_resena, id_prestador, id_estado, id_motivo, fecha_denuncia) VALUES ($1, $2, 2, 1, now())',
    [resena.id, p1.id]), /ck_denuncia_resolucion/, 'RN-V08');
  await entorno.cerrar();
});
