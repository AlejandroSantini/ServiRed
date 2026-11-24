/**
 * Patentes del sistema (una por operación protegida) y familias iniciales.
 * Las patentes las define el código; el administrador arma y modifica las familias.
 * Cada patente se relaciona con el requerimiento que protege.
 */
export const PATENTE = Object.freeze({
  // Perfil y búsqueda (RF01 a RF03)
  PERFIL_EDITAR: 'PERFIL_EDITAR',
  PRESTADOR_BUSCAR: 'PRESTADOR_BUSCAR',
  // Contratación (RF04, RF05, RF11) – Iteración 3
  SOLICITUD_CREAR: 'SOLICITUD_CREAR',
  SOLICITUD_CANCELAR: 'SOLICITUD_CANCELAR',
  PRESUPUESTO_EMITIR: 'PRESUPUESTO_EMITIR',
  PRESUPUESTO_RESPONDER: 'PRESUPUESTO_RESPONDER',
  ORDEN_EJECUTAR: 'ORDEN_EJECUTAR',
  ORDEN_CONFIRMAR: 'ORDEN_CONFIRMAR',
  // Coordinación (RF06 a RF08)
  MENSAJE_ENVIAR: 'MENSAJE_ENVIAR',
  AGENDA_GESTIONAR: 'AGENDA_GESTIONAR',
  HISTORIAL_VER: 'HISTORIAL_VER',
  // Valoraciones (RF09, RF12) – Iteración 6
  RESENA_REGISTRAR: 'RESENA_REGISTRAR',
  RESENA_DENUNCIAR: 'RESENA_DENUNCIAR',
  DENUNCIA_MODERAR: 'DENUNCIA_MODERAR',
  // Reportes y monetización (RF10, RF13, RF14)
  REPORTES_VER: 'REPORTES_VER',
  COMISION_CONFIGURAR: 'COMISION_CONFIGURAR',
  BALANCE_VER: 'BALANCE_VER',
  PLAN_GESTIONAR: 'PLAN_GESTIONAR',
  // Módulo de seguridad (RNF03)
  USUARIO_GESTIONAR: 'USUARIO_GESTIONAR',
  PERMISO_GESTIONAR: 'PERMISO_GESTIONAR',
  BITACORA_VER: 'BITACORA_VER',
  INTEGRIDAD_GESTIONAR: 'INTEGRIDAD_GESTIONAR',
  BACKUP_GESTIONAR: 'BACKUP_GESTIONAR',
});

export const DESCRIPCION_PATENTE = Object.freeze({
  PERFIL_EDITAR: 'Editar el perfil propio',
  PRESTADOR_BUSCAR: 'Buscar prestadores',
  SOLICITUD_CREAR: 'Crear solicitudes de presupuesto',
  SOLICITUD_CANCELAR: 'Cancelar solicitudes y órdenes propias',
  PRESUPUESTO_EMITIR: 'Emitir presupuestos',
  PRESUPUESTO_RESPONDER: 'Aceptar o rechazar presupuestos',
  ORDEN_EJECUTAR: 'Iniciar, interrumpir y finalizar órdenes',
  ORDEN_CONFIRMAR: 'Confirmar la finalización de órdenes',
  MENSAJE_ENVIAR: 'Enviar mensajes internos',
  AGENDA_GESTIONAR: 'Gestionar la agenda',
  HISTORIAL_VER: 'Ver el historial de servicios',
  RESENA_REGISTRAR: 'Valorar órdenes finalizadas',
  RESENA_DENUNCIAR: 'Denunciar reseñas',
  DENUNCIA_MODERAR: 'Moderar denuncias',
  REPORTES_VER: 'Ver reportes e indicadores',
  COMISION_CONFIGURAR: 'Configurar y liquidar comisiones',
  BALANCE_VER: 'Ver el balance de comisiones propio',
  PLAN_GESTIONAR: 'Gestionar planes de visibilidad',
  USUARIO_GESTIONAR: 'Gestionar usuarios (alta, bloqueo, baja)',
  PERMISO_GESTIONAR: 'Gestionar familias y patentes',
  BITACORA_VER: 'Consultar la bitácora',
  INTEGRIDAD_GESTIONAR: 'Verificar y recalcular dígitos verificadores',
  BACKUP_GESTIONAR: 'Realizar y restaurar backups',
});

/** Orden de creación: una familia se crea después de las familias que contiene. */
export const FAMILIAS_INICIALES = Object.freeze([
  {
    codigo: 'FAM_CLIENTE',
    nombre: 'Cliente',
    hijos: ['PERFIL_EDITAR', 'PRESTADOR_BUSCAR', 'SOLICITUD_CREAR', 'SOLICITUD_CANCELAR', 'PRESUPUESTO_RESPONDER',
      'ORDEN_CONFIRMAR', 'MENSAJE_ENVIAR', 'HISTORIAL_VER', 'RESENA_REGISTRAR'],
  },
  {
    codigo: 'FAM_PRESTADOR',
    nombre: 'Prestador',
    hijos: ['PERFIL_EDITAR', 'PRESUPUESTO_EMITIR', 'ORDEN_EJECUTAR', 'SOLICITUD_CANCELAR', 'MENSAJE_ENVIAR',
      'AGENDA_GESTIONAR', 'HISTORIAL_VER', 'RESENA_DENUNCIAR', 'PLAN_GESTIONAR', 'BALANCE_VER'],
  },
  {
    codigo: 'FAM_SEGURIDAD',
    nombre: 'Seguridad',
    hijos: ['USUARIO_GESTIONAR', 'PERMISO_GESTIONAR', 'BITACORA_VER', 'INTEGRIDAD_GESTIONAR', 'BACKUP_GESTIONAR'],
  },
  {
    codigo: 'FAM_ADMINISTRADOR',
    nombre: 'Administrador',
    hijos: ['FAM_SEGURIDAD', 'PERFIL_EDITAR', 'DENUNCIA_MODERAR', 'REPORTES_VER', 'COMISION_CONFIGURAR'],
  },
]);

/** Familia que recibe cada tipo de usuario al darse de alta. */
export const FAMILIA_POR_ROL = Object.freeze({
  cliente: 'FAM_CLIENTE',
  prestador: 'FAM_PRESTADOR',
  administrador: 'FAM_ADMINISTRADOR',
});
