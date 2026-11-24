import { UsuarioRepositorio } from '../contratos/UsuarioRepositorio.js';
import { usuarioAFilas, filasAUsuario, TABLA_SUBTIPO } from '../mapeadores.js';
import { ReglaNegocioError } from '../../dominio/errores.js';
import { Usuario } from '../../dominio/usuarios/Usuario.js';

export class UsuarioRepositorioMemoria extends UsuarioRepositorio {
  #bd;
  #integridad;
  #permisos;
  #catalogos;
  #cifrador;

  constructor({ bd, integridadRepositorio, permisoRepositorio, catalogoRepositorio, cifrador }) {
    super();
    this.#bd = bd;
    this.#integridad = integridadRepositorio;
    this.#permisos = permisoRepositorio;
    this.#catalogos = catalogoRepositorio;
    this.#cifrador = cifrador;
  }

  async obtenerPorId(id) {
    const [fila] = this.#bd.seleccionar('usuario', (f) => f.id_usuario === Number(id));
    return fila ? this.#reconstruir(fila) : null;
  }

  async obtenerPorEmail(email) {
    const normalizado = String(email ?? '').trim().toLowerCase();
    const [fila] = this.#bd.seleccionar('usuario', (f) => f.email === normalizado);
    return fila ? this.#reconstruir(fila) : null;
  }

  async existeEmail(email) {
    const normalizado = String(email ?? '').trim().toLowerCase();
    return this.#bd.tabla('usuario').some((f) => f.email === normalizado);
  }

  async listar() {
    const filas = this.#bd.seleccionar('usuario').sort((a, b) => a.id_usuario - b.id_usuario);
    return Promise.all(filas.map((f) => this.#reconstruir(f)));
  }

  async buscarPrestadores({ idCategoria = null, idZona = null, calificacionMinima = 0 }) {
    const filas = this.#bd.seleccionar('usuario', (f) => f.rol === 'prestador').sort((a, b) => a.id_usuario - b.id_usuario);
    const prestadores = await Promise.all(filas.map((f) => this.#reconstruir(f)));
    return prestadores.filter((p) => p.estaDisponible()
      && (!idCategoria || p.categorias.some((c) => c.id === idCategoria))
      && (!idZona || p.zonas.some((z) => z.id === idZona))
      && p.reputacionPromedio >= calificacionMinima);
  }

  async guardar(usuario) {
    if (!(usuario instanceof Usuario)) throw new TypeError('Se esperaba un Usuario.');
    return this.#integridad.conIntegridad(['usuario', 'usuario_permiso'], async () => {
      if (usuario.id === null) {
        // Simula la clave única de la base (RN-S02).
        if (await this.existeEmail(usuario.email)) throw new ReglaNegocioError('El correo ya está registrado.', 'RN-S02');
        usuario.asignarId(this.#bd.siguienteId('usuario'));
      }
      const id = usuario.id;
      const filas = usuarioAFilas(usuario, this.#cifrador);
      const porUsuario = (f) => f.id_usuario === id;

      this.#bd.reemplazar('usuario', porUsuario, [{ ...filas.usuario, dvh: this.#integridad.calcularDVH('usuario', filas.usuario) }]);
      this.#bd.reemplazar(filas.subtipo.tabla, porUsuario, [filas.subtipo.fila]);

      if (usuario.rol === 'prestador') {
        this.#bd.reemplazar('prestador_zona', (f) => f.id_prestador === id, filas.zonas.map((idZona) => ({ id_prestador: id, id_zona: idZona })));
        this.#bd.reemplazar('prestador_categoria', (f) => f.id_prestador === id,
          filas.categorias.map((idCategoria) => ({ id_prestador: id, id_categoria: idCategoria })));
      }

      const filasPermiso = filas.permisos.map((idPermiso) => {
        const fila = { id_usuario: id, id_permiso: idPermiso };
        return { ...fila, dvh: this.#integridad.calcularDVH('usuario_permiso', fila) };
      });
      this.#bd.reemplazar('usuario_permiso', porUsuario, filasPermiso);
      return usuario;
    });
  }

  async #reconstruir(fila) {
    const id = fila.id_usuario;
    const [subtipo] = this.#bd.seleccionar(TABLA_SUBTIPO[fila.rol], (f) => f.id_usuario === id);
    const idsPermiso = this.#bd.seleccionar('usuario_permiso', (f) => f.id_usuario === id).map((f) => f.id_permiso);
    const permisos = await this.#permisos.obtenerPorIds(idsPermiso);
    let zonas = [];
    let categorias = [];
    if (fila.rol === 'cliente') {
      zonas = await this.#catalogos.obtenerZonas([subtipo.id_zona]);
    } else if (fila.rol === 'prestador') {
      zonas = await this.#catalogos.obtenerZonas(this.#bd.seleccionar('prestador_zona', (f) => f.id_prestador === id).map((f) => f.id_zona));
      categorias = await this.#catalogos.obtenerCategorias(
        this.#bd.seleccionar('prestador_categoria', (f) => f.id_prestador === id).map((f) => f.id_categoria));
    }
    return filasAUsuario({ fila, subtipo, zonas, categorias, permisos }, this.#cifrador);
  }
}
