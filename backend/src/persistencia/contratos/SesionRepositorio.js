import { noImplementado } from './noImplementado.js';

/** Contrato del repositorio de sesiones (RN-S05). */
export class SesionRepositorio {
  async guardar(_sesion) { throw noImplementado('SesionRepositorio', 'guardar'); }

  async obtenerPorId(_id) { throw noImplementado('SesionRepositorio', 'obtenerPorId'); }

  /** Cierra todas las sesiones abiertas del usuario (bloqueo, baja, cambio de contraseña). */
  async cerrarTodasDelUsuario(_idUsuario, _ahora) { throw noImplementado('SesionRepositorio', 'cerrarTodasDelUsuario'); }
}
