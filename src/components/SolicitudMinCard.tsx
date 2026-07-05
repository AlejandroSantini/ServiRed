import styles from "@/styles/dashboard.module.scss";

interface SolicitudMinCardProps {
  solicitud: {
    id: string;
    titulo: string;
    categoria: string;
    fechaCreacion: string | Date;
    estadoNombre: string;
  };
  isActive: boolean;
  onClick: () => void;
}

export default function SolicitudMinCard({
  solicitud,
  isActive,
  onClick,
}: SolicitudMinCardProps) {
  return (
    <div
      className={`${styles.compactCard} ${isActive ? styles.activeCard : ""}`}
      onClick={onClick}
    >
      <div className={styles.compactCardHeader}>
        <h4>{solicitud.titulo}</h4>
        <span className={`${styles.badge} ${styles[solicitud.estadoNombre.toLowerCase().replace(" ", "")]}`}>
          {solicitud.estadoNombre}
        </span>
      </div>
      <div className={styles.compactCardMeta}>
        <span>Categoría: {solicitud.categoria}</span>
        <span>Publicado: {new Date(solicitud.fechaCreacion).toLocaleDateString()}</span>
      </div>
    </div>
  );
}
