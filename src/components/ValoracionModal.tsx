import { useState } from "react";
import styles from "@/styles/modal.module.scss";

interface ValoracionModalProps {
  orden: {
    id: string;
    prestadorNombre: string;
  };
  onClose: () => void;
  onSubmitRating: (ordenId: string, estrellas: number, comentario: string) => void;
}

export default function ValoracionModal({
  orden,
  onClose,
  onSubmitRating,
}: ValoracionModalProps) {
  const [estrellas, setEstrellas] = useState(5);
  const [comentario, setComentario] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (estrellas < 1 || estrellas > 5) return;
    onSubmitRating(orden.id, estrellas, comentario);
    onClose();
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3>Calificar Servicio de {orden.prestadorNombre}</h3>
          <button className={styles.btnClose} onClick={onClose} aria-label="Cerrar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.ratingCenterContainer}>
            <label className={styles.ratingLabel}>
              ¿Cómo evaluarías el trabajo técnico?
            </label>
            <div className={styles.starRating}>
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`${styles.star} ${star <= estrellas ? styles.filled : ""}`}
                  onClick={() => setEstrellas(star)}
                >
                  ★
                </span>
              ))}
            </div>
            <strong className={styles.ratingAverageText}>
              {estrellas} {estrellas === 1 ? "Estrella" : "Estrellas"}
            </strong>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="rating-comment">Comentarios (máximo 500 caracteres)</label>
            <textarea
              id="rating-comment"
              placeholder="Describe tu experiencia con el técnico..."
              value={comentario}
              maxLength={500}
              onChange={(e) => setComentario(e.target.value)}
              className={styles.textareaTall}
            />
            <span className={styles.charCounter}>
              {comentario.length} / 500 caracteres
            </span>
          </div>

          <button type="submit" className={styles.btnPrimaryFull}>
            Enviar Calificación
          </button>
        </form>
      </div>
    </div>
  );
}
