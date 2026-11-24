/**
 * RNF03 (comunicación cifrada) y cabeceras de seguridad HTTP.
 * - HSTS obliga al navegador a usar siempre HTTPS.
 * - En producción se rechazan los pedidos que no llegan por HTTPS.
 * - CORS solo para el origen del frontend en React.
 */
export function cabecerasSeguridad({ esProduccion, usaHttps, origenFrontend }) {
  return (req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'Cache-Control': 'no-store',
      'Cross-Origin-Resource-Policy': 'same-site',
    });
    if (usaHttps) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    if (esProduccion && !req.secure) {
      return res.status(403).json({ error: 'Se requiere una conexión HTTPS.' });
    }

    const origen = req.get('origin');
    if (origen && origen === origenFrontend) {
      res.set({
        'Access-Control-Allow-Origin': origen,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '600',
        Vary: 'Origin',
      });
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  };
}
