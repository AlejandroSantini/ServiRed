import { useState } from "react";
import styles from "@/styles/modal.module.scss";

interface PresupuestoModalProps {
  solicitud: {
    id: string;
    titulo: string;
  };
  onClose: () => void;
  onSubmitBudget: (solicitudId: string, monto: number, detalles: string, validezPreset: string) => void;
}

export default function PresupuestoModal({
  solicitud,
  onClose,
  onSubmitBudget,
}: PresupuestoModalProps) {
  const [monto, setMonto] = useState("");
  const [detalles, setDetalles] = useState("");
  const [validezPreset, setValidezPreset] = useState("five_days");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!monto || !detalles.trim()) return;
    onSubmitBudget(solicitud.id, parseFloat(monto), detalles, validezPreset);
    onClose();
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3>Emitir Presupuesto</h3>
          <button className={styles.btnClose} onClick={onClose} aria-label="Cerrar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className={styles.modalSubtitle}>
          Propuesta para: <strong>{solicitud.titulo}</strong>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label htmlFor="modal-monto">Monto ($ ARS)</label>
            <input
              id="modal-monto"
              type="number"
              placeholder="Ej. 15000"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="modal-detalles">Detalles de lo que incluye el servicio</label>
            <textarea
              id="modal-detalles"
              placeholder="Describe qué incluye el presupuesto (materiales, mano de obra, tiempo de trabajo)..."
              value={detalles}
              onChange={(e) => setDetalles(e.target.value)}
              className={styles.textareaShort}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="modal-validez">Fecha de Validez de la Oferta</label>
            <select
              id="modal-validez"
              value={validezPreset}
              onChange={(e) => setValidezPreset(e.target.value)}
            >
              <option value="test_seconds">Vence en 10 segundos (para pruebas)</option>
              <option value="test_expired">Ya Vencido (para pruebas)</option>
              <option value="tomorrow">Vence Mañana</option>
              <option value="five_days">Vence en 5 días (Recomendado)</option>
            </select>
          </div>

          <button type="submit" className={styles.btnPrimaryFull}>
            Enviar Presupuesto
          </button>
        </form>
      </div>
    </div>
  );
}
