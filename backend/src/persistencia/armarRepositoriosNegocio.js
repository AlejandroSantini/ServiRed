/**
 * Arma los repositorios de las Iteraciones 2 a 8 con sus dependencias
 * (cada uno recibe los repositorios que necesita para reconstruir sus referencias).
 * Lo usan las dos implementaciones con sus clases concretas.
 */
export function armarRepositoriosNegocio(clases, { bd, usuarioRepositorio, catalogoRepositorio, cifrador }) {
  const solicitudRepositorio = new clases.Solicitud({ bd, usuarioRepositorio, catalogoRepositorio, cifrador });
  const presupuestoRepositorio = new clases.Presupuesto({ bd, solicitudRepositorio, usuarioRepositorio });
  const ordenServicioRepositorio = new clases.OrdenServicio({ bd, presupuestoRepositorio });
  const resenaRepositorio = new clases.Resena({ bd, ordenServicioRepositorio });
  return {
    solicitudRepositorio,
    presupuestoRepositorio,
    ordenServicioRepositorio,
    resenaRepositorio,
    notificacionRepositorio: new clases.Notificacion({ bd }),
    historialEstadoRepositorio: new clases.HistorialEstado({ bd }),
    denunciaRepositorio: new clases.Denuncia({ bd, resenaRepositorio, usuarioRepositorio }),
    mensajeRepositorio: new clases.Mensaje({ bd }),
    tasaComisionRepositorio: new clases.TasaComision({ bd, catalogoRepositorio }),
    comisionRepositorio: new clases.Comision({ bd, presupuestoRepositorio }),
    suscripcionRepositorio: new clases.Suscripcion({ bd }),
    visitaPerfilRepositorio: new clases.VisitaPerfil({ bd }),
    reporteRepositorio: new clases.Reporte({ bd }),
    transacciones: new clases.Transacciones({ bd }),
  };
}
