/** Implementaciones en memoria de los contratos de las Iteraciones 2 a 8. */
import { conFilasMemoria } from './conFilasMemoria.js';
import {
  SolicitudRepositorio, PresupuestoRepositorio, OrdenServicioRepositorio, NotificacionRepositorio, HistorialEstadoRepositorio,
} from '../contratos/contratacion.js';
import { ResenaRepositorio, DenunciaRepositorio, MensajeRepositorio } from '../contratos/valoracionesYMensajeria.js';
import {
  TasaComisionRepositorio, ComisionRepositorio, SuscripcionRepositorio, VisitaPerfilRepositorio, ReporteRepositorio,
} from '../contratos/monetizacion.js';

export class SolicitudRepositorioMemoria extends conFilasMemoria(SolicitudRepositorio) {}
export class PresupuestoRepositorioMemoria extends conFilasMemoria(PresupuestoRepositorio) {}
export class OrdenServicioRepositorioMemoria extends conFilasMemoria(OrdenServicioRepositorio) {}
export class NotificacionRepositorioMemoria extends conFilasMemoria(NotificacionRepositorio) {}
export class HistorialEstadoRepositorioMemoria extends conFilasMemoria(HistorialEstadoRepositorio) {}
export class ResenaRepositorioMemoria extends conFilasMemoria(ResenaRepositorio) {}
export class DenunciaRepositorioMemoria extends conFilasMemoria(DenunciaRepositorio) {}
export class MensajeRepositorioMemoria extends conFilasMemoria(MensajeRepositorio) {}
export class TasaComisionRepositorioMemoria extends conFilasMemoria(TasaComisionRepositorio) {}
export class ComisionRepositorioMemoria extends conFilasMemoria(ComisionRepositorio) {}
export class SuscripcionRepositorioMemoria extends conFilasMemoria(SuscripcionRepositorio) {}
export class VisitaPerfilRepositorioMemoria extends conFilasMemoria(VisitaPerfilRepositorio) {}
export class ReporteRepositorioMemoria extends conFilasMemoria(ReporteRepositorio) {}
