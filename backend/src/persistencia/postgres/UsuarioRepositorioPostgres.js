import { UsuarioRepositorio } from '../contratos/UsuarioRepositorio.js';
import { usuarioAFilas, filasAUsuario, TABLA_SUBTIPO } from '../mapeadores.js';
import { ReglaNegocioError } from '../../dominio/errores.js';
import { Usuario } from '../../dominio/usuarios/Usuario.js';

const VIOLACION_UNICA = '23505';

export class UsuarioRepositorioPostgres extends UsuarioRepositorio {
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
    const { rows } = await this.#bd.consultar('SELECT * FROM usuario WHERE id_usuario = $1', [Number(id)]);
    return rows[0] ? this.#reconstruir(rows[0]) : null;
  }

  async obtenerPorEmail(email) {
    const { rows } = await this.#bd.consultar('SELECT * FROM usuario WHERE email = $1', [String(email ?? '').trim().toLowerCase()]);
    return rows[0] ? this.#reconstruir(rows[0]) : null;
  }

  async existeEmail(email) {
    const { rows } = await this.#bd.consultar('SELECT 1 FROM usuario WHERE email = $1', [String(email ?? '').trim().toLowerCase()]);
    return rows.length > 0;
  }

  async listar() {
    const { rows } = await this.#bd.consultar('SELECT * FROM usuario ORDER BY id_usuario');
    return Promise.all(rows.map((f) => this.#reconstruir(f)));
  }

  async buscarPrestadores({ idCategoria = null, idZona = null, calificacionMinima = 0 }) {
    const { rows } = await this.#bd.consultar(
      `SELECT u.id_usuario
         FROM usuario u JOIN prestador p USING (id_usuario)
        WHERE u.rol = 'prestador' AND u.id_estado = 1 AND p.disponibilidad_activa
          AND p.reputacion_promedio >= $3
          AND ($1::int IS NULL OR EXISTS (SELECT 1 FROM prestador_categoria pc WHERE pc.id_prestador = u.id_usuario AND pc.id_categoria = $1))
          AND ($2::int IS NULL OR EXISTS (SELECT 1 FROM prestador_zona pz WHERE pz.id_prestador = u.id_usuario AND pz.id_zona = $2))
        ORDER BY u.id_usuario`,
      [idCategoria, idZona, calificacionMinima],
    );
    return Promise.all(rows.map((f) => this.obtenerPorId(f.id_usuario)));
  }

  async guardar(usuario) {
    if (!(usuario instanceof Usuario)) throw new TypeError('Se esperaba un Usuario.');
    try {
      return await this.#bd.transaccion((cx) => this.#integridad.conIntegridad(['usuario', 'usuario_permiso'], async () => {
        const filas = usuarioAFilas(usuario, this.#cifrador);
        const esNuevo = usuario.id === null;
        let filaUsuario;
        if (esNuevo) {
          filaUsuario = await this.#bd.insertar('usuario', { ...filas.usuario, id_usuario: undefined }, cx);
          usuario.asignarId(filaUsuario.id_usuario);
          await this.#bd.insertar(filas.subtipo.tabla, { ...filas.subtipo.fila, id_usuario: usuario.id }, cx);
        } else {
          filaUsuario = await this.#bd.actualizar('usuario', filas.usuario, ['id_usuario'], cx);
          await this.#bd.actualizar(filas.subtipo.tabla, filas.subtipo.fila, ['id_usuario'], cx);
        }
        // El DVH se calcula sobre lo que efectivamente quedó guardado.
        await this.#integridad.sellarFila('usuario', filaUsuario, cx);

        const id = usuario.id;
        if (usuario.rol === 'prestador') {
          await this.#reemplazarColeccion('prestador_zona', 'id_zona', id, filas.zonas, cx);
          await this.#reemplazarColeccion('prestador_categoria', 'id_categoria', id, filas.categorias, cx);
        }

        await this.#bd.consultar('DELETE FROM usuario_permiso WHERE id_usuario = $1', [id], cx);
        for (const idPermiso of filas.permisos) {
          const fila = await this.#bd.insertar('usuario_permiso', { id_usuario: id, id_permiso: idPermiso }, cx);
          await this.#integridad.sellarFila('usuario_permiso', fila, cx);
        }
        return usuario;
      }, cx));
    } catch (error) {
      if (error.code === VIOLACION_UNICA && error.constraint === 'uk_usuario_email') {
        throw new ReglaNegocioError('El correo ya está registrado.', 'RN-S02');
      }
      throw error;
    }
  }

  async #reemplazarColeccion(tabla, columna, idPrestador, ids, cx) {
    await this.#bd.consultar(`DELETE FROM ${tabla} WHERE id_prestador = $1`, [idPrestador], cx);
    for (const id of ids) await this.#bd.insertar(tabla, { id_prestador: idPrestador, [columna]: id }, cx);
  }

  async #reconstruir(fila) {
    const id = fila.id_usuario;
    const { rows: [subtipo] } = await this.#bd.consultar(`SELECT * FROM ${TABLA_SUBTIPO[fila.rol]} WHERE id_usuario = $1`, [id]);
    const { rows: filasPermiso } = await this.#bd.consultar('SELECT id_permiso FROM usuario_permiso WHERE id_usuario = $1', [id]);
    const permisos = await this.#permisos.obtenerPorIds(filasPermiso.map((f) => f.id_permiso));
    let zonas = [];
    let categorias = [];
    if (fila.rol === 'cliente') {
      zonas = await this.#catalogos.obtenerZonas([subtipo.id_zona]);
    } else if (fila.rol === 'prestador') {
      const { rows: z } = await this.#bd.consultar('SELECT id_zona FROM prestador_zona WHERE id_prestador = $1', [id]);
      const { rows: c } = await this.#bd.consultar('SELECT id_categoria FROM prestador_categoria WHERE id_prestador = $1', [id]);
      zonas = await this.#catalogos.obtenerZonas(z.map((f) => f.id_zona));
      categorias = await this.#catalogos.obtenerCategorias(c.map((f) => f.id_categoria));
    }
    return filasAUsuario({ fila, subtipo, zonas, categorias, permisos }, this.#cifrador);
  }
}
