import { useState } from "react";
import styles from "@/styles/solicitudCard.module.scss";

interface PresupuestoData {
  id: string;
  solicitudId: string;
  prestadorId: string;
  prestadorNombre: string;
  monto: number;
  detalles: string;
  fechaValidez: Date | string;
  estadoNombre: string;
}

interface SolicitudCardProps {
  role: "cliente" | "prestador";
  solicitud: {
    id: string;
    clienteNombre: string;
    titulo: string;
    descripcion: string;
    categoria: string;
    fechaCreacion: Date | string;
    estadoNombre: string;
  };
  presupuestos: PresupuestoData[];
  prestadorId: string;
  onAceptarPresupuesto: (id: string) => void;
  onRechazarPresupuesto: (id: string) => void;
  onEmitirClick: (solicitud: any) => void;
}

export default function SolicitudCard({
  role,
  solicitud,
  presupuestos,
  prestadorId,
  onAceptarPresupuesto,
  onRechazarPresupuesto,
  onEmitirClick,
}: SolicitudCardProps) {
  const [showInactive, setShowInactive] = useState(false);

  const prestadorYaPresupuesto = presupuestos.some(
    (p) => p.prestadorId === prestadorId,
  );

  const estaExpirado = (fecha: Date | string) => {
    return new Date() > new Date(fecha);
  };

  // Separa presupuestos activos de inactivos
  const presupuestosProcesados = presupuestos.map((p) => ({
    ...p,
    vencido: estaExpirado(p.fechaValidez),
  }));

  const activos = presupuestosProcesados.filter(
    (p) => p.estadoNombre === "Emitido" && !p.vencido
  );

  const inactivos = presupuestosProcesados.filter(
    (p) => p.estadoNombre !== "Emitido" || p.vencido
  );

  // Encontrar el presupuesto más económico entre los activos
  let idMasEconomico = "";
  if (activos.length > 0) {
    const minMonto = Math.min(...activos.map((p) => p.monto));
    const masEconomico = activos.find((p) => p.monto === minMonto);
    if (masEconomico) {
      idMasEconomico = masEconomico.id;
    }
  }

  return (
    <div className={styles.solicitudDetailCard}>
      <div>
        {/* Detalle de la Solicitud */}
        <div className={styles.detailHeader}>
          <div className={styles.detailHeaderFlex}>
            <h3 className={styles.detailHeaderTitle}>{solicitud.titulo}</h3>
            <span className={`${styles.badge} ${styles[solicitud.estadoNombre.toLowerCase().replace(" ", "")]}`}>
              {solicitud.estadoNombre}
            </span>
          </div>
          <div className={styles.validityTextRow}>
            <span>Categoría: <strong>{solicitud.categoria}</strong></span>
            <span>•</span>
            <span>Cliente: <strong>{solicitud.clienteNombre}</strong></span>
            <span>•</span>
            <span>Publicado: <strong>{new Date(solicitud.fechaCreacion).toLocaleDateString()}</strong></span>
          </div>
        </div>

        <div className={styles.detailBodyContainer}>
          <p className={styles.requestDescription}>{solicitud.descripcion}</p>
        </div>

        {/* PRESUPUESTOS - SECCIÓN CLIENTE */}
        {role === "cliente" && (
          <div className={styles.budgetSection}>
            <h4 className={styles.sectionTitle}>
              Presupuestos Recibidos ({presupuestos.length})
            </h4>

            {presupuestos.length === 0 ? (
              <div className={styles.emptyStateContainer}>
                <p>No hay presupuestos recibidos para esta solicitud aún.</p>
              </div>
            ) : (
              <div className={styles.budgetsLayout}>
                {/* 1. Presupuestos Activos (Tabla Comparativa) */}
                {activos.length > 0 ? (
                  <div className={styles.comparisonTable}>
                    {/* Header */}
                    <div className={styles.comparisonHeader}>
                      <span>Proveedor</span>
                      <span>Detalles de la Oferta</span>
                      <span>Validez</span>
                      <span>Precio</span>
                      <span>Acción</span>
                    </div>
                    {/* Filas */}
                    {activos.map((of) => (
                      <div key={of.id} className={styles.comparisonRow}>
                        <div className={styles.cellProvider}>
                          <strong>{of.prestadorNombre}</strong>
                        </div>
                        <div className={styles.cellDetails}>
                          <p>{of.detalles}</p>
                        </div>
                        <div className={styles.cellValidity}>
                          <span>Validez: {new Date(of.fechaValidez).toLocaleDateString()}</span>
                        </div>
                        <div className={styles.cellPrice}>
                          <span className={styles.price}>
                            ${of.monto.toLocaleString()}
                          </span>
                          {of.id === idMasEconomico && (
                            <span className={styles.badgeEco}>Más Económico</span>
                          )}
                        </div>
                        <div className={styles.cellActions}>
                          <button
                            className={styles.btnPrimaryCompact}
                            onClick={() => onAceptarPresupuesto(of.id)}
                          >
                            Aceptar
                          </button>
                          <button
                            className={styles.btnDangerCompact}
                            onClick={() => onRechazarPresupuesto(of.id)}
                          >
                            Rechazar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  inactivos.length > 0 && (
                    <div className={styles.emptyStateContainer}>
                      <p>No hay ofertas activas. Revisa las ofertas inactivas o vencidas abajo.</p>
                    </div>
                  )
                )}

                {/* 2. Presupuestos Inactivos / Vencidos (Colapsable) */}
                {inactivos.length > 0 && (
                  <div className={styles.accordionContainer}>
                    <button
                      type="button"
                      className={styles.collapsibleHeader}
                      onClick={() => setShowInactive(!showInactive)}
                    >
                      {showInactive ? "Ocultar" : "Mostrar"} presupuestos vencidos o inactivos ({inactivos.length})
                    </button>

                    {showInactive && (
                      <div className={styles.accordionBody}>
                        <div className={styles.comparisonTable}>
                          {/* Header */}
                          <div className={styles.comparisonHeader}>
                            <span>Proveedor</span>
                            <span>Detalles de la Oferta</span>
                            <span>Validez</span>
                            <span>Precio</span>
                            <span>Estado</span>
                          </div>
                          {/* Filas */}
                          {inactivos.map((of) => (
                            <div key={of.id} className={`${styles.comparisonRow} ${styles.inactiveRow}`}>
                              <div className={styles.cellProvider}>
                                <strong>{of.prestadorNombre}</strong>
                              </div>
                              <div className={styles.cellDetails}>
                                <p>{of.detalles}</p>
                                {of.vencido && of.estadoNombre === "Emitido" && (
                                  <span className={styles.textVencidoWarning}>
                                    Presupuesto Expirado
                                  </span>
                                )}
                              </div>
                              <div className={styles.cellValidity}>
                                <span>Validez: {new Date(of.fechaValidez).toLocaleDateString()}</span>
                              </div>
                              <div className={styles.cellPrice}>
                                <span className={styles.price}>
                                  ${of.monto.toLocaleString()}
                                </span>
                              </div>
                              <div className={styles.cellActions}>
                                <span className={`${styles.badge} ${styles[of.estadoNombre.toLowerCase()]}`}>
                                  {of.estadoNombre}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* PRESUPUESTOS - SECCIÓN PRESTADOR */}
      {role === "prestador" && (
        <div className={styles.providerBudgetSection}>
          {prestadorYaPresupuesto ? (
            <div className={styles.badgePresupuestadoCentrado}>
              Ya enviaste un presupuesto para esta solicitud
            </div>
          ) : (
            <button
              className={styles.btnPrimaryFull}
              onClick={() => onEmitirClick(solicitud)}
            >
              Presupuestar Trabajo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
