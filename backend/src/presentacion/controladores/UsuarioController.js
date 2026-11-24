export class UsuarioController {
  #usuarios;
  #permisos;

  constructor({ usuarios, permisos }) {
    this.#usuarios = usuarios;
    this.#permisos = permisos;
  }

  registrarCliente = async (req, res) => {
    const usuario = await this.#usuarios.registrarCliente(req.body, { ip: req.ip });
    res.status(201).json(usuario.perfilPropio());
  };

  registrarPrestador = async (req, res) => {
    const usuario = await this.#usuarios.registrarPrestador(req.body, { ip: req.ip });
    res.status(201).json(usuario.perfilPropio());
  };

  crearAdministrador = async (req, res) => {
    const usuario = await this.#usuarios.crearAdministrador(req.body, req.usuario, { ip: req.ip });
    res.status(201).json(usuario.datosPublicos());
  };

  listar = async (_req, res) => {
    res.json(await this.#usuarios.listar());
  };

  desbloquear = async (req, res) => {
    res.json(await this.#usuarios.desbloquear(idDe(req), req.usuario, { ip: req.ip }));
  };

  bloquear = async (req, res) => {
    res.json(await this.#usuarios.bloquear(idDe(req), req.usuario, { ip: req.ip }));
  };

  darDeBaja = async (req, res) => {
    res.json(await this.#usuarios.darDeBaja(idDe(req), req.usuario, { ip: req.ip }));
  };

  asignarPermiso = async (req, res) => {
    res.json(await this.#permisos.asignarAUsuario(idDe(req), req.body?.codigo, req.usuario, { ip: req.ip }));
  };

  quitarPermiso = async (req, res) => {
    res.json(await this.#permisos.quitarAUsuario(idDe(req), req.params.codigo, req.usuario, { ip: req.ip }));
  };
}

function idDe(req) {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : -1;
}
