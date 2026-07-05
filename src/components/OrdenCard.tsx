import styles from "@/styles/ordenCard.module.scss";

interface OrdenCardProps {
  role: "cliente" | "prestador";
  orden: {
    id: string;
    presupuestoId: string;
    solicitudId: string;
    prestadorId: string;
    prestadorNombre: string;
    monto: number;
    clienteNombre: string;
    tituloSolicitud: string;
    fechaCreacion: Date | string;
    estadoNombre: string;
    calificado: boolean;
    estrellas?: number;
    comentario?: string;
  };
  onCalificarClick: (orden: any) => void;
  onFinalizarClick: (id: string) => void;
}

export default function OrdenCard({
  role,
  orden,
  onCalificarClick,
  onFinalizarClick,
}: OrdenCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h4>{orden.tituloSolicitud}</h4>
        <span className={`${styles.badge} ${styles[orden.estadoNombre.toLowerCase()]}`}>
          {orden.estadoNombre}
        </span>
      </div>
      <div className={styles.cardBody}>
        <div className={styles.statRow}>
          <span>{role === "cliente" ? "Técnico:" : "Cliente:"}</span>
          <strong>{role === "cliente" ? orden.prestadorNombre : orden.clienteNombre}</strong>
        </div>
        <div className={styles.statRow}>
          <span>Cobro acordado:</span>
          <strong className={styles.price}>${orden.monto.toLocaleString()}</strong>
        </div>
        <div className={styles.statRow}>
          <span>Contratado el:</span>
          <span>{new Date(orden.fechaCreacion).toLocaleDateString()}</span>
        </div>

        {/* MUESTRA CALIFICACIÓN EXISTENTE */}
        {orden.calificado && (
          <div className={styles.commentBox}>
            <div>Calificación del cliente: {orden.estrellas} / 5</div>
            {orden.comentario && <div className={styles.commentText}>"{orden.comentario}"</div>}
          </div>
        )}

        {/* ACCIÓN PRESTADOR: FINALIZAR ORDEN */}
        {role === "prestador" && orden.estadoNombre === "Programada" && (
          <button
            className={styles.btnPrimaryFull}
            onClick={() => onFinalizarClick(orden.id)}
          >
            Finalizar Trabajo
          </button>
        )}

        {/* ACCIÓN CLIENTE: CALIFICAR ORDEN */}
        {role === "cliente" && orden.estadoNombre === "Finalizada" && !orden.calificado && (
          <button
            className={styles.btnPrimaryFull}
            onClick={() => onCalificarClick(orden)}
          >
            Calificar Técnico
          </button>
        )}
      </div>
    </div>
  );
}
