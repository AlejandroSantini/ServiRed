/** Implementaciones PostgreSQL de los contratos de las Iteraciones 2 a 8. */
import { conFilasPostgres } from './conFilasPostgres.js';
import {
  SolicitudRepositorio, PresupuestoRepositorio, OrdenServicioRepositorio, NotificacionRepositorio, HistorialEstadoRepositorio,
} from '../contratos/contratacion.js';
import { ResenaRepositorio, DenunciaRepositorio, MensajeRepositorio } from '../contratos/valoracionesYMensajeria.js';
import {
  TasaComisionRepositorio, ComisionRepositorio, SuscripcionRepositorio, VisitaPerfilRepositorio, ReporteRepositorio,
} from '../contratos/monetizacion.js';

export class SolicitudRepositorioPostgres extends conFilasPostgres(SolicitudRepositorio) {}
export class PresupuestoRepositorioPostgres extends conFilasPostgres(PresupuestoRepositorio) {}
export class OrdenServicioRepositorioPostgres extends conFilasPostgres(OrdenServicioRepositorio) {}
export class NotificacionRepositorioPostgres extends conFilasPostgres(NotificacionRepositorio) {}
export class HistorialEstadoRepositorioPostgres extends conFilasPostgres(HistorialEstadoRepositorio) {}
export class ResenaRepositorioPostgres extends conFilasPostgres(ResenaRepositorio) {}
export class DenunciaRepositorioPostgres extends conFilasPostgres(DenunciaRepositorio) {}
export class MensajeRepositorioPostgres extends conFilasPostgres(MensajeRepositorio) {}
export class TasaComisionRepositorioPostgres extends conFilasPostgres(TasaComisionRepositorio) {}
export class ComisionRepositorioPostgres extends conFilasPostgres(ComisionRepositorio) {}
export class SuscripcionRepositorioPostgres extends conFilasPostgres(SuscripcionRepositorio) {}
export class VisitaPerfilRepositorioPostgres extends conFilasPostgres(VisitaPerfilRepositorio) {}
export class ReporteRepositorioPostgres extends conFilasPostgres(ReporteRepositorio) {}
