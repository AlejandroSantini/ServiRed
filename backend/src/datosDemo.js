/**
 * Datos de demostración (solo con PERSISTENCIA=memoria y DEMO=true, nunca en producción).
 * Contraseña de todos los usuarios demo: Demo2026x
 */
export const CONTRASENA_DEMO = 'Demo2026x';

export async function cargarDatosDemo({ servicios, repositorios }) {
  const { usuarios, contratacion, suscripciones } = servicios;
  const zonas = await repositorios.catalogoRepositorio.listarZonas();
  const categorias = await repositorios.catalogoRepositorio.listarCategorias();
  const zona = (nombre) => zonas.find((z) => z.nombre === nombre).id;
  const oficio = (nombre) => categorias.find((c) => c.nombre === nombre).id;
  const contrasena = CONTRASENA_DEMO;

  const cliente = await usuarios.registrarCliente({
    nombre: 'Carla', apellido: 'Benítez', email: 'cliente@demo.test', contrasena, telefono: '341 555-0101', idZona: zona('Centro'),
  });
  const pedro = await usuarios.registrarPrestador({
    nombre: 'Pedro', apellido: 'Arrieta', email: 'plomero@demo.test', contrasena, idsZonas: [zona('Centro'), zona('Pichincha'), zona('Echesortu')],
    idsCategorias: [oficio('Plomería'), oficio('Gasista')], tarifaBase: 18000,
    descripcion: 'Plomero y gasista matriculado. Más de 12 años arreglando pérdidas, termotanques y cañerías en el centro de Rosario.',
    disponibilidad: 'Lunes a sábado de 8 a 18',
  });
  const lucia = await usuarios.registrarPrestador({
    nombre: 'Lucía', apellido: 'Ferreyra', email: 'plomera@demo.test', contrasena, idsZonas: [zona('Centro'), zona('Alberdi')],
    idsCategorias: [oficio('Plomería')], tarifaBase: 15000,
    descripcion: 'Instalaciones sanitarias y destapaciones. Presupuesto sin cargo dentro de la zona.', disponibilidad: 'Lunes a viernes de 9 a 17',
  });
  await usuarios.registrarPrestador({
    nombre: 'Martín', apellido: 'Sosa', email: 'electricista@demo.test', contrasena, idsZonas: [zona('Centro'), zona('Fisherton')],
    idsCategorias: [oficio('Electricidad')], tarifaBase: 20000, descripcion: 'Electricista. Tableros, disyuntores y cableado completo.',
  });
  await suscripciones.contratar(pedro, { idPlan: 2 });

  const manana = new Date(Date.now() + 24 * 3_600_000).toISOString().slice(0, 10);
  const enUnaSemana = new Date(Date.now() + 7 * 24 * 3_600_000).toISOString().slice(0, 10);
  const solicitud = await contratacion.solicitarPresupuesto(cliente, {
    idCategoria: oficio('Plomería'), idZona: zona('Centro'), idTurnoPreferido: 1, fechaPreferida: manana,
    descripcion: 'Pierde agua la canilla de la cocina y hay humedad debajo de la mesada.', direccion: 'Córdoba 1450, 4.º B',
    idsPrestadores: [pedro.id, lucia.id],
  });
  await contratacion.emitirPresupuesto(pedro, solicitud.id, {
    montoEstimado: 45000, tiempoEstimadoHoras: 3, fechaValidez: enUnaSemana, detalle: 'Cambio de cartucho y flexible, revisión de la descarga.',
  });
  await contratacion.emitirPresupuesto(lucia, solicitud.id, {
    montoEstimado: 38000, tiempoEstimadoHoras: 4, fechaValidez: enUnaSemana, detalle: 'Incluye materiales estándar.',
  });
  return ['cliente@demo.test', 'plomero@demo.test', 'plomera@demo.test', 'electricista@demo.test'];
}
