/**
 * Raíz de composición: crea las implementaciones concretas y se las pasa a los
 * servicios por constructor. Los servicios solo conocen los contratos; cambiar
 * de memoria a PostgreSQL no toca ni el dominio ni la aplicación.
 */
import { HashContrasena } from './transversal/HashContrasena.js';
import { Cifrador } from './transversal/Cifrador.js';
import { DigitoVerificador } from './transversal/DigitoVerificador.js';
import { GestorTokens } from './transversal/GestorTokens.js';
import { relojSistema } from './transversal/reloj.js';
import { crearRepositoriosMemoria } from './persistencia/memoria/index.js';
import { BitacoraService } from './aplicacion/BitacoraService.js';
import { IntegridadService } from './aplicacion/IntegridadService.js';
import { AutenticacionService } from './aplicacion/AutenticacionService.js';
import { UsuarioService } from './aplicacion/UsuarioService.js';
import { PermisoService } from './aplicacion/PermisoService.js';
import { BackupService } from './aplicacion/BackupService.js';
import { InicializacionService } from './aplicacion/InicializacionService.js';
import { Notificador } from './aplicacion/Notificador.js';
import { NotificacionService } from './aplicacion/NotificacionService.js';
import { BusquedaService } from './aplicacion/BusquedaService.js';
import { ContratacionService } from './aplicacion/ContratacionService.js';
import { PlanificadorService } from './aplicacion/PlanificadorService.js';
import { AgendaService } from './aplicacion/AgendaService.js';
import { MensajeriaService } from './aplicacion/MensajeriaService.js';
import { ValoracionService } from './aplicacion/ValoracionService.js';
import { ComisionService } from './aplicacion/ComisionService.js';
import { ReporteService } from './aplicacion/ReporteService.js';
import { SuscripcionService } from './aplicacion/SuscripcionService.js';

/** @param opciones.pool  solo para pruebas: pool de PGlite (PostgreSQL embebido) */
export async function crearContenedor(config, { reloj = relojSistema, hasher = new HashContrasena(), pool } = {}) {
  const digitoVerificador = new DigitoVerificador(config.claves.integridad);
  const cifrador = new Cifrador(config.claves.cifrado);
  const tokens = new GestorTokens(config.claves.token);

  const repositorios = config.persistencia === 'postgres'
    ? (await import('./persistencia/postgres/index.js')).crearRepositoriosPostgres({ config, digitoVerificador, cifrador, pool })
    : crearRepositoriosMemoria({ digitoVerificador, cifrador });

  // ---- Seguridad e Iteración 1 ----
  const bitacora = new BitacoraService({ bitacoraRepositorio: repositorios.bitacoraRepositorio, reloj });
  const integridad = new IntegridadService({ integridadRepositorio: repositorios.integridadRepositorio, bitacora, reloj });
  const usuarios = new UsuarioService({ ...repositorios, hasher, bitacora, reloj });

  // ---- Iteraciones 2 a 8 ----
  const dependencias = { ...repositorios, bitacora, reloj };
  const notificador = new Notificador(repositorios);
  const comisiones = new ComisionService(dependencias);
  const contratacion = new ContratacionService({ ...dependencias, notificador, comisiones });

  const servicios = {
    bitacora,
    integridad,
    usuarios,
    autenticacion: new AutenticacionService({
      ...repositorios, hasher, tokens, bitacora, integridad, reloj, duracionSesionMs: config.duracionSesionMs,
    }),
    permisos: new PermisoService({ ...repositorios, bitacora }),
    backups: new BackupService({ ejecutorBackup: repositorios.ejecutorBackup, bitacora, integridad, reloj }),
    inicializacion: new InicializacionService({ ...repositorios, usuarioService: usuarios, reloj }),
    notificaciones: new NotificacionService(repositorios),
    busqueda: new BusquedaService(dependencias),
    contratacion,
    planificador: new PlanificadorService({ ...dependencias, notificador }),
    agenda: new AgendaService(dependencias),
    mensajeria: new MensajeriaService({ ...dependencias, notificador }),
    valoraciones: new ValoracionService({ ...dependencias, notificador, contratacion }),
    comisiones,
    reportes: new ReporteService(dependencias),
    suscripciones: new SuscripcionService(dependencias),
  };

  return { config, repositorios, servicios, cerrar: () => repositorios.cerrar() };
}
