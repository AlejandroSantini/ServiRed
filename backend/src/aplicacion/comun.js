import { AccesoDenegadoError, ReglaNegocioError } from '../dominio/errores.js';

/** Algunas operaciones son propias de un tipo de usuario además de exigir la patente. */
export function exigirTipo(usuario, Clase, descripcion) {
  if (!(usuario instanceof Clase)) throw new AccesoDenegadoError(`Esta operación es solo para ${descripcion}.`, 'RN-S06');
  return usuario;
}

export function fechaOpcional(valor, campo) {
  if (valor === undefined || valor === null || valor === '') return null;
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) throw new ReglaNegocioError(`El campo ${campo} no es una fecha válida.`, 'DATOS');
  return fecha;
}

export function idOpcional(valor, campo) {
  if (valor === undefined || valor === null || valor === '') return null;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) throw new ReglaNegocioError(`El campo ${campo} no es válido.`, 'DATOS');
  return numero;
}
