import { useActionState, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/cliente.js';
import { useAccion, useCatalogo, useConsulta } from '../api/ganchos.js';
import { Aviso, Boton, Campo, Cargando, Dialogo, Estrellas, Vacio } from '../componentes/Basicos.jsx';
import { ListaOrdenes } from './Ordenes.jsx';
import { formatoFecha, formatoFechaHora, formatoPesos } from '../componentes/formato.js';

/** RF07 – Agenda del prestador y disponibilidad. */
export function Agenda() {
  const agenda = useConsulta('/agenda');
  const [error, guardar, pendiente] = useActionState(async (_a, f) => {
    try {
      await api('/agenda/disponibilidad', {
        metodo: 'PUT', cuerpo: { disponibilidad: f.get('disponibilidad'), disponibilidadActiva: f.get('activa') === 'on' },
      });
      agenda.recargar();
      return { guardado: true };
    } catch (e) {
      return { error: e };
    }
  }, null);

  return (
    <section className="pagina">
      <h1>Agenda</h1>
      <Cargando estado={agenda}>
        {(a) => (
          <div className="pagina-doble">
            <div className="columna-principal">
              <h2>Trabajos programados</h2>
              {a.ordenes.length === 0 ? <Vacio titulo="No tenés trabajos programados." /> : (
                <ol className="agenda">
                  {a.ordenes.map((o) => (
                    <li key={o.id}>
                      <p className="agenda-dia">{formatoFecha(o.fechaProgramada)}</p>
                      <p className="agenda-turno">{o.turno.nombre}</p>
                      <Link to={`/ordenes/${o.id}`} className="agenda-trabajo">
                        {o.solicitud.categoria.nombre} en {o.solicitud.direccion}
                        <span className={`estado estado-${o.estado.toLowerCase().replace(' ', '-')}`}>{o.estado}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <aside className="columna-lateral">
              <h2>Disponibilidad</h2>
              <form action={guardar} className="formulario" key={`${a.disponibilidad}${a.disponibilidadActiva}`}>
                <label className="opcion">
                  <input type="checkbox" name="activa" defaultChecked={a.disponibilidadActiva} />
                  Estoy tomando trabajos nuevos
                </label>
                <Campo etiqueta="Horarios" name="disponibilidad" defaultValue={a.disponibilidad ?? ''} maxLength={500}
                  ayuda="Se muestra en tu perfil. Si no tomás trabajos, no aparecés en la búsqueda." />
                <Aviso error={error?.error} />
                {error?.guardado && <Aviso tipo="exito">Disponibilidad actualizada.</Aviso>}
                <Boton type="submit" pendiente={pendiente}>Guardar disponibilidad</Boton>
              </form>
            </aside>
          </div>
        )}
      </Cargando>
    </section>
  );
}

/** RF08 – Historial de órdenes cerradas y canceladas, con filtros (Iteración 6, Pantalla 1). */
export function Historial() {
  const [filtros, setFiltros] = useState({ idEstado: '', desde: '', hasta: '' });
  const historial = useConsulta('/historial', filtros);
  const cambiar = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value }));
  return (
    <section className="pagina">
      <h1>Historial de servicios</h1>
      <form className="filtros" onSubmit={(e) => e.preventDefault()} aria-label="Filtros del historial">
        <Campo etiqueta="Estado">
          {(a) => (
            <select {...a} value={filtros.idEstado} onChange={cambiar('idEstado')}>
              <option value="">Cerradas y canceladas</option>
              <option value="5">Cerradas</option>
              <option value="6">Canceladas</option>
            </select>
          )}
        </Campo>
        <Campo etiqueta="Desde" type="date" value={filtros.desde} onChange={cambiar('desde')} />
        <Campo etiqueta="Hasta" type="date" value={filtros.hasta} onChange={cambiar('hasta')} />
      </form>
      <Cargando estado={historial}>
        {(lista) => (lista.length === 0 ? <Vacio titulo="No hay servicios terminados con esos filtros." /> : <ListaOrdenes ordenes={lista} />)}
      </Cargando>
    </section>
  );
}

/** RF11 – Notificaciones. */
export function Notificaciones() {
  const notificaciones = useConsulta('/notificaciones');
  const accion = useAccion();
  const enlace = (n) => (n.entidad === 'orden' ? `/ordenes/${n.idEntidad}` : n.entidad === 'solicitud' ? `/solicitudes/${n.idEntidad}` : null);
  return (
    <section className="pagina pagina-angosta">
      <h1>Avisos</h1>
      <Aviso error={accion.error} />
      <Cargando estado={notificaciones}>
        {({ items }) => (items.length === 0 ? <Vacio titulo="No tenés avisos." /> : (
          <ul className="avisos">
            {items.map((n) => (
              <li key={n.id} className={n.leida ? '' : 'sin-leer'}>
                <p>{enlace(n) ? <Link to={enlace(n)}>{n.mensaje}</Link> : n.mensaje}</p>
                <p className="aviso-pie">
                  {formatoFechaHora(n.fecha)}
                  {!n.leida && (
                    <button type="button" className="boton-texto"
                      onClick={() => accion.ejecutar(async () => { await api(`/notificaciones/${n.id}/leer`, { metodo: 'POST' }); notificaciones.recargar(); })}>
                      Marcar como leído
                    </button>
                  )}
                </p>
              </li>
            ))}
          </ul>
        ))}
      </Cargando>
    </section>
  );
}

/** RF12 – Reseñas recibidas por el prestador; Iteración 6, Pantalla 4 – Denunciar reseña. */
export function ResenasRecibidas() {
  const resenas = useConsulta('/resenas/recibidas');
  const motivos = useCatalogo('motivos-denuncia');
  const [aDenunciar, setADenunciar] = useState(null);
  const [error, denunciar, pendiente] = useActionState(async (_a, f) => {
    try {
      await api(`/resenas/${aDenunciar.id}/denuncias`, {
        metodo: 'POST', cuerpo: { idMotivo: Number(f.get('idMotivo')), detalle: f.get('detalle') || null },
      });
      setADenunciar(null);
      resenas.recargar();
      return null;
    } catch (e) {
      return e;
    }
  }, null);

  return (
    <section className="pagina pagina-angosta">
      <h1>Reseñas recibidas</h1>
      <Cargando estado={resenas}>
        {(lista) => (lista.length === 0 ? <Vacio titulo="Todavía no recibiste valoraciones." /> : (
          <ul className="resenas">
            {lista.map((r) => (
              <li key={r.id}>
                <Estrellas valor={r.puntaje} />
                {r.estado !== 'Publicada' && <span className={`estado estado-${r.estado === 'Eliminada' ? 'cancelada' : 'interrumpida'}`}>{r.estado}</span>}
                {r.comentario && <blockquote>{r.comentario}</blockquote>}
                <p className="resena-pie">{r.cliente.nombre}, {r.categoria}, {formatoFechaHora(r.fechaFeedback)}</p>
                {r.estado === 'Publicada' && !r.denunciaPendiente && (
                  <Boton variante="secundario" onClick={() => setADenunciar(r)}>Denunciar</Boton>
                )}
              </li>
            ))}
          </ul>
        ))}
      </Cargando>
      <Dialogo abierto={Boolean(aDenunciar)} alCerrar={() => setADenunciar(null)} titulo="Denunciar reseña">
        <form action={denunciar} className="formulario">
          <fieldset className="opciones">
            <legend>Motivo</legend>
            {(motivos.datos ?? []).map((m) => (
              <label key={m.id} className="opcion"><input type="radio" name="idMotivo" value={m.id} required /> {m.nombre}</label>
            ))}
          </fieldset>
          <Campo etiqueta="Detalle (opcional)">
            {(a) => <textarea {...a} name="detalle" rows={3} maxLength={1000} />}
          </Campo>
          <Aviso tipo="info">Mientras el administrador la revisa, la reseña se oculta y no cuenta para tu calificación.</Aviso>
          <Aviso error={error} />
          <Boton type="submit" pendiente={pendiente}>Enviar denuncia</Boton>
        </form>
      </Dialogo>
    </section>
  );
}

/** RF14 y RF13 – Planes de visibilidad, panel de estadísticas y balance de comisiones del prestador. */
export function Planes() {
  const planes = useConsulta('/planes');
  const suscripciones = useConsulta('/suscripciones');
  const balance = useConsulta('/comisiones/balance');
  const vigente = (suscripciones.datos ?? []).find((s) => s.vigente);
  const panel = useConsulta(vigente ? '/suscripciones/panel' : '/planes');
  const accion = useAccion();

  return (
    <section className="pagina">
      <h1>Planes y comisiones</h1>
      <div className="pagina-doble">
        <div className="columna-principal">
          <h2>Aparecé primero en la búsqueda</h2>
          {vigente && <Aviso tipo="exito">Tenés el plan {vigente.plan.nombre} hasta el {formatoFechaHora(vigente.fechaFin)}.</Aviso>}
          <Cargando estado={planes}>
            {(lista) => (
              <ul className="planes">
                {lista.map((p) => (
                  <li key={p.id}>
                    <p className={`sello sello-${p.nombre.toLowerCase()}`}>{p.nombre}</p>
                    <p className="plan-precio">{formatoPesos(p.precio)} por {p.duracionDias} días</p>
                    <p>{p.prioridad === 2 ? 'Primer lugar en los resultados, antes que Verificado.' : 'Aparecés antes que los prestadores sin plan.'}</p>
                    <Boton variante={p.prioridad === 2 ? 'primario' : 'secundario'} pendiente={accion.pendiente}
                      onClick={() => accion.ejecutar(async () => { await api('/suscripciones', { metodo: 'POST', cuerpo: { idPlan: p.id } }); suscripciones.recargar(); })}>
                      {vigente ? `Renovar con ${p.nombre}` : `Contratar ${p.nombre}`}
                    </Boton>
                  </li>
                ))}
              </ul>
            )}
          </Cargando>
          <p className="nota">El pago se coordina fuera de ServiRed. Si ya tenés un plan, el nuevo empieza cuando termina el actual.</p>
          <Aviso error={accion.error} />

          {vigente && panel.datos?.visitas !== undefined && (
            <>
              <h2>Tus estadísticas de los últimos 30 días</h2>
              <dl className="cifras">
                <div><dt>Visitas al perfil</dt><dd>{panel.datos.visitas}</dd></div>
                <div><dt>Solicitudes recibidas</dt><dd>{panel.datos.solicitudesRecibidas}</dd></div>
                <div><dt>Presupuestos aceptados</dt><dd>{panel.datos.presupuestosAceptados} de {panel.datos.presupuestosEmitidos}</dd></div>
              </dl>
            </>
          )}
        </div>
        <aside className="columna-lateral">
          <h2>Comisiones</h2>
          <Cargando estado={balance}>
            {(b) => (
              <>
                <dl className="cifras cifras-apiladas">
                  <div><dt>Pendiente de pago</dt><dd>{formatoPesos(b.pendiente)}</dd></div>
                  <div><dt>Ya liquidado</dt><dd>{formatoPesos(b.liquidado)}</dd></div>
                </dl>
                {b.comisiones.length > 0 && (
                  <ul className="lista-compacta">
                    {b.comisiones.map((c) => (
                      <li key={c.id}>Presupuesto N.º {c.idPresupuesto}: {formatoPesos(c.monto)} ({c.porcentaje} %), {c.estado.toLowerCase()}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Cargando>
        </aside>
      </div>
    </section>
  );
}
