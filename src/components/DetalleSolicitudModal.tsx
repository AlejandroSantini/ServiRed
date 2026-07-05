import styles from "@/styles/modal.module.scss";
import SolicitudCard from "./SolicitudCard";

interface DetalleSolicitudModalProps {
  solicitud: {
    id: string;
    clienteNombre: string;
    titulo: string;
    descripcion: string;
    categoria: string;
    fechaCreacion: Date | string;
    estadoNombre: string;
  };
  presupuestos: Array<{
    id: string;
    solicitudId: string;
    prestadorId: string;
    prestadorNombre: string;
    monto: number;
    detalles: string;
    fechaValidez: Date | string;
    estadoNombre: string;
  }>;
  prestadorId: string;
  onAceptarPresupuesto: (id: string) => void;
  onRechazarPresupuesto: (id: string) => void;
  onClose: () => void;
}

export default function DetalleSolicitudModal({
  solicitud,
  presupuestos,
  prestadorId,
  onAceptarPresupuesto,
  onRechazarPresupuesto,
  onClose,
}: DetalleSolicitudModalProps) {
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContentLarge}>
        <div className={styles.modalHeader}>
          <h3>Detalles y Presupuestos</h3>
          <button className={styles.btnClose} onClick={onClose} aria-label="Cerrar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className={styles.modalBodyScroll}>
          <SolicitudCard
            role="cliente"
            solicitud={solicitud}
            presupuestos={presupuestos}
            prestadorId={prestadorId}
            onAceptarPresupuesto={(id) => {
              onAceptarPresupuesto(id);
              onClose();
            }}
            onRechazarPresupuesto={onRechazarPresupuesto}
            onEmitirClick={() => {}}
          />
        </div>
      </div>
    </div>
  );
}
