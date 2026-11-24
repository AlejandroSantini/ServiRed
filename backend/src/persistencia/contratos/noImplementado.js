/**
 * JavaScript no tiene interfaces: los contratos de los repositorios son clases
 * base cuyos métodos lanzan este error hasta que una implementación los redefine
 * (memoria para las pruebas, PostgreSQL para producción). Ver 12.2.6.2.
 */
export function noImplementado(clase, metodo) {
  return new Error(`${clase}.${metodo}() no está implementado.`);
}
