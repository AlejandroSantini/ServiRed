import { useActionState, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/cliente.js';
import { useAccion, useCatalogo, useConsulta } from '../api/ganchos.js';
import { useSesion } from '../sesion/Sesion.jsx';
import { Aviso, Boton, Campo, Cargando, Dialogo, Estrellas, Seleccion, Vacio } from '../componentes/Basicos.jsx';
import { Dato, Ficha } from '../componentes/Ficha.jsx';
import { Conversacion } from '../componentes/Conversacion.jsx';
import { formatoFecha, formatoFechaHora, formatoPesos, hoy, nombreCompleto, sumarDias } from '../componentes/formato.js';

/** Solicitudes del cliente o recibidas por el prestador. */
export function Solicitudes() {
  const { usuario } = useSesion();
  const solicitudes = useConsulta('/solicitudes');
  const esPrestador = usuario.rol === 'prestador';
  return (
    <section className="pagina">
      <h1>{esPrestador ? 'Solicitudes recibidas' : 'Mis solicitudes'}</h1>
      <Cargando estado={solicitudes}>
        {(lista) => (lista.length === 0
          ? (
            <Vacio titulo={esPrestador ? 'Todavía no recibiste pedidos de presupuesto.' : 'Todavía no pediste presupuestos.'}>
              {!esPrestador && <Link to="/buscar" className="boton boton-primario">Buscar un prestador</Link>}
            </Vacio>
          )
          : (
            <ul className="lista">
              {lista.map((s) => {
                const pendiente = esPrestador && s.estado === 'Abierta' && !s.respondida;
                return (
                  <li key={s.id}>
                    <Link to={`/solicitudes/${s.id}`} className="lista-enlace">
                      <span className="lista-numero">N.º {s.id}</span>
                      <span className="lista-titulo">{s.categoria.nombre} en {s.zona.nombre}</span>
                      <span className="lista-detalle">
                        {esPrestador ? nombreCompleto(s.cliente) : `${s.cantidadPresupuestos} presupuestos vigentes`}, para el {formatoFecha(s.fechaPreferida)}
                      </span>
                      <span className={`estado estado-${s.estado.toLowerCase()}`}>{s.estado}</span>
                      {pendiente && <span className="insignia">Pendiente</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ))}
      </Cargando>
    </section>
  );
}

export function DetalleSolicitud() {
  const { id } = useParams();
  const { usuario } = useSesion();
  const solicitud = useConsulta(`/solicitudes/${id}`);
  return (
    <section className="pagina pagina-doble">
      <Link to="/solicitudes" className="volver">Volver a solicitudes</Link>
      <Cargando estado={solicitud}>
        {(s) => (
          <>
            <div className="columna-principal">
              <Ficha tipo="solicitud" numero={s.id} estado={s.estado} subestado={s.subestado}>
                <dl className="datos">
                  <Dato nombre="Oficio">{s.categoria.nombre}</Dato>
                  <Dato nombre="Zona">{s.zona.nombre}</Dato>
                  <Dato nombre="Dirección">{s.direccion}</Dato>
                  <Dato nombre="Fecha preferida">{formatoFecha(s.fechaPreferida)}, {s.turnoPreferido.nombre.toLowerCase()}</Dato>
                  <Dato nombre={usuario.rol === 'cliente' ? 'Pedido a' : 'Cliente'}>
                    {usuario.rol === 'cliente' ? s.destinatarios.map(nombreCompleto).join(', ') : nombreCompleto(s.cliente)}
                  </Dato>
                  {s.estado === 'Abierta' && <Dato nombre="Vence">{formatoFechaHora(s.fechaLimite)}</Dato>}
                </dl>
                <p className="ficha-descripcion">{s.descripcion}</p>
              </Ficha>
              {usuario.rol === 'cliente'
                ? <PresupuestosRecibidos solicitud={s} alCambiar={solicitud.recargar} />
                : <GestionPrestador solicitud={s} alCambiar={solicitud.recargar} />}
            </div>
            <aside className="columna-lateral">
              <Conversacion solicitud={s} />
            </aside>
          </>
        )}
      </Cargando>
    </section>
  );
}

/** Iteración 3, Pantalla 4 – Presupuestos recibidos (vista cliente, CU05.3). */
function PresupuestosRecibidos({ solicitud, alCambiar }) {
  const navegar = useNavigate();
  const accion = useAccion();
  const [aAceptar, setAAceptar] = useState(null);
  const ordenes = useConsulta('/ordenes');
  const orden = (ordenes.datos ?? []).find((o) => o.solicitud.id === solicitud.id);
  const abierta = solicitud.estado === 'Abierta';

  return (
    <section aria-labelledby="titulo-presupuestos">
      <h2 id="titulo-presupuestos">Presupuestos recibidos</h2>
      {orden && <p><Link to={`/ordenes/${orden.id}`} className="boton boton-primario">Ver la orden de servicio N.º {orden.id}</Link></p>}
      {solicitud.presupuestos.length === 0
        ? <Vacio titulo="Todavía no llegó ningún presupuesto.">Te avisamos cuando un prestador responda.</Vacio>
        : (
          <div className="tabla-envoltorio">
            <table className="tabla">
              <caption className="solo-lectores">Comparación de presupuestos</caption>
              <thead>
                <tr><th scope="col">Prestador</th><th scope="col">Monto</th><th scope="col">Tiempo</th><th scope="col">Válido hasta</th><th scope="col">Estado</th><th scope="col"><span className="solo-lectores">Acciones</span></th></tr>
              </thead>
              <tbody>
                {solicitud.presupuestos.map((p) => (
                  <tr key={p.id}>
                    <th scope="row">
                      {nombreCompleto(p.prestador)}
                      <Estrellas valor={p.prestador.reputacionPromedio} />
                      {p.detalle && <p className="tabla-detalle">{p.detalle}</p>}
                    </th>
                    <td className="numero">{formatoPesos(p.montoEstimado)}</td>
                    <td>{p.tiempoEstimadoHoras} h</td>
                    <td>{formatoFecha(p.fechaValidez)}</td>
                    <td><span className={`estado estado-${p.estado.toLowerCase()}`}>{p.estado}</span></td>
                    <td>
                      {abierta && p.estado === 'Emitido' && (
                        <div className="tabla-acciones">
                          <Boton onClick={() => setAAceptar(p)}>Aceptar</Boton>
                          <Boton variante="secundario" pendiente={accion.pendiente}
                            onClick={() => accion.ejecutar(async () => { await api(`/presupuestos/${p.id}/rechazar`, { metodo: 'POST' }); alCambiar(); })}>
                            Rechazar
                          </Boton>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      <Aviso error={accion.error} />
      {abierta && (
        <Boton variante="peligro" pendiente={accion.pendiente}
          onClick={() => accion.ejecutar(async () => { await api(`/solicitudes/${solicitud.id}/cancelar`, { metodo: 'POST' }); alCambiar(); })}>
          Cancelar la solicitud
        </Boton>
      )}
      <AceptarPresupuesto presupuesto={aAceptar} solicitud={solicitud} alCerrar={() => setAAceptar(null)}
        alAceptar={(o) => navegar(`/ordenes/${o.id}`)} />
    </section>
  );
}

/** Confirmación de CU05.3 con la fecha y el turno acordados (RN-C05, RN-C14). */
function AceptarPresupuesto({ presupuesto, solicitud, alCerrar, alAceptar }) {
  const turnos = useCatalogo('turnos');
  const [error, aceptar, pendiente] = useActionState(async (_a, f) => {
    try {
      const orden = await api(`/presupuestos/${presupuesto.id}/aceptar`, {
        metodo: 'POST', cuerpo: { fechaProgramada: f.get('fechaProgramada'), idTurno: Number(f.get('idTurno')) },
      });
      alAceptar(orden);
      return null;
    } catch (e) {
      return e;
    }
  }, null);
  return (
    <Dialogo abierto={Boolean(presupuesto)} alCerrar={alCerrar} titulo="Aceptar presupuesto">
      {presupuesto && (
        <form action={aceptar} className="formulario">
          <p>Vas a contratar a <strong>{nombreCompleto(presupuesto.prestador)}</strong> por {formatoPesos(presupuesto.montoEstimado)}.</p>
          <Aviso tipo="info">Al aceptar, los demás presupuestos de esta solicitud quedan descartados.</Aviso>
          <div className="fila-campos">
            <Campo etiqueta="Fecha acordada" type="date" name="fechaProgramada" min={hoy()} defaultValue={solicitud.fechaPreferida} required />
            <Seleccion etiqueta="Turno" name="idTurno" opciones={turnos.datos} defaultValue={solicitud.turnoPreferido.id} key={turnos.datos?.length} />
          </div>
          <Aviso error={error} />
          <div className="acciones">
            <Boton type="button" variante="secundario" onClick={alCerrar}>Volver</Boton>
            <Boton type="submit" pendiente={pendiente}>Aceptar y generar la orden</Boton>
          </div>
        </form>
      )}
    </Dialogo>
  );
}

/** Iteración 3, Pantalla 3 – Gestión de solicitud (vista prestador, CU05.2). */
function GestionPrestador({ solicitud, alCambiar }) {
  const propios = solicitud.presupuestos ?? [];
  const vigente = propios.find((p) => p.estado === 'Emitido');
  const puedeEmitir = solicitud.estado === 'Abierta' && !vigente;
  const [error, emitir, pendiente] = useActionState(async (_a, f) => {
    try {
      await api(`/solicitudes/${solicitud.id}/presupuestos`, {
        metodo: 'POST',
        cuerpo: {
          montoEstimado: Number(f.get('montoEstimado')),
          tiempoEstimadoHoras: Number(f.get('tiempoEstimadoHoras')),
          detalle: f.get('detalle') || null,
          fechaValidez: f.get('fechaValidez'),
        },
      });
      alCambiar();
      return null;
    } catch (e) {
      return e;
    }
  }, null);

  return (
    <section aria-labelledby="titulo-mi-presupuesto">
      <h2 id="titulo-mi-presupuesto">Tu presupuesto</h2>
      {propios.map((p) => (
        <dl key={p.id} className="datos datos-presupuesto">
          <Dato nombre="Estado"><span className={`estado estado-${p.estado.toLowerCase()}`}>{p.estado}</span></Dato>
          <Dato nombre="Monto">{formatoPesos(p.montoEstimado)}</Dato>
          <Dato nombre="Tiempo estimado">{p.tiempoEstimadoHoras} h</Dato>
          <Dato nombre="Válido hasta">{formatoFecha(p.fechaValidez)}</Dato>
          {p.comisionEstimada && <Dato nombre="Comisión de ServiRed">{formatoPesos(p.comisionEstimada.monto)} ({p.comisionEstimada.porcentaje} %)</Dato>}
        </dl>
      ))}
      {puedeEmitir && (
        <form action={emitir} className="formulario">
          <div className="fila-campos">
            <Campo etiqueta="Monto estimado (pesos)" type="number" name="montoEstimado" min="1" step="0.01" required />
            <Campo etiqueta="Tiempo estimado (horas)" type="number" name="tiempoEstimadoHoras" min="0.5" step="0.5" required />
          </div>
          <Campo etiqueta="Detalle de la propuesta">
            {(a) => <textarea {...a} name="detalle" rows={3} maxLength={2000} placeholder="Qué incluye, materiales, garantía…" />}
          </Campo>
          <Campo etiqueta="Válido hasta" type="date" name="fechaValidez" min={sumarDias(hoy(), 1)} defaultValue={sumarDias(hoy(), 7)} required
            ayuda="Después de esta fecha el cliente ya no puede aceptarlo." />
          <Aviso error={error} />
          <Boton type="submit" pendiente={pendiente}>Enviar presupuesto</Boton>
        </form>
      )}
      {!puedeEmitir && propios.length === 0 && <p className="nota">La solicitud está {solicitud.estado.toLowerCase()}: ya no admite presupuestos.</p>}
    </section>
  );
}
