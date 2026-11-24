/** Permisos, bitácora, integridad y backups (vistas del administrador). */
export class SeguridadController {
  #permisos;
  #bitacora;
  #integridad;
  #backups;

  constructor({ permisos, bitacora, integridad, backups }) {
    this.#permisos = permisos;
    this.#bitacora = bitacora;
    this.#integridad = integridad;
    this.#backups = backups;
  }

  listarPermisos = async (_req, res) => {
    res.json(await this.#permisos.listar());
  };

  crearFamilia = async (req, res) => {
    res.status(201).json(await this.#permisos.crearFamilia(req.body, req.usuario, { ip: req.ip }));
  };

  agregarHijo = async (req, res) => {
    res.json(await this.#permisos.agregarHijo(req.params.codigo, req.body?.codigo, req.usuario, { ip: req.ip }));
  };

  quitarHijo = async (req, res) => {
    res.json(await this.#permisos.quitarHijo(req.params.codigo, req.params.hijo, req.usuario, { ip: req.ip }));
  };

  consultarBitacora = async (req, res) => {
    res.json(await this.#bitacora.consultar(req.query));
  };

  verificarIntegridad = async (_req, res) => {
    res.json(await this.#integridad.verificar());
  };

  recalcularIntegridad = async (req, res) => {
    res.json(await this.#integridad.recalcular(req.usuario, { ip: req.ip }));
  };

  listarBackups = async (_req, res) => {
    res.json(await this.#backups.listar());
  };

  realizarBackup = async (req, res) => {
    res.status(201).json(await this.#backups.realizar(req.usuario, { ip: req.ip }));
  };

  restaurarBackup = async (req, res) => {
    res.json(await this.#backups.restaurar(req.params.nombre, req.usuario, { ip: req.ip }));
  };
}
