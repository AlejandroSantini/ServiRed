import { BaseDatosMemoria } from './BaseDatosMemoria.js';
import { IntegridadRepositorioMemoria } from './IntegridadRepositorioMemoria.js';
import { PermisoRepositorioMemoria } from './PermisoRepositorioMemoria.js';
import { CatalogoRepositorioMemoria } from './CatalogoRepositorioMemoria.js';
import { UsuarioRepositorioMemoria } from './UsuarioRepositorioMemoria.js';
import { SesionRepositorioMemoria } from './SesionRepositorioMemoria.js';
import { BitacoraRepositorioMemoria } from './BitacoraRepositorioMemoria.js';
import { EjecutorBackupMemoria } from './EjecutorBackupMemoria.js';
import { GestorTransaccionesMemoria } from './conFilasMemoria.js';
import * as negocio from './repositoriosNegocio.js';
import { armarRepositoriosNegocio } from '../armarRepositoriosNegocio.js';

export function crearRepositoriosMemoria({ digitoVerificador, cifrador }) {
  const bd = new BaseDatosMemoria();
  const integridadRepositorio = new IntegridadRepositorioMemoria({ bd, digitoVerificador });
  const permisoRepositorio = new PermisoRepositorioMemoria({ bd, integridadRepositorio });
  const catalogoRepositorio = new CatalogoRepositorioMemoria({ bd });
  const usuarioRepositorio = new UsuarioRepositorioMemoria({ bd, integridadRepositorio, permisoRepositorio, catalogoRepositorio, cifrador });
  return {
    bd,
    integridadRepositorio,
    permisoRepositorio,
    catalogoRepositorio,
    usuarioRepositorio,
    sesionRepositorio: new SesionRepositorioMemoria({ bd }),
    bitacoraRepositorio: new BitacoraRepositorioMemoria({ bd, integridadRepositorio }),
    ejecutorBackup: new EjecutorBackupMemoria({ bd }),
    ...armarRepositoriosNegocio({
      Solicitud: negocio.SolicitudRepositorioMemoria,
      Presupuesto: negocio.PresupuestoRepositorioMemoria,
      OrdenServicio: negocio.OrdenServicioRepositorioMemoria,
      Notificacion: negocio.NotificacionRepositorioMemoria,
      HistorialEstado: negocio.HistorialEstadoRepositorioMemoria,
      Resena: negocio.ResenaRepositorioMemoria,
      Denuncia: negocio.DenunciaRepositorioMemoria,
      Mensaje: negocio.MensajeRepositorioMemoria,
      TasaComision: negocio.TasaComisionRepositorioMemoria,
      Comision: negocio.ComisionRepositorioMemoria,
      Suscripcion: negocio.SuscripcionRepositorioMemoria,
      VisitaPerfil: negocio.VisitaPerfilRepositorioMemoria,
      Reporte: negocio.ReporteRepositorioMemoria,
      Transacciones: GestorTransaccionesMemoria,
    }, { bd, usuarioRepositorio, catalogoRepositorio, cifrador }),
    cerrar: async () => {},
  };
}
