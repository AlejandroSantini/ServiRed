import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, prepararContratacion, datosSolicitud, DIA } from '../ayudantes.js';
import { regla } from '../escenarios.js';
import { Prestador } from '../../src/dominio/usuarios/Prestador.js';
import { Zona } from '../../src/dominio/usuarios/Zona.js';
import { CategoriaOficio } from '../../src/dominio/usuarios/CategoriaOficio.js';

const presupuesto = { montoEstimado: 20000, tiempoEstimadoHoras: 3, fechaValidez: '2026-11-30' };

/** Crea una orden Cerrada con valoración para el prestador indicado. */
async function trabajoValorado(entorno, cliente, prestador, puntaje, fechaPreferida) {
  const { contratacion, valoraciones } = entorno.servicios;
  const s = await contratacion.solicitarPresupuesto(cliente, datosSolicitud(entorno, [prestador.id], { fechaPreferida }));
  const p = await contratacion.emitirPresupuesto(prestador, s.id, { ...presupuesto, fechaValidez: '2027-01-31' });
  const orden = await contratacion.aceptarPresupuesto(cliente, p.id);
  return { orden, valorar: () => valoraciones.evaluarOrden(cliente, orden.id, { puntaje }) };
}

// ---------------- Iteración 2 – Búsqueda ----------------

test('RF03: filtra por categoría, zona y calificación mínima; mensaje claro sin resultados', async () => {
  const entorno = await crearEntorno();
  const { p1, p2 } = await prepararContratacion(entorno);
  const { busqueda } = entorno.servicios;

  const todos = await busqueda.buscar({ idCategoria: entorno.categorias[0].id, idZona: entorno.zonas[0].id });
  assert.deepEqual(todos.items.map((p) => p.id).sort(), [p1.id, p2.id].sort());
  assert.equal(todos.items[0].email, undefined, 'R05: la búsqueda no expone el correo');

  const enZona1 = await busqueda.buscar({ idZona: entorno.zonas[1].id });
  assert.deepEqual(enZona1.items.map((p) => p.id), [p1.id]);

  const exigente = await busqueda.buscar({ calificacionMinima: 4 });
  assert.equal(exigente.total, 0);
  assert.match(exigente.mensaje, /No encontramos prestadores/);
  await assert.rejects(busqueda.buscar({ calificacionMinima: 9 }), regla('DATOS'));
});

test('RF03 + RN-D02: un prestador con plan vigente aparece antes que uno sin plan; luego por reputación', async () => {
  const entorno = await crearEntorno();
  const { cliente, p1, p2 } = await prepararContratacion(entorno);
  const { busqueda, suscripciones } = entorno.servicios;

  const trabajo = await trabajoValorado(entorno, cliente, p1, 5, '2026-11-25');
  entorno.reloj.avanzar(2 * DIA);
  await entorno.servicios.contratacion.iniciarServicio(p1, trabajo.orden.id);
  await entorno.servicios.contratacion.informarFinalizacion(p1, trabajo.orden.id);
  await trabajo.valorar();

  let resultado = await busqueda.buscar({});
  assert.deepEqual(resultado.items.map((p) => p.id), [p1.id, p2.id], 'p1 tiene mejor reputación');
  assert.equal(resultado.items[0].trabajosRealizados, 1);

  await suscripciones.contratar(p2, { idPlan: 2 });
  resultado = await busqueda.buscar({});
  assert.deepEqual(resultado.items.map((p) => p.id), [p2.id, p1.id], 'p2 Premium primero');
  assert.equal(resultado.items[0].plan, 'Premium');

  entorno.reloj.avanzar(31 * DIA);
  assert.deepEqual((await busqueda.buscar({})).items.map((p) => p.id), [p1.id, p2.id], 'el plan venció');
});

// ---------------- Iteración 4 – Agenda ----------------

test('RF07: los cambios de disponibilidad se reflejan en el perfil y en la búsqueda', async () => {
  const entorno = await crearEntorno();
  const { p1, cliente } = await prepararContratacion(entorno);
  const { agenda, busqueda } = entorno.servicios;
  const perfil = await agenda.actualizarDisponibilidad(p1, { disponibilidad: 'Sábados de 9 a 13', disponibilidadActiva: false });
  assert.equal(perfil.disponibilidad, 'Sábados de 9 a 13');
  assert.ok(!(await busqueda.buscar({})).items.some((p) => p.id === p1.id));
  await assert.rejects(agenda.actualizarDisponibilidad(p1, { disponibilidadActiva: 'no' }), regla('DATOS'));
  await assert.rejects(agenda.agenda(cliente), (e) => e.name === 'AccesoDenegadoError');
});

// ---------------- Iteración 5 – Mensajería ----------------

test('RF06 / RN-M01 a RN-M03: mensajes entre el cliente y cada prestador de la solicitud', async () => {
  const entorno = await crearEntorno();
  const { cliente, p1, p2 } = await prepararContratacion(entorno);
  const { contratacion, mensajeria, notificaciones } = entorno.servicios;
  const s = await contratacion.solicitarPresupuesto(cliente, datosSolicitud(entorno, [p1.id, p2.id]));

  await mensajeria.enviar(cliente, s.id, { idPrestador: p1.id, texto: '¿Puede venir antes de las 10?' });
  await mensajeria.enviar(p1, s.id, { texto: 'Sí, a las 9 estoy.' });
  await assert.rejects(mensajeria.enviar(cliente, s.id, { texto: 'sin destinatario' }), regla('RN-M01'));
  await assert.rejects(mensajeria.enviar(cliente, s.id, { idPrestador: p2.id, texto: '   ' }), regla('RN-M02'));

  assert.match((await notificaciones.listar(p1)).items[0].mensaje, /Nuevo mensaje de Carla/);
  const conversacion = await mensajeria.conversacion(cliente, s.id, p1.id);
  assert.deepEqual(conversacion.map((m) => m.texto), ['¿Puede venir antes de las 10?', 'Sí, a las 9 estoy.']);
  assert.equal(conversacion[1].leido, true, 'abrir la conversación marca como leídos los mensajes recibidos');
  assert.equal(conversacion[0].leido, false, 'p1 todavía no abrió la conversación');
  assert.equal((await mensajeria.conversacion(p1, s.id))[0].leido, true);
  assert.equal((await mensajeria.conversacion(p2, s.id)).length, 0, 'p2 no ve la conversación con p1');

  const extrano = await entorno.servicios.usuarios.registrarCliente({
    nombre: 'Eva', apellido: 'Extraña', email: 'eva@correo.test', contrasena: 'Extrana2026', idZona: entorno.zonas[0].id,
  });
  await assert.rejects(mensajeria.conversacion(extrano, s.id, p1.id), (e) => e.name === 'NoEncontradoError');

  await contratacion.cancelarSolicitud(cliente, s.id);
  await assert.rejects(mensajeria.enviar(cliente, s.id, { idPrestador: p1.id, texto: 'hola' }), regla('RN-M03'));
});

test('RF11: notificaciones de cada cambio de estado y marcado como leídas', async () => {
  const entorno = await crearEntorno();
  const { cliente, p1 } = await prepararContratacion(entorno);
  const { contratacion, notificaciones } = entorno.servicios;
  const s = await contratacion.solicitarPresupuesto(cliente, datosSolicitud(entorno, [p1.id]));
  await contratacion.emitirPresupuesto(p1, s.id, presupuesto);
  const bandeja = await notificaciones.listar(cliente);
  assert.equal(bandeja.noLeidas, 1);
  await notificaciones.marcarLeida(cliente, bandeja.items[0].id);
  assert.equal((await notificaciones.listar(cliente)).noLeidas, 0);
  await assert.rejects(notificaciones.marcarLeida(p1, bandeja.items[0].id), (e) => e.name === 'NoEncontradoError');
});

// ---------------- Iteración 6 – Reputación ----------------

test('RN-V03: la reputación es el promedio simple de los puntajes, con dos decimales', () => {
  const prestador = new Prestador({
    nombre: 'P', apellido: 'Q', email: 'p@q.com', hashContrasena: 'h', tarifaBase: 1,
    zonas: [new Zona(1, 'Centro')], categorias: [new CategoriaOficio(1, 'Plomería')],
  });
  prestador.recalcularReputacion([5, 4, 4]);
  assert.equal(prestador.reputacionPromedio, 4.33);
  prestador.recalcularReputacion([]);
  assert.equal(prestador.reputacionPromedio, 0, 'sin reseñas publicadas');
});

test('RN-V02: comentario opcional que se trunca a 500 caracteres; puntaje entero de 1 a 5', async () => {
  const entorno = await crearEntorno();
  const { cliente, p1, p2 } = await prepararContratacion(entorno);
  const { contratacion } = entorno.servicios;
  const t1 = await trabajoValorado(entorno, cliente, p1, 5, '2026-11-25');
  const t2 = await trabajoValorado(entorno, cliente, p1, 4, '2026-11-26');
  const t3 = await trabajoValorado(entorno, cliente, p2, 4, '2026-11-25');
  entorno.reloj.avanzar(4 * DIA);
  for (const [t, p] of [[t1, p1], [t2, p1], [t3, p2]]) {
    await contratacion.iniciarServicio(p, t.orden.id);
    await contratacion.informarFinalizacion(p, t.orden.id);
  }
  await assert.rejects(entorno.servicios.valoraciones.evaluarOrden(cliente, t3.orden.id, { puntaje: 3.5 }), regla('RN-V02'));
  const largo = await entorno.servicios.valoraciones.evaluarOrden(cliente, t3.orden.id, { puntaje: 4, comentario: 'x'.repeat(600) });
  assert.equal(largo.resena.comentario.length, 500);

  await t1.valorar();
  const { reputacionPromedio } = await t2.valorar();
  assert.equal(reputacionPromedio, 4.5, '(5 + 4) / 2');
});

// ---------------- Iteración 7 – Comisiones y reportes ----------------

test('RN-K01 a RN-K03: tasa por categoría sobre la general, balance y liquidación', async () => {
  const entorno = await crearEntorno();
  const { cliente, p1, admin } = await prepararContratacion(entorno);
  const { comisiones, contratacion, bitacora } = entorno.servicios;

  await assert.rejects(comisiones.configurarTasa(admin, { porcentaje: 120 }), regla('RN-K01'));
  await comisiones.configurarTasa(admin, { idCategoria: entorno.categorias[0].id, porcentaje: 7.5 });
  assert.equal((await comisiones.listarTasas()).length, 2);

  const s = await contratacion.solicitarPresupuesto(cliente, datosSolicitud(entorno, [p1.id]));
  const p = await contratacion.emitirPresupuesto(p1, s.id, { ...presupuesto, montoEstimado: 12345 });
  assert.deepEqual(p.comisionEstimada, { porcentaje: 7.5, monto: 925.88 });
  await contratacion.aceptarPresupuesto(cliente, p.id);

  let balance = await comisiones.balancePropio(p1);
  assert.equal(balance.pendiente, 925.88);
  assert.equal(balance.comisiones.length, 1);
  balance = await comisiones.liquidar(admin, p1.id);
  assert.equal(balance.pendiente, 0);
  assert.equal(balance.liquidado, 925.88);
  const eventos = (await bitacora.consultar({ modulo: 'Comisiones' })).items.map((e) => e.evento);
  assert.deepEqual(eventos, ['Liquidación de comisiones', 'Cambio de comisión']);
});

test('RF10: demanda por zona y categoría, conversión, tiempo de respuesta y tendencia de precios', async () => {
  const entorno = await crearEntorno();
  const { cliente, p1, p2, admin } = await prepararContratacion(entorno);
  const { contratacion, reportes, suscripciones } = entorno.servicios;

  const s1 = await contratacion.solicitarPresupuesto(cliente, datosSolicitud(entorno, [p1.id, p2.id]));
  await contratacion.solicitarPresupuesto(cliente, datosSolicitud(entorno, [p1.id], { idZona: entorno.zonas[1].id }));
  entorno.reloj.avanzar(2 * 3_600_000);
  const a = await contratacion.emitirPresupuesto(p1, s1.id, { ...presupuesto, montoEstimado: 10000 });
  await contratacion.emitirPresupuesto(p2, s1.id, { ...presupuesto, montoEstimado: 14000 });
  await contratacion.aceptarPresupuesto(cliente, a.id);
  await suscripciones.contratar(p2, { idPlan: 1 });

  const r = await reportes.indicadores({});
  assert.deepEqual(r.demandaPorZona.map((z) => z.solicitudes), [1, 1]);
  assert.equal(r.demandaPorCategoria[0].solicitudes, 2);
  assert.equal(r.tiempoRespuestaPromedioHoras, 2);
  assert.deepEqual(r.conversion, {
    presupuestosEmitidos: 2, presupuestosAceptados: 1, tasaPresupuestos: 0.5, solicitudes: 2, solicitudesAdjudicadas: 1, tasaSolicitudes: 0.5,
  });
  assert.deepEqual(r.tendenciaPrecios, [{ categoria: entorno.categorias[0].nombre, mes: '2026-11', promedio: 10000, cantidad: 1 }]);

  const ingresos = await reportes.ingresos({});
  assert.equal(ingresos.comisiones.registradas, 1000);
  assert.equal(ingresos.planes, 5000);
  assert.equal(ingresos.total, 6000);
  assert.ok(admin);
});

// ---------------- Iteración 8 – Suscripciones ----------------

test('RN-D01 / RN-D04: los planes se encadenan y el panel requiere un plan vigente', async () => {
  const entorno = await crearEntorno();
  const { cliente, p1 } = await prepararContratacion(entorno);
  const { suscripciones, busqueda, contratacion } = entorno.servicios;

  await assert.rejects(suscripciones.panel(p1), regla('RN-D04'));
  const primera = await suscripciones.contratar(p1, { idPlan: 1 });
  const segunda = await suscripciones.contratar(p1, { idPlan: 2 });
  assert.equal(segunda.fechaInicio, primera.fechaFin, 'el segundo plan empieza cuando termina el primero');
  await assert.rejects(suscripciones.contratar(p1, { idPlan: 99 }), regla('RN-D01'));

  await busqueda.perfil(p1.id, cliente);
  await busqueda.perfil(p1.id, cliente);
  const s = await contratacion.solicitarPresupuesto(cliente, datosSolicitud(entorno, [p1.id]));
  await contratacion.aceptarPresupuesto(cliente, (await contratacion.emitirPresupuesto(p1, s.id, presupuesto)).id);

  const panel = await suscripciones.panel(p1);
  assert.equal(panel.plan, 'Verificado');
  assert.equal(panel.visitas, 2);
  assert.equal(panel.solicitudesRecibidas, 1);
  assert.equal(panel.conversionVisitasASolicitudes, 0.5);
  assert.equal(panel.conversionPresupuestos, 1);
});
