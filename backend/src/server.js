import { readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { randomBytes } from 'node:crypto';
import { cargarConfiguracion } from './config.js';
import { crearContenedor } from './contenedor.js';
import { crearApp } from './app.js';
import { ZONAS_INICIALES, CATEGORIAS_INICIALES, TASA_GENERAL_INICIAL } from './datosIniciales.js';

const config = cargarConfiguracion();
const contenedor = await crearContenedor(config);

if (config.persistencia === 'memoria') {
  // Sin base real: se cargan los datos iniciales en cada arranque.
  const administrador = config.administradorInicial ?? {
    email: 'admin@servired.local',
    contrasena: `Adm1n-${randomBytes(6).toString('base64url')}`,
    nombre: 'Administrador',
    apellido: 'ServiRed',
  };
  await contenedor.servicios.inicializacion.inicializar({
    zonas: ZONAS_INICIALES, categorias: CATEGORIAS_INICIALES, tasaGeneral: TASA_GENERAL_INICIAL, administrador,
  });
  if (!config.administradorInicial) {
    console.log(`[dev] Administrador de prueba: ${administrador.email} / ${administrador.contrasena}`);
  }
  if (process.env.DEMO === 'true' && !config.esProduccion) {
    const { cargarDatosDemo, CONTRASENA_DEMO } = await import('./datosDemo.js');
    const correos = await cargarDatosDemo(contenedor);
    console.log(`[demo] Usuarios de ejemplo (contraseña ${CONTRASENA_DEMO}): ${correos.join(', ')}`);
  }
}

const app = crearApp(contenedor);
let servidor;
if (config.tls.certificado && config.tls.clave) {
  servidor = https.createServer({ cert: readFileSync(config.tls.certificado), key: readFileSync(config.tls.clave) }, app);
} else {
  if (config.esProduccion && !config.detrasDeProxyHttps) {
    throw new Error('En producción se requiere HTTPS: definí TLS_CERT y TLS_KEY o DETRAS_DE_PROXY_HTTPS=true.');
  }
  servidor = http.createServer(app);
}

servidor.listen(config.puerto, () => {
  const protocolo = servidor instanceof https.Server ? 'https' : 'http';
  console.log(`ServiRed API en ${protocolo}://localhost:${config.puerto}/api (persistencia: ${config.persistencia})`);
});

// Actor "Sistema" (RF05): vencimientos y cierres automáticos cada minuto.
const planificador = setInterval(() => {
  contenedor.servicios.planificador.ejecutar().catch((e) => console.error('[planificador]', e));
}, 60_000);

const apagar = async () => {
  clearInterval(planificador);
  servidor.close();
  await contenedor.cerrar();
  process.exit(0);
};
process.on('SIGINT', apagar);
process.on('SIGTERM', apagar);
