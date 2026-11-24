import { BaseDatosPostgres } from './BaseDatosPostgres.js';
import { IntegridadRepositorioPostgres } from './IntegridadRepositorioPostgres.js';
import { PermisoRepositorioPostgres } from './PermisoRepositorioPostgres.js';
import { CatalogoRepositorioPostgres } from './CatalogoRepositorioPostgres.js';
import { UsuarioRepositorioPostgres } from './UsuarioRepositorioPostgres.js';
import { SesionRepositorioPostgres } from './SesionRepositorioPostgres.js';
import { BitacoraRepositorioPostgres } from './BitacoraRepositorioPostgres.js';
import { EjecutorBackupPostgres } from './EjecutorBackupPostgres.js';
import { GestorTransaccionesPostgres } from './conFilasPostgres.js';
import * as negocio from './repositoriosNegocio.js';
import { armarRepositoriosNegocio } from '../armarRepositoriosNegocio.js';

/** @param pool  opcional: pool alternativo (PGlite en las pruebas) */
export function crearRepositoriosPostgres({ config, digitoVerificador, cifrador, pool }) {
  const bd = new BaseDatosPostgres(config.urlBaseDatos, { pool });
  const integridadRepositorio = new IntegridadRepositorioPostgres({ bd, digitoVerificador });
  const permisoRepositorio = new PermisoRepositorioPostgres({ bd, integridadRepositorio });
  const catalogoRepositorio = new CatalogoRepositorioPostgres({ bd });
  const usuarioRepositorio = new UsuarioRepositorioPostgres({ bd, integridadRepositorio, permisoRepositorio, catalogoRepositorio, cifrador });
  return {
    bd,
    integridadRepositorio,
    permisoRepositorio,
    catalogoRepositorio,
    usuarioRepositorio,
    sesionRepositorio: new SesionRepositorioPostgres({ bd }),
    bitacoraRepositorio: new BitacoraRepositorioPostgres({ bd, integridadRepositorio }),
    ejecutorBackup: new EjecutorBackupPostgres({ urlBaseDatos: config.urlBaseDatos, ...config.backups }),
    ...armarRepositoriosNegocio({
      Solicitud: negocio.SolicitudRepositorioPostgres,
      Presupuesto: negocio.PresupuestoRepositorioPostgres,
      OrdenServicio: negocio.OrdenServicioRepositorioPostgres,
      Notificacion: negocio.NotificacionRepositorioPostgres,
      HistorialEstado: negocio.HistorialEstadoRepositorioPostgres,
      Resena: negocio.ResenaRepositorioPostgres,
      Denuncia: negocio.DenunciaRepositorioPostgres,
      Mensaje: negocio.MensajeRepositorioPostgres,
      TasaComision: negocio.TasaComisionRepositorioPostgres,
      Comision: negocio.ComisionRepositorioPostgres,
      Suscripcion: negocio.SuscripcionRepositorioPostgres,
      VisitaPerfil: negocio.VisitaPerfilRepositorioPostgres,
      Reporte: negocio.ReporteRepositorioPostgres,
      Transacciones: GestorTransaccionesPostgres,
    }, { bd, usuarioRepositorio, catalogoRepositorio, cifrador }),
    cerrar: () => bd.cerrar(),
  };
}
