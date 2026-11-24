/**
 * Errores del dominio. La capa de presentación (middleware manejarErrores)
 * los traduce a códigos HTTP; acá no se conoce HTTP.
 *
 * `codigo` identifica la regla de negocio que no se cumplió (RN-S03, RN-C02, ...).
 */
export class ErrorDeDominio extends Error {
  constructor(mensaje, codigo = null) {
    super(mensaje);
    this.name = new.target.name;
    this.codigo = codigo;
  }
}

/** No se cumple una regla de negocio o un dato es inválido (HTTP 409). */
export class ReglaNegocioError extends ErrorDeDominio {}

/** La entidad pedida no existe (HTTP 404). */
export class NoEncontradoError extends ErrorDeDominio {}

/** Falta autenticarse, las credenciales son inválidas o la sesión venció (HTTP 401). */
export class NoAutenticadoError extends ErrorDeDominio {}

/** El usuario está autenticado pero no tiene la patente requerida (HTTP 403). */
export class AccesoDenegadoError extends ErrorDeDominio {}

/** Los dígitos verificadores detectaron una modificación externa de los datos (HTTP 503). */
export class IntegridadComprometidaError extends ErrorDeDominio {}
