import styles from "@/styles/solicitudRow.module.scss";

interface PresupuestoData {
  id: string;
  solicitudId: string;
  prestadorId: string;
}

interface SolicitudRowProps {
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
  onEmitirClick: (solicitud: any) => void;
}

export default function SolicitudRow({
  solicitud,
  presupuestos,
  prestadorId,
  onEmitirClick,
}: SolicitudRowProps) {
  const prestadorYaPresupuesto = presupuestos.some(
    (p) => p.prestadorId === prestadorId
  );

  return (
    <div className={styles.listTableRow}>
      {/* Columna 1: Info Solicitud */}
      <div className={styles.colInfo}>
        <span className={styles.categoryBadge}>{solicitud.categoria}</span>
        <strong>{solicitud.titulo}</strong>
        <p className={styles.descTruncated}>{solicitud.descripcion}</p>
      </div>

      {/* Columna 2: Cliente */}
      <div className={styles.colMeta}>
        <span>Cliente: {solicitud.clienteNombre}</span>
        <span>Publicado: {new Date(solicitud.fechaCreacion).toLocaleDateString()}</span>
      </div>

      {/* Columna 3: Estado */}
      <div className={styles.colStatus}>
        <span className={`${styles.badge} ${styles[solicitud.estadoNombre.toLowerCase().replace(" ", "")]}`}>
          {solicitud.estadoNombre}
        </span>
      </div>

      {/* Columna 4: Acciones */}
      <div className={styles.colActions}>
        {prestadorYaPresupuesto ? (
          <span className={styles.badgePresupuestado}>
            Ya Presupuestado
          </span>
        ) : (
          <button
            className={styles.btnPrimaryCompact}
            onClick={() => onEmitirClick(solicitud)}
          >
            Presupuestar
          </button>
        )}
      </div>
    </div>
  );
}
