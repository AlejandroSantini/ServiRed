import {
  ReglaNegocioError, NoEncontradoError, NoAutenticadoError, AccesoDenegadoError, IntegridadComprometidaError,
} from '../../dominio/errores.js';

const CODIGOS_HTTP = [
  [ReglaNegocioError, 409],
  [NoEncontradoError, 404],
  [NoAutenticadoError, 401],
  [AccesoDenegadoError, 403],
  [IntegridadComprometidaError, 503],
];

/** Convierte los errores del dominio en respuestas HTTP. Nunca expone detalles internos. */
export function manejarErrores(error, _req, res, _next) {
  const par = CODIGOS_HTTP.find(([Tipo]) => error instanceof Tipo);
  if (par) return res.status(par[1]).json({ error: error.message, regla: error.codigo ?? undefined });
  if (error?.type === 'entity.parse.failed') return res.status(400).json({ error: 'El cuerpo del pedido no es JSON válido.' });
  if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'El pedido es demasiado grande.' });
  console.error(error);
  return res.status(500).json({ error: 'Error interno del servidor.' });
}

/** Express 4 no captura errores de funciones async: este envoltorio los pasa a manejarErrores. */
export function asincrono(manejador) {
  return (req, res, next) => Promise.resolve(manejador(req, res, next)).catch(next);
}
