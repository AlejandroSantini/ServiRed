import { ReglaNegocioError } from '../errores.js';

export function textoObligatorio(valor, campo, maximo) {
  if (typeof valor !== 'string' || !valor.trim()) {
    throw new ReglaNegocioError(`El campo ${campo} es obligatorio.`, 'DATOS');
  }
  return textoMaximo(valor.trim(), campo, maximo);
}

export function textoOpcional(valor, campo, maximo) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor !== 'string') throw new ReglaNegocioError(`El campo ${campo} debe ser texto.`, 'DATOS');
  return textoMaximo(valor.trim(), campo, maximo);
}

function textoMaximo(texto, campo, maximo) {
  if (texto.length > maximo) {
    throw new ReglaNegocioError(`El campo ${campo} admite hasta ${maximo} caracteres.`, 'DATOS');
  }
  return texto;
}

export function idValido(valor, campo) {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new ReglaNegocioError(`El campo ${campo} no es un identificador válido.`, 'DATOS');
  }
  return numero;
}
