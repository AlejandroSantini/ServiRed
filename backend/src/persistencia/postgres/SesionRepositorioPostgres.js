import { SesionRepositorio } from '../contratos/SesionRepositorio.js';
import { sesionAFila, filaASesion } from '../mapeadores.js';

export class SesionRepositorioPostgres extends SesionRepositorio {
  #bd;

  constructor({ bd }) {
    super();
    this.#bd = bd;
  }

  async guardar(sesion) {
    const f = sesionAFila(sesion);
    await this.#bd.consultar(
      `INSERT INTO sesion (id_sesion, id_usuario, fecha_inicio, fecha_expiracion, fecha_cierre, ip)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id_sesion) DO UPDATE SET fecha_cierre = EXCLUDED.fecha_cierre`,
      [f.id_sesion, f.id_usuario, f.fecha_inicio, f.fecha_expiracion, f.fecha_cierre, f.ip],
    );
    return sesion;
  }

  async obtenerPorId(id) {
    // Un jti con formato inválido no es un uuid: se responde "no existe" sin consultar.
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return null;
    const { rows } = await this.#bd.consultar('SELECT * FROM sesion WHERE id_sesion = $1', [id]);
    return rows[0] ? filaASesion(rows[0]) : null;
  }

  async cerrarTodasDelUsuario(idUsuario, ahora) {
    await this.#bd.consultar('UPDATE sesion SET fecha_cierre = $2 WHERE id_usuario = $1 AND fecha_cierre IS NULL', [idUsuario, ahora]);
  }
}
