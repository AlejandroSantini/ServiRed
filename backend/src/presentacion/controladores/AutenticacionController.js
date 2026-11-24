/** Recibe el pedido, toma el usuario logueado y llama al servicio. Sin reglas de negocio. */
export class AutenticacionController {
  #autenticacion;

  constructor({ autenticacion }) {
    this.#autenticacion = autenticacion;
  }

  iniciarSesion = async (req, res) => {
    const { email, contrasena } = req.body ?? {};
    res.json(await this.#autenticacion.iniciarSesion({ email, contrasena, ip: req.ip }));
  };

  cerrarSesion = async (req, res) => {
    await this.#autenticacion.cerrarSesion(req.sesion, req.usuario, { ip: req.ip });
    res.sendStatus(204);
  };

  perfil = async (req, res) => {
    res.json(req.usuario.perfilPropio());
  };

  cambiarContrasena = async (req, res) => {
    const { actual, nueva } = req.body ?? {};
    await this.#autenticacion.cambiarContrasena(req.usuario, { actual, nueva }, { ip: req.ip });
    res.sendStatus(204);
  };
}
