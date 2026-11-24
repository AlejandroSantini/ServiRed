import { PermisoRepositorio } from '../contratos/PermisoRepositorio.js';
import { componenteAFila, filasAArbolPermisos } from '../mapeadores.js';
import { ReglaNegocioError } from '../../dominio/errores.js';

export class PermisoRepositorioPostgres extends PermisoRepositorio {
  #bd;
  #integridad;

  constructor({ bd, integridadRepositorio }) {
    super();
    this.#bd = bd;
    this.#integridad = integridadRepositorio;
  }

  async obtenerTodos() {
    const [{ rows: permisos }, { rows: hijos }] = await Promise.all([
      this.#bd.consultar('SELECT id_permiso, codigo, nombre, es_familia FROM permiso'),
      this.#bd.consultar('SELECT id_padre, id_hijo FROM permiso_hijo'),
    ]);
    return filasAArbolPermisos(permisos, hijos);
  }

  async guardar(componente) {
    try {
      return await this.#bd.transaccion((cx) => this.#integridad.conIntegridad(['permiso', 'permiso_hijo'], async () => {
        const fila = componenteAFila(componente);
        let guardada;
        if (componente.id === null) {
          guardada = await this.#bd.insertar('permiso', { ...fila, id_permiso: undefined }, cx);
          componente.asignarId(guardada.id_permiso);
        } else {
          guardada = await this.#bd.actualizar('permiso', fila, ['id_permiso'], cx);
        }
        await this.#integridad.sellarFila('permiso', guardada, cx);

        if (componente.esFamilia()) {
          await this.#bd.consultar('DELETE FROM permiso_hijo WHERE id_padre = $1', [componente.id], cx);
          for (const hijo of componente.hijos) {
            if (hijo.id === null) throw new Error(`El permiso ${hijo.codigo} debe guardarse antes que la familia.`);
            const filaHijo = await this.#bd.insertar('permiso_hijo', { id_padre: componente.id, id_hijo: hijo.id }, cx);
            await this.#integridad.sellarFila('permiso_hijo', filaHijo, cx);
          }
        }
        return componente;
      }, cx));
    } catch (error) {
      if (error.code === '23505') throw new ReglaNegocioError(`Ya existe un permiso con el código ${componente.codigo}.`, 'RN-S06');
      throw error;
    }
  }
}
