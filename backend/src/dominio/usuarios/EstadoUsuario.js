import { ElementoCatalogo } from '../comun/ElementoCatalogo.js';

/** Clase de catálogo (tabla estado_usuario). Reemplaza al enum de estados del usuario. */
export class EstadoUsuario extends ElementoCatalogo {
  static ACTIVO = new EstadoUsuario(1, 'Activo');
  static BLOQUEADO = new EstadoUsuario(2, 'Bloqueado');
  static BAJA = new EstadoUsuario(3, 'Baja');

  static todos() {
    return [EstadoUsuario.ACTIVO, EstadoUsuario.BLOQUEADO, EstadoUsuario.BAJA];
  }

  static desdeId(id) {
    return ElementoCatalogo.buscar(EstadoUsuario.todos(), id, 'estado_usuario');
  }

  permiteIngreso() { return this.esIgualA(EstadoUsuario.ACTIVO); }
  estaBloqueado() { return this.esIgualA(EstadoUsuario.BLOQUEADO); }
  estaDadoDeBaja() { return this.esIgualA(EstadoUsuario.BAJA); }
}
