/**
 * Flujo principal de RF05 + RF09 de punta a punta (CA3), usado tanto contra la
 * implementación en memoria como contra PostgreSQL (PGlite): ambas deben comportarse igual.
 */
import assert from 'node:assert/strict';
import { prepararContratacion, datosSolicitud, recargar, DIA } from './ayudantes.js';

export const regla = (codigo) => (e) => e?.codigo === codigo;

export async function flujoPrincipal(entorno) {
  const { contratacion, valoraciones, notificaciones, agenda, comisiones } = entorno.servicios;
  const { cliente, p1, p2 } = await prepararContratacion(entorno);

  // 1-4. Solicitud a dos prestadores (RN-C01, RN-C07)
  const solicitud = await contratacion.solicitarPresupuesto(cliente, datosSolicitud(entorno, [p1.id, p2.id]));
  assert.equal(solicitud.estado, 'Abierta');
  assert.equal(new Date(solicitud.fechaLimite) - new Date(solicitud.fechaCreacion), 15 * DIA);
  assert.equal(solicitud.direccion, 'Bv. Oroño 1234, piso 3');
  assert.match((await notificaciones.listar(p1)).items[0].mensaje, /Recibiste la solicitud/);

  // 5-6. Presupuestos (RN-C02, RN-C03); el prestador ve la comisión estimada (RF13)
  const presupuesto1 = await contratacion.emitirPresupuesto(p1, solicitud.id, { montoEstimado: 50000, tiempoEstimadoHoras: 4, fechaValidez: '2026-11-30' });
  assert.deepEqual(presupuesto1.comisionEstimada, { porcentaje: 10, monto: 5000 });
  await assert.rejects(contratacion.emitirPresupuesto(p1, solicitud.id, { montoEstimado: 1, tiempoEstimadoHoras: 1, fechaValidez: '2026-11-30' }), regla('RN-C02'));
  const presupuesto2 = await contratacion.emitirPresupuesto(p2, solicitud.id, { montoEstimado: 42000, tiempoEstimadoHoras: 5, fechaValidez: '2026-11-28' });

  const vistaCliente = await contratacion.obtenerSolicitud(cliente, solicitud.id);
  assert.equal(vistaCliente.subestado, 'ConPresupuestos');
  assert.equal(vistaCliente.presupuestos.length, 2);
  const vistaP2 = await contratacion.obtenerSolicitud(p2, solicitud.id);
  assert.equal(vistaP2.presupuestos.length, 1, 'el prestador no ve presupuestos ajenos');

  // 7-8. Aceptar: orden Programada, solicitud Adjudicada, el otro Descartado (RN-C04, RN-C05)
  const orden = await contratacion.aceptarPresupuesto(cliente, presupuesto1.id);
  assert.equal(orden.estado, 'Programada');
  assert.equal(orden.fechaProgramada, '2026-11-25');
  const despues = await contratacion.obtenerSolicitud(cliente, solicitud.id);
  assert.equal(despues.estado, 'Adjudicada');
  assert.deepEqual(despues.presupuestos.map((p) => p.estado), ['Aceptado', 'Descartado']);
  assert.equal((await comisiones.balance(p1.id)).pendiente, 5000, 'RN-K02: comisión registrada al aceptar');
  assert.equal((await agenda.agenda(p1)).ordenes.length, 1);
  await assert.rejects(contratacion.aceptarPresupuesto(cliente, presupuesto2.id), regla('RN-C04'));

  // 9. Iniciar: no antes de la fecha y solo el prestador asignado (RN-C08)
  await assert.rejects(contratacion.iniciarServicio(p1, orden.id), regla('RN-C08'));
  entorno.reloj.avanzar(2 * DIA);
  await assert.rejects(contratacion.iniciarServicio(p2, orden.id), (e) => e.name === 'NoEncontradoError');
  assert.equal((await contratacion.iniciarServicio(p1, orden.id)).estado, 'En ejecución');

  // FA04. Interrupción con motivo y reanudación (RN-C10)
  await assert.rejects(contratacion.registrarInterrupcion(p1, orden.id, ''), regla('RN-C10'));
  assert.equal((await contratacion.registrarInterrupcion(p1, orden.id, 'Falta un repuesto')).estado, 'Interrumpida');
  await contratacion.reanudarServicio(p1, orden.id);

  // 10. Finalización (RN-C09)
  entorno.reloj.avanzar(3 * 3_600_000);
  const finalizada = await contratacion.informarFinalizacion(p1, orden.id);
  assert.equal(finalizada.estado, 'Finalizada');
  assert.ok(finalizada.confirmarHasta);

  // 11-12. Valorar dentro de las 48 h: reseña, reputación, orden Cerrada, solicitud Finalizada (RN-V01 a RN-V03)
  await assert.rejects(valoraciones.evaluarOrden(cliente, orden.id, { puntaje: 0 }), regla('RN-V02'));
  const { resena, reputacionPromedio } = await valoraciones.evaluarOrden(cliente, orden.id, { puntaje: 4, comentario: 'Rápido y prolijo' });
  assert.equal(resena.estado, 'Publicada');
  assert.equal(reputacionPromedio, 4);
  assert.equal((await recargar(entorno, p1)).reputacionPromedio, 4);
  assert.equal((await contratacion.obtenerOrden(cliente, orden.id)).estado, 'Cerrada');
  assert.equal((await contratacion.obtenerSolicitud(cliente, solicitud.id)).estado, 'Finalizada');
  await assert.rejects(valoraciones.evaluarOrden(cliente, orden.id, { puntaje: 5 }), regla('RN-V01'));

  // Historial y trazabilidad (RF08, RN-C13, RNF06)
  assert.equal((await agenda.historial(cliente)).length, 1);
  assert.equal((await agenda.agenda(p1)).ordenes.length, 0);
  const cambios = await entorno.repositorios.historialEstadoRepositorio.listar('orden', orden.id);
  assert.deepEqual(cambios.map((c) => c.idEstadoNuevo), [1, 2, 3, 2, 4, 5]);
  assert.equal(cambios[2].observacion, 'Falta un repuesto');

  return { cliente, p1, p2, orden, resena, solicitud };
}

/** Moderación de la reseña del flujo principal (CU09.3 y CU09.4). */
export async function flujoModeracion(entorno, { p1, p2, resena, admin }) {
  const { valoraciones } = entorno.servicios;
  await assert.rejects(valoraciones.denunciar(p2, resena.id, { idMotivo: 1 }), (e) => e.name === 'NoEncontradoError');
  await assert.rejects(valoraciones.denunciar(p1, resena.id, {}), regla('RN-V05'));

  const denuncia = await valoraciones.denunciar(p1, resena.id, { idMotivo: 2, detalle: 'El trabajo fue otro' });
  assert.equal(denuncia.estado, 'Pendiente');
  assert.equal(denuncia.resena.estado, 'En revisión moderada');
  assert.equal((await recargar(entorno, p1)).reputacionPromedio, 0, 'RN-V05: la reseña denunciada no suma');
  await assert.rejects(valoraciones.denunciar(p1, resena.id, { idMotivo: 1 }), regla('RN-V05'));
  assert.equal((await valoraciones.denunciasPendientes()).length, 1);

  await assert.rejects(valoraciones.moderar(admin, denuncia.id, { decision: 'desestimar' }), regla('RN-V08'));
  const resuelta = await valoraciones.moderar(admin, denuncia.id, { decision: 'desestimar', comentario: 'La reseña no infringe las normas' });
  assert.equal(resuelta.estado, 'Desestimada');
  assert.equal((await recargar(entorno, p1)).reputacionPromedio, 4, 'RN-V06: vuelve a sumar');

  const segunda = await valoraciones.denunciar(p1, resena.id, { idMotivo: 1 });
  const aprobada = await valoraciones.moderar(admin, segunda.id, { decision: 'aprobar', comentario: 'Lenguaje inapropiado' });
  assert.equal(aprobada.resena.estado, 'Eliminada');
  assert.equal((await recargar(entorno, p1)).reputacionPromedio, 0, 'RN-V07');
  assert.equal((await valoraciones.resenasPublicas(p1.id)).length, 0);
  await assert.rejects(valoraciones.moderar(admin, segunda.id, { decision: 'aprobar', comentario: 'x' }), regla('RN-V07'));
}
