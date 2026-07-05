import styles from "@/styles/header.module.scss";

interface HeaderProps {
  role: "cliente" | "prestador";
  onChangeRole: (role: "cliente" | "prestador") => void;
}

export default function Header({ role, onChangeRole }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <h1>ServiRed</h1>
        <span>Intermediación Técnica • Rosario</span>
      </div>
      <div className={styles.roleSelector}>
        <button
          className={role === "cliente" ? styles.active : ""}
          onClick={() => onChangeRole("cliente")}
        >
          Modo Cliente
        </button>
        <button
          className={role === "prestador" ? styles.active : ""}
          onClick={() => onChangeRole("prestador")}
        >
          Modo Prestador
        </button>
      </div>
    </header>
  );
}
