import styles from "@/styles/sidebar.module.scss";

interface SidebarProps {
  role: "cliente" | "prestador";
  prestador: {
    id: string;
    nombre: string;
    especialidad: string;
    ciudad: string;
    reputacionPromedio: number;
    totalCalificaciones: number;
  };
  onPublishClick: () => void;
}

export default function Sidebar({
  role,
  prestador,
  onPublishClick,
}: SidebarProps) {
  if (role === "cliente") {
    return (
      <aside className={styles.sidebarCard}>
        <h3>Mi Cuenta Cliente</h3>
        <div className={styles.profileInfo}>
          <div className={styles.statRow}>
            <span>Nombre:</span>
            <strong>Alejandro Santini</strong>
          </div>
          <div className={styles.statRow}>
            <span>Ubicación:</span>
            <strong>Rosario</strong>
          </div>
          <div className={styles.statRow}>
            <span>Rol:</span>
            <strong>Contratante</strong>
          </div>
          
          <button 
            type="button" 
            className={styles.btnPrimary} 
            onClick={onPublishClick}
          >
            Publicar Nueva Solicitud
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className={styles.sidebarCard}>
      <h3>Perfil del Prestador</h3>
      {prestador && (
        <div className={styles.profileInfo}>
          <div className={styles.statRow}>
            <span>Nombre:</span>
            <span>{prestador.nombre}</span>
          </div>
          <div className={styles.statRow}>
            <span>Especialidad:</span>
            <span>{prestador.especialidad}</span>
          </div>
          <div className={styles.statRow}>
            <span>Ubicación:</span>
            <span>{prestador.ciudad}</span>
          </div>
          <div className={styles.statRow}>
            <span>Calificaciones:</span>
            <span>{prestador.totalCalificaciones}</span>
          </div>
          <div className={styles.starsAverage}>
            Calificación: {prestador.reputacionPromedio.toFixed(1)} / 5.0
          </div>
        </div>
      )}
    </aside>
  );
}
