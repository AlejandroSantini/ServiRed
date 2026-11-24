import { Usuario } from './Usuario.js';

/** Usuario que modera reseñas, consulta reportes y administra la seguridad. */
export class Administrador extends Usuario {
  get rol() { return 'administrador'; }
}
