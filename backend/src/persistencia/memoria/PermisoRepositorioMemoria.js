import { PermisoRepositorio } from '../contratos/PermisoRepositorio.js';
import { componenteAFila, filasAArbolPermisos } from '../mapeadores.js';
import { ReglaNegocioError } from '../../dominio/errores.js';

export class PermisoRepositorioMemoria extends PermisoRepositorio {
  #bd;
  #integridad;

  constructor({ bd, integridadRepositorio }) {
    super();
    this.#bd = bd;
    this.#integridad = integridadRepositorio;
  }

  async obtenerTodos() {
    return filasAArbolPermisos(this.#bd.seleccionar('permiso'), this.#bd.seleccionar('permiso_hijo'));
  }

  async guardar(componente) {
    return this.#integridad.conIntegridad(['permiso', 'permiso_hijo'], async () => {
      if (componente.id === null) {
        if (this.#bd.tabla('permiso').some((f) => f.codigo === componente.codigo)) {
          throw new ReglaNegocioError(`Ya existe un permiso con el código ${componente.codigo}.`, 'RN-S06');
        }
        componente.asignarId(this.#bd.siguienteId('permiso'));
      }
      const id = componente.id;
      const fila = componenteAFila(componente);
      this.#bd.reemplazar('permiso', (f) => f.id_permiso === id, [{ ...fila, dvh: this.#integridad.calcularDVH('permiso', fila) }]);

      if (componente.esFamilia()) {
        const hijos = componente.hijos.map((hijo) => {
          if (hijo.id === null) throw new Error(`El permiso ${hijo.codigo} debe guardarse antes que la familia.`);
          const filaHijo = { id_padre: id, id_hijo: hijo.id };
          return { ...filaHijo, dvh: this.#integridad.calcularDVH('permiso_hijo', filaHijo) };
        });
        this.#bd.reemplazar('permiso_hijo', (f) => f.id_padre === id, hijos);
      }
      return componente;
    });
  }
}
