import { Router } from 'express';
import { PATENTE } from '../dominio/seguridad/permisosDelSistema.js';
import { Turno } from '../dominio/contratacion/catalogos.js';
import { MotivoDenuncia } from '../dominio/valoraciones/catalogos.js';
import { autenticar, requierePermiso } from './middlewares/autenticar.js';
import { asincrono } from './middlewares/manejarErrores.js';
import { limitarIntentos } from './middlewares/limitarIntentos.js';
import { AutenticacionController } from './controladores/AutenticacionController.js';
import { UsuarioController } from './controladores/UsuarioController.js';
import { SeguridadController } from './controladores/SeguridadController.js';
import {
  BusquedaController, ContratacionController, AgendaController, MensajeriaController, ValoracionController, MonetizacionController,
} from './controladores/NegocioController.js';

export function crearRutas({ servicios, repositorios }) {
  const rutas = Router();
  const sesion = autenticar(servicios.autenticacion);
  const permiso = (codigo) => requierePermiso(codigo, servicios.bitacora);
  const a = asincrono;

  const auth = new AutenticacionController(servicios);
  const usuarios = new UsuarioController(servicios);
  const seguridad = new SeguridadController(servicios);

  // ---- Públicas ----
  rutas.post('/auth/login', limitarIntentos(), a(auth.iniciarSesion));
  rutas.post('/usuarios/clientes', limitarIntentos({ maximo: 5 }), a(usuarios.registrarCliente));
  rutas.post('/usuarios/prestadores', limitarIntentos({ maximo: 5 }), a(usuarios.registrarPrestador));
  rutas.get('/catalogos/zonas', a(async (_req, res) => res.json(await repositorios.catalogoRepositorio.listarZonas())));
  rutas.get('/catalogos/categorias', a(async (_req, res) => res.json(await repositorios.catalogoRepositorio.listarCategorias())));
  rutas.get('/catalogos/turnos', (_req, res) => res.json(Turno.valores()));
  rutas.get('/catalogos/motivos-denuncia', (_req, res) => res.json(MotivoDenuncia.valores()));

  // ---- Con sesión ----
  rutas.post('/auth/logout', sesion, a(auth.cerrarSesion));
  rutas.get('/auth/yo', sesion, a(auth.perfil));
  rutas.put('/auth/contrasena', sesion, a(auth.cambiarContrasena));

  // ---- Usuarios (USUARIO_GESTIONAR) ----
  rutas.get('/usuarios', sesion, permiso(PATENTE.USUARIO_GESTIONAR), a(usuarios.listar));
  rutas.post('/usuarios/administradores', sesion, permiso(PATENTE.USUARIO_GESTIONAR), a(usuarios.crearAdministrador));
  rutas.post('/usuarios/:id/desbloquear', sesion, permiso(PATENTE.USUARIO_GESTIONAR), a(usuarios.desbloquear));
  rutas.post('/usuarios/:id/bloquear', sesion, permiso(PATENTE.USUARIO_GESTIONAR), a(usuarios.bloquear));
  rutas.delete('/usuarios/:id', sesion, permiso(PATENTE.USUARIO_GESTIONAR), a(usuarios.darDeBaja));

  // ---- Permisos (PERMISO_GESTIONAR) ----
  rutas.get('/seguridad/permisos', sesion, permiso(PATENTE.PERMISO_GESTIONAR), a(seguridad.listarPermisos));
  rutas.post('/seguridad/familias', sesion, permiso(PATENTE.PERMISO_GESTIONAR), a(seguridad.crearFamilia));
  rutas.post('/seguridad/familias/:codigo/hijos', sesion, permiso(PATENTE.PERMISO_GESTIONAR), a(seguridad.agregarHijo));
  rutas.delete('/seguridad/familias/:codigo/hijos/:hijo', sesion, permiso(PATENTE.PERMISO_GESTIONAR), a(seguridad.quitarHijo));
  rutas.post('/usuarios/:id/permisos', sesion, permiso(PATENTE.PERMISO_GESTIONAR), a(usuarios.asignarPermiso));
  rutas.delete('/usuarios/:id/permisos/:codigo', sesion, permiso(PATENTE.PERMISO_GESTIONAR), a(usuarios.quitarPermiso));

  // ---- Bitácora, integridad y backups ----
  rutas.get('/seguridad/bitacora', sesion, permiso(PATENTE.BITACORA_VER), a(seguridad.consultarBitacora));
  rutas.get('/seguridad/integridad', sesion, permiso(PATENTE.INTEGRIDAD_GESTIONAR), a(seguridad.verificarIntegridad));
  rutas.post('/seguridad/integridad/recalcular', sesion, permiso(PATENTE.INTEGRIDAD_GESTIONAR), a(seguridad.recalcularIntegridad));
  rutas.get('/seguridad/backups', sesion, permiso(PATENTE.BACKUP_GESTIONAR), a(seguridad.listarBackups));
  rutas.post('/seguridad/backups', sesion, permiso(PATENTE.BACKUP_GESTIONAR), a(seguridad.realizarBackup));
  rutas.post('/seguridad/backups/:nombre/restaurar', sesion, permiso(PATENTE.BACKUP_GESTIONAR), a(seguridad.restaurarBackup));

  // =============== Iteración 2 – Búsqueda (RF03) ===============
  const busqueda = new BusquedaController(servicios);
  rutas.get('/prestadores', sesion, permiso(PATENTE.PRESTADOR_BUSCAR), a(busqueda.buscar));
  rutas.get('/prestadores/:id', sesion, permiso(PATENTE.PRESTADOR_BUSCAR), a(busqueda.perfil));
  rutas.get('/prestadores/:id/resenas', sesion, permiso(PATENTE.PRESTADOR_BUSCAR), a(busqueda.resenas));

  // =============== Iteración 3 – Contratación (RF04, RF05, RF11) ===============
  const contratacion = new ContratacionController(servicios);
  const verSolicitudes = permiso([PATENTE.SOLICITUD_CREAR, PATENTE.PRESUPUESTO_EMITIR]);
  rutas.post('/solicitudes', sesion, permiso(PATENTE.SOLICITUD_CREAR), a(contratacion.solicitar));
  rutas.get('/solicitudes', sesion, verSolicitudes, a(contratacion.listarSolicitudes));
  rutas.get('/solicitudes/:id', sesion, verSolicitudes, a(contratacion.obtenerSolicitud));
  rutas.post('/solicitudes/:id/cancelar', sesion, permiso(PATENTE.SOLICITUD_CANCELAR), a(contratacion.cancelarSolicitud));
  rutas.post('/solicitudes/:id/presupuestos', sesion, permiso(PATENTE.PRESUPUESTO_EMITIR), a(contratacion.emitirPresupuesto));
  rutas.post('/presupuestos/:id/aceptar', sesion, permiso(PATENTE.PRESUPUESTO_RESPONDER), a(contratacion.aceptarPresupuesto));
  rutas.post('/presupuestos/:id/rechazar', sesion, permiso(PATENTE.PRESUPUESTO_RESPONDER), a(contratacion.rechazarPresupuesto));
  const verOrdenes = permiso([PATENTE.ORDEN_CONFIRMAR, PATENTE.ORDEN_EJECUTAR]);
  rutas.get('/ordenes', sesion, verOrdenes, a(contratacion.listarOrdenes));
  rutas.get('/ordenes/:id', sesion, verOrdenes, a(contratacion.obtenerOrden));
  rutas.post('/ordenes/:id/iniciar', sesion, permiso(PATENTE.ORDEN_EJECUTAR), a(contratacion.iniciar));
  rutas.post('/ordenes/:id/interrumpir', sesion, permiso(PATENTE.ORDEN_EJECUTAR), a(contratacion.interrumpir));
  rutas.post('/ordenes/:id/reanudar', sesion, permiso(PATENTE.ORDEN_EJECUTAR), a(contratacion.reanudar));
  rutas.post('/ordenes/:id/finalizar', sesion, permiso(PATENTE.ORDEN_EJECUTAR), a(contratacion.finalizar));
  rutas.post('/ordenes/:id/confirmar', sesion, permiso(PATENTE.ORDEN_CONFIRMAR), a(contratacion.confirmar));
  rutas.post('/ordenes/:id/cancelar', sesion, permiso(PATENTE.SOLICITUD_CANCELAR), a(contratacion.cancelarOrden));

  // =============== Iteración 4 – Agenda e historial (RF07, RF08) ===============
  const agenda = new AgendaController(servicios);
  rutas.get('/agenda', sesion, permiso(PATENTE.AGENDA_GESTIONAR), a(agenda.agenda));
  rutas.put('/agenda/disponibilidad', sesion, permiso(PATENTE.AGENDA_GESTIONAR), a(agenda.disponibilidad));
  rutas.get('/historial', sesion, permiso(PATENTE.HISTORIAL_VER), a(agenda.historial));

  // =============== Iteración 5 – Mensajería (RF06) y notificaciones (RF11) ===============
  const mensajeria = new MensajeriaController(servicios);
  rutas.get('/solicitudes/:id/mensajes', sesion, permiso(PATENTE.MENSAJE_ENVIAR), a(mensajeria.conversacion));
  rutas.post('/solicitudes/:id/mensajes', sesion, permiso(PATENTE.MENSAJE_ENVIAR), a(mensajeria.enviar));
  rutas.get('/notificaciones', sesion, a(mensajeria.notificaciones));
  rutas.post('/notificaciones/:id/leer', sesion, a(mensajeria.leerNotificacion));

  // =============== Iteración 6 – Valoraciones (RF09, RF12) ===============
  const valoraciones = new ValoracionController(servicios);
  rutas.post('/ordenes/:id/resena', sesion, permiso(PATENTE.RESENA_REGISTRAR), a(valoraciones.evaluar));
  rutas.get('/resenas/recibidas', sesion, permiso(PATENTE.RESENA_DENUNCIAR), a(valoraciones.recibidas));
  rutas.post('/resenas/:id/denuncias', sesion, permiso(PATENTE.RESENA_DENUNCIAR), a(valoraciones.denunciar));
  rutas.get('/denuncias', sesion, permiso(PATENTE.DENUNCIA_MODERAR), a(valoraciones.pendientes));
  rutas.post('/denuncias/:id/resolver', sesion, permiso(PATENTE.DENUNCIA_MODERAR), a(valoraciones.moderar));

  // =============== Iteraciones 7 y 8 – Monetización (RF10, RF13, RF14) ===============
  const monetizacion = new MonetizacionController(servicios);
  rutas.get('/comisiones/tasas', sesion, permiso(PATENTE.COMISION_CONFIGURAR), a(monetizacion.tasas));
  rutas.put('/comisiones/tasas', sesion, permiso(PATENTE.COMISION_CONFIGURAR), a(monetizacion.configurarTasa));
  rutas.get('/comisiones/balance', sesion, permiso(PATENTE.BALANCE_VER), a(monetizacion.balancePropio));
  rutas.get('/comisiones/prestadores/:id', sesion, permiso(PATENTE.COMISION_CONFIGURAR), a(monetizacion.balance));
  rutas.post('/comisiones/prestadores/:id/liquidar', sesion, permiso(PATENTE.COMISION_CONFIGURAR), a(monetizacion.liquidar));
  rutas.get('/reportes/indicadores', sesion, permiso(PATENTE.REPORTES_VER), a(monetizacion.indicadores));
  rutas.get('/reportes/ingresos', sesion, permiso(PATENTE.REPORTES_VER), a(monetizacion.ingresos));
  rutas.get('/planes', sesion, permiso(PATENTE.PLAN_GESTIONAR), a(monetizacion.planes));
  rutas.post('/suscripciones', sesion, permiso(PATENTE.PLAN_GESTIONAR), a(monetizacion.contratar));
  rutas.get('/suscripciones', sesion, permiso(PATENTE.PLAN_GESTIONAR), a(monetizacion.misSuscripciones));
  rutas.get('/suscripciones/panel', sesion, permiso(PATENTE.PLAN_GESTIONAR), a(monetizacion.panel));

  return rutas;
}
