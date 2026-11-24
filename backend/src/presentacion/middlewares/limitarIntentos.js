/**
 * Límite de pedidos por IP para el login. Complementa el bloqueo por cuenta
 * (RN-S03): frena a quien prueba contraseñas sobre muchas cuentas distintas.
 */
export function limitarIntentos({ maximo = 10, ventanaMs = 60_000, reloj = () => Date.now() } = {}) {
  const intentos = new Map();
  return (req, res, next) => {
    const ahora = reloj();
    const clave = req.ip ?? 'desconocida';
    const registro = intentos.get(clave);
    if (!registro || ahora - registro.inicio >= ventanaMs) {
      intentos.set(clave, { inicio: ahora, cantidad: 1 });
    } else if (++registro.cantidad > maximo) {
      res.set('Retry-After', String(Math.ceil((registro.inicio + ventanaMs - ahora) / 1000)));
      return res.status(429).json({ error: 'Demasiados intentos. Espere un momento y vuelva a intentar.' });
    }
    if (intentos.size > 10_000) {
      for (const [ip, r] of intentos) if (ahora - r.inicio >= ventanaMs) intentos.delete(ip);
    }
    return next();
  };
}
