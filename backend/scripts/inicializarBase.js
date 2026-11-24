/**
 * Crea el esquema en PostgreSQL (db/01_... a db/05_..., uno por iteración) y carga
 * los datos iniciales (patentes, familias, zonas, categorías, comisión general y el
 * primer administrador). Se puede ejecutar varias veces.
 *   npm run db:inicializar
 */
import pg from 'pg';
import { cargarConfiguracion } from '../src/config.js';
import { crearContenedor } from '../src/contenedor.js';
import { aplicarEsquema } from '../src/persistencia/postgres/esquema.js';
import { ZONAS_INICIALES, CATEGORIAS_INICIALES, TASA_GENERAL_INICIAL } from '../src/datosIniciales.js';

const config = cargarConfiguracion({ ...process.env, PERSISTENCIA: 'postgres' });
if (!config.administradorInicial?.contrasena) {
  console.error('Definí ADMIN_EMAIL y ADMIN_CONTRASENA en .env para crear el primer administrador.');
  process.exit(1);
}

const cliente = new pg.Client({ connectionString: config.urlBaseDatos });
await cliente.connect();
const aplicados = await aplicarEsquema((sql) => cliente.query(sql));
await cliente.end();
console.log(`Esquema aplicado: ${aplicados.join(', ')}`);

const contenedor = await crearContenedor(config);
try {
  const creados = await contenedor.servicios.inicializacion.inicializar({
    zonas: ZONAS_INICIALES,
    categorias: CATEGORIAS_INICIALES,
    tasaGeneral: TASA_GENERAL_INICIAL,
    administrador: config.administradorInicial,
  });
  console.log(`Datos iniciales: ${creados.patentes} patentes y ${creados.familias} familias nuevas`
    + `${creados.administrador ? `; administrador ${config.administradorInicial.email} creado` : ''}.`);
  const integridad = await contenedor.servicios.integridad.verificar();
  console.log(`Integridad de la base: ${integridad.integra ? 'OK' : `${integridad.inconsistencias.length} inconsistencias`}`);
} finally {
  await contenedor.cerrar();
}
