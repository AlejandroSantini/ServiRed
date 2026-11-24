import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, prepararContratacion, datosSolicitud, DIA, HORA } from '../ayudantes.js';
import { flujoPrincipal, flujoModeracion, regla } from '../escenarios.js';

async function conSolicitud(cambios = {}) {
  const entorno = await crearEntorno();
  const actores = await prepararContratacion(entorno);
  const solicitud = await entorno.servicios.contratacion.solicitarPresupuesto(
    actores.cliente, datosSolicitud(entorno, [actores.p1.id, actores.p2.id], cambios),
  );
  return { entorno, ...actores, solicitud, c: entorno.servicios.contratacion };
}

const presupuestoValido = { montoEstimado: 30000, tiempoEstimadoHoras: 2, fechaValidez: '2026-11-30' };

test('CA3: flujo principal de contratación y valoración de punta a punta (memoria)', async () => {
  const entorno = await crearEntorno();
  const resultado = await flujoPrincipal(entorno);
  const admin = await entorno.repositorios.usuarioRepositorio.obtenerPorEmail('admin@servired.test');
  await flujoModeracion(entorno, { ...resultado, admin });
});

test('RN-C01: entre 1 y 3 destinatarios que ofrezcan la categoría, cubran la zona y estén disponibles', async () => {
  const entorno = await crearEntorno();
  const { cliente, p1, p2 } = await prepararContratacion(entorno);
  const { contratacion, usuarios, agenda } = entorno.servicios;
  const pedir = (ids, cambios) => contratacion.solicitarPresupuesto(cliente, datosSolicitud(entorno, ids, cambios));

  await assert.rejects(pedir([]), regla('RN-C01'));
  await assert.rejects(pedir([p1.id, p1.id]), regla('RN-C01'));
  const extra1 = await usuarios.registrarPrestador({ ...datosPrestadorExtra(entorno, 'x1') });
  const extra2 = await usuarios.registrarPrestador({ ...datosPrestadorExtra(entorno, 'x2') });
  await assert.rejects(pedir([p1.id, p2.id, extra1.id, extra2.id]), regla('RN-C01'));
  await assert.rejects(pedir([p2.id], { idZona: entorno.zonas[1].id }), regla('RN-C01'), 'p2 no cubre zonas[1]');
  await assert.rejects(pedir([p1.id], { idCategoria: entorno.categorias[3].id }), regla('RN-C01'), 'no ofrece la categoría');
  await assert.rejects(pedir([cliente.id]), regla('RN-C01'), 'un cliente no es destinatario');

  await agenda.actualizarDisponibilidad(p1, { disponibilidadActiva: false });
  await assert.rejects(pedir([p1.id]), regla('RN-C01'), 'sin disponibilidad activa');
  await assert.rejects(pedir([p2.id], { fechaPreferida: '2026-11-01' }), regla('DATOS'));
  await assert.rejects(contratacion.solicitarPresupuesto(p2, datosSolicitud(entorno, [p2.id])), (e) => e.name === 'AccesoDenegadoError');
});

function datosPrestadorExtra(entorno, sufijo) {
  return {
    nombre: 'Extra', apellido: sufijo, email: `${sufijo}@correo.test`, contrasena: 'ClaveExtra9',
    idsZonas: [entorno.zonas[0].id], idsCategorias: [entorno.categorias[0].id], tarifaBase: 9000,
  };
}

test('RN-C03: monto y tiempo mayores que 0 y validez posterior a la emisión; solo destinatarios', async () => {
  const { c, p1, cliente, solicitud } = await conSolicitud();
  await assert.rejects(c.emitirPresupuesto(p1, solicitud.id, { ...presupuestoValido, montoEstimado: 0 }), regla('RN-C03'));
  await assert.rejects(c.emitirPresupuesto(p1, solicitud.id, { ...presupuestoValido, tiempoEstimadoHoras: -1 }), regla('RN-C03'));
  await assert.rejects(c.emitirPresupuesto(p1, solicitud.id, { ...presupuestoValido, fechaValidez: '2026-11-23' }), regla('RN-C03'));
  await assert.rejects(c.emitirPresupuesto(cliente, solicitud.id, presupuestoValido), (e) => e.name === 'AccesoDenegadoError');
});

test('FA01 / RN-C06: rechazar un presupuesto no cancela la solicitud', async () => {
  const { c, p1, cliente, solicitud } = await conSolicitud();
  const p = await c.emitirPresupuesto(p1, solicitud.id, presupuestoValido);
  assert.equal((await c.rechazarPresupuesto(cliente, p.id)).estado, 'Rechazado');
  const vista = await c.obtenerSolicitud(cliente, solicitud.id);
  assert.equal(vista.estado, 'Abierta');
  assert.equal(vista.subestado, 'SinPresupuestos');
  // Después de un rechazo puede emitir uno nuevo (RN-C02 solo cuenta los Emitidos).
  await c.emitirPresupuesto(p1, solicitud.id, presupuestoValido);
  await assert.rejects(c.rechazarPresupuesto(cliente, p.id), regla('RN-C04'));
});

test('FA02 / RN-C04: un presupuesto vencido no se acepta y queda Vencido', async () => {
  const { entorno, c, p1, cliente, solicitud } = await conSolicitud();
  const p = await c.emitirPresupuesto(p1, solicitud.id, { ...presupuestoValido, fechaValidez: '2026-11-24' });
  entorno.reloj.avanzar(2 * DIA);
  await assert.rejects(c.aceptarPresupuesto(cliente, p.id), regla('RN-C04'));
  const vista = await c.obtenerSolicitud(cliente, solicitud.id);
  assert.equal(vista.presupuestos[0].estado, 'Vencido');
  assert.equal(vista.estado, 'Abierta');
});

test('FA03 / RN-C07: la solicitud vence a los 15 días (planificador y en el momento)', async () => {
  const { entorno, c, p1, p2, cliente, solicitud } = await conSolicitud();
  await c.emitirPresupuesto(p2, solicitud.id, { ...presupuestoValido, fechaValidez: '2026-12-15' });
  entorno.reloj.avanzar(15 * DIA);
  await assert.rejects(c.emitirPresupuesto(p1, solicitud.id, presupuestoValido), regla('RN-C07'));
  assert.equal((await c.obtenerSolicitud(cliente, solicitud.id)).estado, 'Vencida');

  const otra = await c.solicitarPresupuesto(cliente, datosSolicitud(entorno, [p1.id], { fechaPreferida: '2026-12-10' }));
  entorno.reloj.avanzar(15 * DIA);
  const resultado = await entorno.servicios.planificador.ejecutar();
  assert.equal(resultado.solicitudesVencidas, 1);
  assert.equal(resultado.presupuestosVencidos, 1);
  assert.equal((await c.obtenerSolicitud(cliente, otra.id)).estado, 'Vencida');
});

test('FA05 / RN-C12: cancelar la solicitud Abierta descarta los presupuestos; cancelar la orden cancela la solicitud', async () => {
  const { entorno, c, p1, p2, cliente, solicitud } = await conSolicitud();
  await c.emitirPresupuesto(p1, solicitud.id, presupuestoValido);
  assert.equal((await c.cancelarSolicitud(cliente, solicitud.id)).estado, 'Cancelada');
  assert.equal((await c.obtenerSolicitud(cliente, solicitud.id)).presupuestos[0].estado, 'Descartado');
  await assert.rejects(c.cancelarSolicitud(cliente, solicitud.id), regla('RN-C12'));

  const segunda = await c.solicitarPresupuesto(cliente, datosSolicitud(entorno, [p2.id]));
  const p = await c.emitirPresupuesto(p2, segunda.id, presupuestoValido);
  const orden = await c.aceptarPresupuesto(cliente, p.id);
  await assert.rejects(c.cancelarSolicitud(cliente, segunda.id), regla('RN-C12'), 'Adjudicada: se cancela la orden');
  assert.equal((await c.cancelarOrden(p2, orden.id, 'Me enfermé')).estado, 'Cancelada');
  assert.equal((await c.obtenerSolicitud(cliente, segunda.id)).estado, 'Cancelada');
  assert.equal((await entorno.servicios.agenda.historial(p2, { idEstado: 6 })).length, 1);
});

test('RN-C10: una orden Interrumpida solo la cancela el prestador, con motivo', async () => {
  const { entorno, c, p1, cliente, solicitud } = await conSolicitud();
  const orden = await c.aceptarPresupuesto(cliente, (await c.emitirPresupuesto(p1, solicitud.id, presupuestoValido)).id);
  entorno.reloj.avanzar(2 * DIA);
  await c.iniciarServicio(p1, orden.id);
  await assert.rejects(c.cancelarOrden(p1, orden.id), regla('RN-C12'), 'En ejecución no se cancela');
  await c.registrarInterrupcion(p1, orden.id, 'Problema estructural');
  await assert.rejects(c.cancelarOrden(cliente, orden.id, 'x'), regla('RN-C10'));
  await assert.rejects(c.cancelarOrden(p1, orden.id, ''), regla('RN-C10'));
  assert.equal((await c.cancelarOrden(p1, orden.id, 'No se puede continuar')).estado, 'Cancelada');
});

test('FA06 / RN-C11: sin confirmación en 48 h la orden se cierra sola y ya no se puede valorar', async () => {
  const { entorno, c, p1, cliente, solicitud } = await conSolicitud();
  const orden = await c.aceptarPresupuesto(cliente, (await c.emitirPresupuesto(p1, solicitud.id, presupuestoValido)).id);
  entorno.reloj.avanzar(2 * DIA);
  await c.iniciarServicio(p1, orden.id);
  await c.informarFinalizacion(p1, orden.id);
  entorno.reloj.avanzar(48 * HORA + 1);
  await assert.rejects(entorno.servicios.valoraciones.evaluarOrden(cliente, orden.id, { puntaje: 5 }), regla('RN-C11'));
  const cerrada = await c.obtenerOrden(cliente, orden.id);
  assert.equal(cerrada.estado, 'Cerrada');
  assert.equal(cerrada.cerradaSinConfirmacion, true);
  await assert.rejects(entorno.servicios.valoraciones.evaluarOrden(cliente, orden.id, { puntaje: 5 }), regla('RN-V01'));
});

test('CU05.5 4.a: confirmar sin valorar cierra la orden y la valoración ya no puede registrarse', async () => {
  const { entorno, c, p1, cliente, solicitud } = await conSolicitud();
  const orden = await c.aceptarPresupuesto(cliente, (await c.emitirPresupuesto(p1, solicitud.id, presupuestoValido)).id);
  entorno.reloj.avanzar(2 * DIA);
  await c.iniciarServicio(p1, orden.id);
  await assert.rejects(c.confirmarFinalizacion(cliente, orden.id), regla('RN-C11'), 'todavía no está Finalizada');
  await c.informarFinalizacion(p1, orden.id);
  assert.equal((await c.confirmarFinalizacion(cliente, orden.id)).estado, 'Cerrada');
  await assert.rejects(entorno.servicios.valoraciones.evaluarOrden(cliente, orden.id, { puntaje: 5 }), regla('RN-V01'));
});

test('RN-C14 (R08): el prestador no puede tener dos órdenes activas en la misma fecha y turno', async () => {
  const { entorno, c, p1, cliente, solicitud } = await conSolicitud();
  await c.aceptarPresupuesto(cliente, (await c.emitirPresupuesto(p1, solicitud.id, presupuestoValido)).id);
  const otra = await c.solicitarPresupuesto(cliente, datosSolicitud(entorno, [p1.id]));
  const p = await c.emitirPresupuesto(p1, otra.id, presupuestoValido);
  await assert.rejects(c.aceptarPresupuesto(cliente, p.id), regla('RN-C14'));
  assert.equal((await c.aceptarPresupuesto(cliente, p.id, { idTurno: 2 })).turno.nombre, 'Tarde');
});

test('Los datos de otra persona no se ven: solicitud, presupuesto y orden ajenos responden "no existe"', async () => {
  const { entorno, c, p1, solicitud } = await conSolicitud();
  const intruso = await entorno.servicios.usuarios.registrarCliente({
    nombre: 'Ivo', apellido: 'Intruso', email: 'ivo@correo.test', contrasena: 'Intruso2026', idZona: entorno.zonas[0].id,
  });
  const p = await c.emitirPresupuesto(p1, solicitud.id, presupuestoValido);
  await assert.rejects(c.obtenerSolicitud(intruso, solicitud.id), (e) => e.name === 'NoEncontradoError');
  await assert.rejects(c.aceptarPresupuesto(intruso, p.id), (e) => e.name === 'NoEncontradoError');
});

test('Transacción: si un paso falla no queda nada a medias', async () => {
  const entorno = await crearEntorno();
  const { transacciones, bd } = entorno.repositorios;
  await assert.rejects(transacciones.ejecutar(async () => {
    bd.insertar('notificacion', { id_notificacion: 999, mensaje: 'parcial' });
    throw new Error('falla a mitad de camino');
  }));
  assert.equal(bd.tabla('notificacion').some((f) => f.id_notificacion === 999), false);
});
