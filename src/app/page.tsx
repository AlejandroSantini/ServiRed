"use client";

import { useState } from "react";
import styles from "@/styles/dashboard.module.scss";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import SolicitudCard from "@/components/SolicitudCard";
import SolicitudMinCard from "@/components/SolicitudMinCard";
import SolicitudRow from "@/components/SolicitudRow";
import OrdenCard from "@/components/OrdenCard";
import ValoracionModal from "@/components/ValoracionModal";
import PresupuestoModal from "@/components/PresupuestoModal";
import NuevaSolicitudModal from "@/components/NuevaSolicitudModal";
import DetalleSolicitudModal from "@/components/DetalleSolicitudModal";

// Initial Mock Data
const INITIAL_PRESTADORES = [
  {
    id: "p1",
    nombre: "Juan Pérez",
    especialidad: "Plomero Gasista",
    ciudad: "Rosario",
    reputacionPromedio: 4.8,
    totalCalificaciones: 12,
  },
  {
    id: "p2",
    nombre: "María Gómez",
    especialidad: "Electricista Matriculada",
    ciudad: "Rosario",
    reputacionPromedio: 4.5,
    totalCalificaciones: 8,
  },
  {
    id: "p3",
    nombre: "Carlos Rodríguez",
    especialidad: "Técnico de Aire Acondicionado",
    ciudad: "Rosario",
    reputacionPromedio: 4.9,
    totalCalificaciones: 15,
  },
];

const INITIAL_SOLICITUDES = [
  {
    id: "s1",
    clienteNombre: "Alejandro Santini",
    titulo: "Pérdida de agua bajo mesada",
    descripcion:
      "Tengo un goteo constante en la tubería de desagüe de la cocina. Necesito reparación urgente.",
    categoria: "Plomería",
    fechaCreacion: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    estadoNombre: "Con Presupuesto",
  },
  {
    id: "s2",
    clienteNombre: "Alejandro Santini",
    titulo: "Instalación de disyuntor y térmicas",
    descripcion:
      "Requiero renovación completa de la caja de luz e instalación de un disyuntor diferencial para seguridad.",
    categoria: "Electricidad",
    fechaCreacion: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    estadoNombre: "Abierta",
  },
];

const INITIAL_PRESUPUESTOS = [
  {
    id: "pr1",
    solicitudId: "s1",
    prestadorId: "p1",
    prestadorNombre: "Juan Pérez",
    monto: 15000,
    detalles:
      "Cambio de sifón de desagüe y sellado de conexiones con silicona premium. Incluye materiales.",
    fechaValidez: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // VENCIDO (Ayer)
    estadoNombre: "Emitido",
  },
  {
    id: "pr2",
    solicitudId: "s1",
    prestadorId: "p3",
    prestadorNombre: "Carlos Rodríguez",
    monto: 18000,
    detalles:
      "Revisión integral de cañería y reemplazo de tramos dañados con termofusión. 6 meses de garantía.",
    fechaValidez: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(), // VÁLIDO (4 días)
    estadoNombre: "Emitido",
  },
];

const INITIAL_ORDENES = [
  {
    id: "o1",
    presupuestoId: "pr_old",
    solicitudId: "s_old",
    prestadorId: "p2",
    prestadorNombre: "María Gómez",
    monto: 9500,
    clienteNombre: "Alejandro Santini",
    tituloSolicitud: "Instalación de reflectores LED exteriores",
    fechaCreacion: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    estadoNombre: "Finalizada", // Para probar calificación inmediatamente
    calificado: false,
    estrellas: undefined,
    comentario: undefined,
  },
  {
    id: "o2",
    presupuestoId: "pr_old2",
    solicitudId: "s_old2",
    prestadorId: "p1",
    prestadorNombre: "Juan Pérez",
    monto: 22000,
    clienteNombre: "Alejandro Santini",
    tituloSolicitud: "Reparación de calefón tiro balanceado",
    fechaCreacion: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    estadoNombre: "Programada", // Para probar finalización por técnico
    calificado: false,
    estrellas: undefined,
    comentario: undefined,
  },
];

interface Prestador {
  id: string;
  nombre: string;
  especialidad: string;
  ciudad: string;
  reputacionPromedio: number;
  totalCalificaciones: number;
}

interface Solicitud {
  id: string;
  clienteNombre: string;
  titulo: string;
  descripcion: string;
  categoria: string;
  fechaCreacion: string;
  estadoNombre: string;
}

interface Presupuesto {
  id: string;
  solicitudId: string;
  prestadorId: string;
  prestadorNombre: string;
  monto: number;
  detalles: string;
  fechaValidez: string;
  estadoNombre: string;
}

interface Orden {
  id: string;
  presupuestoId: string;
  solicitudId: string;
  prestadorId: string;
  prestadorNombre: string;
  monto: number;
  clienteNombre: string;
  tituloSolicitud: string;
  fechaCreacion: string;
  estadoNombre: string;
  calificado: boolean;
  estrellas?: number;
  comentario?: string;
}

interface Toast {
  message: string;
  type: "success" | "error" | "warning";
}

export default function Home() {
  const [role, setRole] = useState<"cliente" | "prestador">("cliente");

  // Local Mock State
  const [prestadores, setPrestadores] =
    useState<Prestador[]>(INITIAL_PRESTADORES);
  const [solicitudes, setSolicitudes] =
    useState<Solicitud[]>(INITIAL_SOLICITUDES);
  const [presupuestos, setPresupuestos] =
    useState<Presupuesto[]>(INITIAL_PRESUPUESTOS);
  const [ordenes, setOrdenes] = useState<Orden[]>(INITIAL_ORDENES);

  // Selection
  const [selectedPrestadorId, setSelectedPrestadorId] = useState<string>("p1");
  const [selectedSolicitudId, setSelectedSolicitudId] = useState<string | null>(
    INITIAL_SOLICITUDES[0]?.id || null,
  );
  const [activeRatingOrden, setActiveRatingOrden] = useState<any | null>(null);
  const [activeBudgetSolicitud, setActiveBudgetSolicitud] = useState<any | null>(null);
  const [activeDetailSolicitud, setActiveDetailSolicitud] = useState<any | null>(null);
  const [clientActiveTab, setClientActiveTab] = useState<"activas" | "historial">("activas");
  const [isCreateReqOpen, setIsCreateReqOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = (
    message: string,
    type: "success" | "error" | "warning" = "success",
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // -------------------------------------------------------------
  // MOCK CLIENT ACTIONS
  // -------------------------------------------------------------
  const handleCreateSolicitud = (
    titulo: string,
    descripcion: string,
    categoria: string,
  ) => {
    const nueva = {
      id: Math.random().toString(36).substring(7),
      clienteNombre: "Alejandro Santini",
      titulo,
      descripcion,
      categoria,
      fechaCreacion: new Date().toISOString(),
      estadoNombre: "Abierta",
    };
    setSolicitudes([nueva, ...solicitudes]);
    setSelectedSolicitudId(nueva.id);
    showToast("Solicitud publicada en Rosario.");
  };

  const handleAceptarPresupuesto = (presupuestoId: string) => {
    const pr = presupuestos.find((p) => p.id === presupuestoId);
    if (!pr) return;

    // Verificar validez (regla de negocio de la Iteración 3)
    if (new Date() > new Date(pr.fechaValidez)) {
      // Vencido
      setPresupuestos(
        presupuestos.map((p) =>
          p.id === presupuestoId ? { ...p, estadoNombre: "Rechazado" } : p,
        ),
      );
      showToast("No se puede aceptar. El presupuesto ha vencido.", "error");
      return;
    }

    // Aceptar presupuesto
    setPresupuestos(
      presupuestos.map((p) => {
        if (p.solicitudId === pr.solicitudId) {
          return p.id === presupuestoId
            ? { ...p, estadoNombre: "Aceptado" }
            : { ...p, estadoNombre: "Rechazado" };
        }
        return p;
      }),
    );

    // Cerrar solicitud correspondiente
    setSolicitudes(
      solicitudes.map((s) =>
        s.id === pr.solicitudId ? { ...s, estadoNombre: "Cerrada" } : s,
      ),
    );

    // Crear Orden de Servicio Programada de forma atómica y automática
    const nuevaOrden = {
      id: Math.random().toString(36).substring(7),
      presupuestoId: pr.id,
      solicitudId: pr.solicitudId,
      prestadorId: pr.prestadorId,
      prestadorNombre: pr.prestadorNombre,
      monto: pr.monto,
      clienteNombre: "Alejandro Santini",
      tituloSolicitud:
        solicitudes.find((s) => s.id === pr.solicitudId)?.titulo ||
        "Servicio Técnico",
      fechaCreacion: new Date().toISOString(),
      estadoNombre: "Programada",
      calificado: false,
      estrellas: undefined,
      comentario: undefined,
    };

    setOrdenes([nuevaOrden, ...ordenes]);
    showToast("Presupuesto aceptado. Orden de Servicio generada.");
  };

  const handleRechazarPresupuesto = (presupuestoId: string) => {
    setPresupuestos(
      presupuestos.map((p) =>
        p.id === presupuestoId ? { ...p, estadoNombre: "Rechazado" } : p,
      ),
    );
    showToast("Presupuesto rechazado.", "warning");
  };

  const handleSubmitRating = (
    ordenId: string,
    estrellas: number,
    comentario: string,
  ) => {
    // Calificar la orden
    setOrdenes(
      ordenes.map((o) =>
        o.id === ordenId
          ? {
              ...o,
              calificado: true,
              estrellas,
              comentario: comentario.substring(0, 500), // Truncamiento automático a 500
            }
          : o,
      ),
    );

    // Recalcular reputación del prestador asociado
    const ord = ordenes.find((o) => o.id === ordenId);
    if (ord) {
      setPrestadores(
        prestadores.map((p) => {
          if (p.id === ord.prestadorId) {
            const nuevoTotal = p.totalCalificaciones + 1;
            const nuevaRep =
              (p.reputacionPromedio * p.totalCalificaciones + estrellas) /
              nuevoTotal;
            return {
              ...p,
              totalCalificaciones: nuevoTotal,
              reputacionPromedio: Math.round(nuevaRep * 10) / 10,
            };
          }
          return p;
        }),
      );
    }

    showToast("Calificación enviada. Reputación actualizada.");
  };

  // -------------------------------------------------------------
  // MOCK PROVIDER ACTIONS
  // -------------------------------------------------------------
  const handleEmitirPresupuesto = (
    solicitudId: string,
    monto: number,
    detalles: string,
    validezPreset: string,
  ) => {
    const currentPrestador = prestadores.find(
      (p) => p.id === selectedPrestadorId,
    );
    if (!currentPrestador) return;

    let fechaValidez = new Date();
    if (validezPreset === "test_seconds") {
      fechaValidez = new Date(Date.now() + 10 * 1000); // 10 segundos
    } else if (validezPreset === "test_expired") {
      fechaValidez = new Date(Date.now() - 60 * 60 * 1000); // Expirado hace 1 hora
    } else if (validezPreset === "tomorrow") {
      fechaValidez = new Date(Date.now() + 24 * 60 * 60 * 1000);
    } else {
      fechaValidez = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    }

    const nuevo = {
      id: Math.random().toString(36).substring(7),
      solicitudId,
      prestadorId: selectedPrestadorId,
      prestadorNombre: currentPrestador.nombre,
      monto,
      detalles,
      fechaValidez: fechaValidez.toISOString(),
      estadoNombre: "Emitido",
    };

    setPresupuestos([nuevo, ...presupuestos]);

    // Cambiar estado solicitud a Con Presupuesto
    setSolicitudes(
      solicitudes.map((s) =>
        s.id === solicitudId ? { ...s, estadoNombre: "Con Presupuesto" } : s,
      ),
    );

    showToast("Presupuesto enviado al cliente.");
  };

  const handleFinalizarTrabajo = (ordenId: string) => {
    setOrdenes(
      ordenes.map((o) =>
        o.id === ordenId ? { ...o, estadoNombre: "Finalizada" } : o,
      ),
    );
    showToast("Trabajo marcado como finalizado.");
  };

  // Get current active provider
  const currentPrestador =
    prestadores.find((p) => p.id === selectedPrestadorId) || prestadores[0];
  // Get filtered requests for client tab
  const solicitudesFiltradas = solicitudes.filter((sol) => {
    if (clientActiveTab === "activas") {
      return sol.estadoNombre !== "Cerrada";
    } else {
      return sol.estadoNombre === "Cerrada";
    }
  });

  const activeSolicitud =
    solicitudesFiltradas.find((s) => s.id === selectedSolicitudId) || solicitudesFiltradas[0];

  return (
    <div className={styles.container}>
      {/* Toast popup */}
      {toast && (
        <div className={`${styles.toast} ${styles[toast.type]}`}>
          <span>
            {toast.type === "success"
              ? "✓"
              : toast.type === "error"
                ? "✗"
                : "⚠"}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Header Component */}
      <Header role={role} onChangeRole={setRole} />

      <div className={styles.dashboardLayout}>
        {/* Sidebar Component */}
        <Sidebar
          role={role}
          prestador={currentPrestador}
          onPublishClick={() => setIsCreateReqOpen(true)}
        />

        <main className={styles.mainContent}>
          {role === "cliente" ? (
            <>
              {/* Solicitudes y Ofertas */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h2>Mis Solicitudes y Presupuestos (Contratación)</h2>
                </div>

                {solicitudes.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p>No tienes solicitudes publicadas.</p>
                  </div>
                ) : (
                  <div className={styles.clientRequestsLayout}>
                    <div className={styles.tabsContainer}>
                      <button
                        type="button"
                        className={`${styles.tabButton} ${clientActiveTab === "activas" ? styles.active : ""}`}
                        onClick={() => setClientActiveTab("activas")}
                      >
                        En Curso
                      </button>
                      <button
                        type="button"
                        className={`${styles.tabButton} ${clientActiveTab === "historial" ? styles.active : ""}`}
                        onClick={() => setClientActiveTab("historial")}
                      >
                        Historial
                      </button>
                    </div>

                    {solicitudesFiltradas.length === 0 ? (
                      <div className={styles.emptyStateContainerCompact}>
                        <p>No tienes solicitudes en esta sección.</p>
                      </div>
                    ) : (
                      <div className={styles.grid}>
                        {solicitudesFiltradas.map((sol) => {
                          const ofertas = presupuestos.filter((p) => p.solicitudId === sol.id);
                          return (
                            <div
                              key={sol.id}
                              className={styles.clickableCard}
                              onClick={() => setActiveDetailSolicitud(sol)}
                            >
                              <div>
                                <div className={styles.cardHeaderFlex}>
                                  <span className={styles.cardCategoryText}>
                                    Categoría: {sol.categoria}
                                  </span>
                                  <span className={`${styles.badge} ${styles[sol.estadoNombre.toLowerCase().replace(" ", "")]}`}>
                                    {sol.estadoNombre}
                                  </span>
                                </div>
                                <h3 className={styles.cardTitleText}>
                                  {sol.titulo}
                                </h3>
                                <p className={styles.descTruncatedTwoLines}>
                                  {sol.descripcion}
                                </p>
                              </div>

                              <div className={styles.cardFooterFlex}>
                                <span className={styles.cardFooterDate}>
                                  Publicado: {new Date(sol.fechaCreacion).toLocaleDateString()}
                                </span>
                                <span className={styles.badgeCount}>
                                  {ofertas.length} {ofertas.length === 1 ? "oferta" : "ofertas"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Órdenes de Servicio */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h2>Órdenes de Trabajo</h2>
                </div>

                {ordenes.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p>No tienes órdenes de trabajo activas.</p>
                  </div>
                ) : (
                  <div className={styles.grid}>
                    {ordenes.map((ord) => (
                      <OrdenCard
                        key={ord.id}
                        role={role}
                        orden={ord}
                        onCalificarClick={setActiveRatingOrden}
                        onFinalizarClick={handleFinalizarTrabajo}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : (
            <>
              {/* Prestador: Solicitudes de clientes */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h2>Solicitudes Abiertas en Rosario</h2>
                </div>

                {solicitudes.filter((s) => s.estadoNombre !== "Cerrada")
                  .length === 0 ? (
                  <div className={styles.emptyState}>
                    <p>No hay solicitudes disponibles para presupuestar.</p>
                  </div>
                ) : (
                  <div className={styles.grid}>
                    {solicitudes
                      .filter((s) => s.estadoNombre !== "Cerrada")
                      .map((sol) => {
                        const ofertas = presupuestos.filter(
                          (p) => p.solicitudId === sol.id,
                        );
                        return (
                          <SolicitudCard
                            key={sol.id}
                            role={role}
                            solicitud={sol}
                            presupuestos={ofertas}
                            prestadorId={selectedPrestadorId}
                            onAceptarPresupuesto={handleAceptarPresupuesto}
                            onRechazarPresupuesto={handleRechazarPresupuesto}
                            onEmitirClick={setActiveBudgetSolicitud}
                          />
                        );
                      })}
                  </div>
                )}
              </section>

              {/* Prestador: Mis trabajos */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h2>Mis Trabajos Asignados</h2>
                </div>

                {ordenes.filter((o) => o.prestadorId === selectedPrestadorId)
                  .length === 0 ? (
                  <div className={styles.emptyState}>
                    <p>No tienes trabajos asignados.</p>
                  </div>
                ) : (
                  <div className={styles.grid}>
                    {ordenes
                      .filter((o) => o.prestadorId === selectedPrestadorId)
                      .map((ord) => (
                        <OrdenCard
                          key={ord.id}
                          role={role}
                          orden={ord}
                          onCalificarClick={setActiveRatingOrden}
                          onFinalizarClick={handleFinalizarTrabajo}
                        />
                      ))}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>

      {/* Stars rating modal window */}
      {activeRatingOrden && (
        <ValoracionModal
          orden={activeRatingOrden}
          onClose={() => setActiveRatingOrden(null)}
          onSubmitRating={handleSubmitRating}
        />
      )}

      {/* Emitir Presupuesto modal window */}
      {activeBudgetSolicitud && (
        <PresupuestoModal
          solicitud={activeBudgetSolicitud}
          onClose={() => setActiveBudgetSolicitud(null)}
          onSubmitBudget={handleEmitirPresupuesto}
        />
      )}

      {/* Detalle Solicitud modal window */}
      {activeDetailSolicitud && (
        <DetalleSolicitudModal
          solicitud={activeDetailSolicitud}
          presupuestos={presupuestos.filter((p) => p.solicitudId === activeDetailSolicitud.id)}
          prestadorId={selectedPrestadorId}
          onAceptarPresupuesto={handleAceptarPresupuesto}
          onRechazarPresupuesto={handleRechazarPresupuesto}
          onClose={() => setActiveDetailSolicitud(null)}
        />
      )}

      {/* Publicar Solicitud modal window */}
      {isCreateReqOpen && (
        <NuevaSolicitudModal
          onClose={() => setIsCreateReqOpen(false)}
          onSubmitRequest={handleCreateSolicitud}
        />
      )}
    </div>
  );
}
