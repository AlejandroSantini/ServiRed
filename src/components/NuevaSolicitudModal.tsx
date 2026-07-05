import { useState } from "react";
import styles from "@/styles/modal.module.scss";

interface NuevaSolicitudModalProps {
  onClose: () => void;
  onSubmitRequest: (titulo: string, descripcion: string, categoria: string) => void;
}

export default function NuevaSolicitudModal({
  onClose,
  onSubmitRequest,
}: NuevaSolicitudModalProps) {
  const [titulo, setTitulo] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState("Plomería");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !desc.trim()) return;
    onSubmitRequest(titulo, desc, cat);
    onClose();
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3>Publicar Solicitud</h3>
          <button className={styles.btnClose} onClick={onClose} aria-label="Cerrar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className={styles.modalSubtitle}>
          Ingresa los detalles técnicos del inconveniente para recibir presupuestos de profesionales en Rosario.
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label htmlFor="req-titulo">Título del problema</label>
            <input
              id="req-titulo"
              type="text"
              placeholder="Ej. Pérdida de agua bajo mesada"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="req-cat">Especialidad Requerida</label>
            <select
              id="req-cat"
              value={cat}
              onChange={(e) => setCat(e.target.value)}
            >
              <option value="Plomería">Plomería</option>
              <option value="Electricidad">Electricidad</option>
              <option value="Climatización">Climatización</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="req-desc">Detalles / Síntomas</label>
            <textarea
              id="req-desc"
              placeholder="Describe detalladamente el problema técnico..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className={styles.textareaTall}
              required
            />
          </div>

          <button type="submit" className={styles.btnPrimaryFull}>
            Publicar en Rosario
          </button>
        </form>
      </div>
    </div>
  );
}
