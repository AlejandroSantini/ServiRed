/**
 * Fuente de la fecha actual. Se inyecta en los servicios para poder probar
 * reglas que dependen del tiempo (vencimiento de sesión; en la Iteración 3,
 * los 15 días de la solicitud y las 48 h de confirmación).
 */
export const relojSistema = Object.freeze({
  ahora: () => new Date(),
});
