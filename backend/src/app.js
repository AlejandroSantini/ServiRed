import express from 'express';
import { crearRutas } from './presentacion/rutas.js';
import { cabecerasSeguridad } from './presentacion/middlewares/cabecerasSeguridad.js';
import { manejarErrores } from './presentacion/middlewares/manejarErrores.js';

export function crearApp(contenedor) {
  const { config } = contenedor;
  const app = express();
  app.disable('x-powered-by');
  // Detrás de un proxy HTTPS (nginx, Render, Railway...) req.secure e req.ip salen de X-Forwarded-*.
  if (config.detrasDeProxyHttps) app.set('trust proxy', 1);

  const usaHttps = Boolean(config.tls.certificado) || config.detrasDeProxyHttps;
  app.use(cabecerasSeguridad({ esProduccion: config.esProduccion, usaHttps, origenFrontend: config.origenFrontend }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', crearRutas(contenedor));
  app.use((_req, res) => res.status(404).json({ error: 'Recurso no encontrado.' }));
  app.use(manejarErrores);
  return app;
}
