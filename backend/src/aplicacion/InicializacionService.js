import { Patente } from '../dominio/seguridad/Patente.js';
import { Familia } from '../dominio/seguridad/Familia.js';
import { DESCRIPCION_PATENTE, FAMILIAS_INICIALES } from '../dominio/seguridad/permisosDelSistema.js';
import { TasaComision } from '../dominio/monetizacion/TasaComision.js';

/**
 * Carga idempotente de los datos que el sistema necesita para funcionar:
 * patentes, familias iniciales, catálogos y el primer administrador.
 * Si algo ya existe, no lo toca.
 */
export class InicializacionService {
  #permisos;
  #catalogos;
  #usuarios;
  #usuarioService;

  #tasas;
  #reloj;

  constructor({ permisoRepositorio, catalogoRepositorio, usuarioRepositorio, usuarioService, tasaComisionRepositorio = null, reloj }) {
    this.#permisos = permisoRepositorio;
    this.#catalogos = catalogoRepositorio;
    this.#usuarios = usuarioRepositorio;
    this.#usuarioService = usuarioService;
    this.#tasas = tasaComisionRepositorio;
    this.#reloj = reloj;
  }

  async inicializar({ zonas = [], categorias = [], tasaGeneral = null, administrador = null } = {}) {
    const creados = { patentes: 0, familias: 0, administrador: false };
    let arbol = await this.#permisos.obtenerTodos();

    for (const [codigo, nombre] of Object.entries(DESCRIPCION_PATENTE)) {
      if (!arbol.has(codigo)) {
        await this.#permisos.guardar(new Patente({ codigo, nombre }));
        creados.patentes += 1;
      }
    }

    arbol = await this.#permisos.obtenerTodos();
    for (const definicion of FAMILIAS_INICIALES) {
      if (arbol.has(definicion.codigo)) continue;
      const familia = new Familia({ codigo: definicion.codigo, nombre: definicion.nombre });
      for (const hijo of definicion.hijos) familia.agregar(arbol.get(hijo));
      await this.#permisos.guardar(familia);
      arbol.set(familia.codigo, familia);
      creados.familias += 1;
    }

    await this.#catalogos.asegurarFilas('zona', zonas);
    await this.#catalogos.asegurarFilas('categoria_oficio', categorias);

    // RN-K01: comisión general inicial.
    if (this.#tasas && tasaGeneral !== null && !(await this.#tasas.obtenerGeneral())) {
      await this.#tasas.guardar(new TasaComision({ porcentaje: tasaGeneral, fechaActualizacion: this.#reloj.ahora() }));
    }

    if (administrador?.email && !(await this.#usuarios.existeEmail(administrador.email))) {
      await this.#usuarioService.crearAdministrador(administrador, null);
      creados.administrador = true;
    }
    return creados;
  }
}
