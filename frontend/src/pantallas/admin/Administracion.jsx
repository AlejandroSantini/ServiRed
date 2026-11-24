import { useActionState, useState } from 'react';
import { api } from '../../api/cliente.js';
import { useAccion, useCatalogo, useConsulta } from '../../api/ganchos.js';
import { useSesion } from '../../sesion/Sesion.jsx';
import { Aviso, Boton, Campo, Cargando, Dialogo, Estrellas, Seleccion, Vacio } from '../../componentes/Basicos.jsx';
import { formatoFechaHora, formatoPesos, formatoPorcentaje, nombreCompleto } from '../../componentes/formato.js';

/** Iteración 6, Pantalla 5 – Moderación de denuncias (CU09.4, RN-V06 a RN-V08). */
export function Moderacion() {
  const denuncias = useConsulta('/denuncias');
  return (
    <section className="pagina pagina-angosta">
      <h1>Denuncias para moderar</h1>
      <Cargando estado={denuncias}>
        {(lista) => (lista.length === 0
          ? <Vacio titulo="No hay denuncias pendientes." />
          : <ul className="denuncias">{lista.map((d) => <Denuncia key={d.id} denuncia={d} alResolver={denuncias.recargar} />)}</ul>)}
      </Cargando>
    </section>
  );
}

function Denuncia({ denuncia, alResolver }) {
  const [error, resolver, pendiente] = useActionState(async (_a, f) => {
    try {
      await api(`/denuncias/${denuncia.id}/resolver`, { metodo: 'POST', cuerpo: { decision: f.get('decision'), comentario: f.get('comentario') } });
      alResolver();
      return null;
    } catch (e) {
      return e;
    }
  }, null);
  return (
    <li>
      <p className="denuncia-encabezado">Denuncia N.º {denuncia.id} de {nombreCompleto(denuncia.prestador)}, {formatoFechaHora(denuncia.fechaDenuncia)}</p>
      <p><strong>Motivo:</strong> {denuncia.motivo.nombre}{denuncia.detalle ? `. ${denuncia.detalle}` : ''}</p>
      <div className="resena-denunciada">
        <Estrellas valor={denuncia.resena.puntaje} />
        <blockquote>{denuncia.resena.comentario ?? 'Sin comentario.'}</blockquote>
        <p className="resena-pie">{denuncia.resena.cliente.nombre}, {denuncia.resena.categoria}</p>
      </div>
      <form action={resolver} className="formulario">
        <Campo etiqueta="Fundamento de la decisión">
          {(a) => <textarea {...a} name="comentario" rows={2} maxLength={1000} required />}
        </Campo>
        <Aviso error={error} />
        <div className="acciones">
          <Boton type="submit" name="decision" value="desestimar" variante="secundario" pendiente={pendiente}>Mantener la reseña</Boton>
          <Boton type="submit" name="decision" value="aprobar" variante="peligro" pendiente={pendiente}>Eliminar la reseña</Boton>
        </div>
      </form>
    </li>
  );
}

/** Módulo de seguridad – Gestión de usuarios (RN-S03, RN-S07). */
export function Usuarios() {
  const { usuario: yo } = useSesion();
  const usuarios = useConsulta('/usuarios');
  const accion = useAccion();
  const operar = (u, ruta, metodo = 'POST') => accion.ejecutar(async () => {
    await api(`/usuarios/${u.id}${ruta}`, { metodo });
    usuarios.recargar();
  });
  return (
    <section className="pagina">
      <h1>Usuarios</h1>
      <Aviso error={accion.error} />
      <Cargando estado={usuarios}>
        {(lista) => (
          <div className="tabla-envoltorio">
            <table className="tabla">
              <thead><tr><th scope="col">Nombre</th><th scope="col">Correo</th><th scope="col">Tipo</th><th scope="col">Estado</th><th scope="col"><span className="solo-lectores">Acciones</span></th></tr></thead>
              <tbody>
                {lista.map((u) => (
                  <tr key={u.id}>
                    <th scope="row">{nombreCompleto(u)}</th>
                    <td>{u.email}</td>
                    <td>{u.rol}</td>
                    <td><span className={`estado estado-${u.estado.toLowerCase()}`}>{u.estado}</span></td>
                    <td><div className="tabla-acciones">
                      {u.id !== yo.id && u.estado === 'Bloqueado' && <Boton variante="secundario" onClick={() => operar(u, '/desbloquear')}>Desbloquear</Boton>}
                      {u.id !== yo.id && u.estado === 'Activo' && <Boton variante="secundario" onClick={() => operar(u, '/bloquear')}>Bloquear</Boton>}
                      {u.id !== yo.id && u.estado !== 'Baja' && <Boton variante="peligro" onClick={() => operar(u, '', 'DELETE')}>Dar de baja</Boton>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cargando>
    </section>
  );
}

const CRITICIDADES = [{ id: '1', nombre: 'Baja' }, { id: '2', nombre: 'Media' }, { id: '3', nombre: 'Alta' }];

/** Módulo de seguridad – Bitácora (RN-S08). */
export function Bitacora() {
  const [filtros, setFiltros] = useState({ idCriticidad: '', modulo: '', pagina: 1 });
  const bitacora = useConsulta('/seguridad/bitacora', { ...filtros, tamanio: 25 });
  const cambiar = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value, pagina: 1 }));
  return (
    <section className="pagina">
      <h1>Bitácora</h1>
      <form className="filtros" onSubmit={(e) => e.preventDefault()}>
        <Seleccion etiqueta="Criticidad" vacia="Todas" opciones={CRITICIDADES} value={filtros.idCriticidad} onChange={cambiar('idCriticidad')} />
        <Campo etiqueta="Módulo" value={filtros.modulo} onChange={cambiar('modulo')} placeholder="Autenticación, Permisos…" />
      </form>
      <Cargando estado={bitacora}>
        {(b) => (
          <>
            <div className="tabla-envoltorio">
              <table className="tabla tabla-densa">
                <thead><tr><th scope="col">Fecha</th><th scope="col">Usuario</th><th scope="col">Módulo</th><th scope="col">Evento</th><th scope="col">Detalle</th><th scope="col">Criticidad</th></tr></thead>
                <tbody>
                  {b.items.map((e) => (
                    <tr key={e.id}>
                      <td>{formatoFechaHora(e.fecha)}</td>
                      <td>{e.emailUsuario ?? 'Sistema / anónimo'}</td>
                      <td>{e.modulo}</td>
                      <td>{e.evento}</td>
                      <td>{e.descripcion}</td>
                      <td><span className={`criticidad criticidad-${e.criticidad.toLowerCase()}`}>{e.criticidad}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav className="paginado" aria-label="Páginas de la bitácora">
              <Boton variante="secundario" disabled={b.pagina <= 1} onClick={() => setFiltros((f) => ({ ...f, pagina: f.pagina - 1 }))}>Anterior</Boton>
              <span>Página {b.pagina} de {Math.max(1, Math.ceil(b.total / b.tamanio))}</span>
              <Boton variante="secundario" disabled={b.pagina * b.tamanio >= b.total} onClick={() => setFiltros((f) => ({ ...f, pagina: f.pagina + 1 }))}>Siguiente</Boton>
            </nav>
          </>
        )}
      </Cargando>
    </section>
  );
}

/** Módulo de seguridad – Dígitos verificadores (RN-S09) y backups (RN-S11). */
export function Integridad() {
  const { tienePermiso } = useSesion();
  const integridad = useConsulta('/seguridad/integridad');
  const backups = useConsulta('/seguridad/backups');
  const accion = useAccion();
  const [confirmar, setConfirmar] = useState(null);

  const ejecutar = (ruta) => accion.ejecutar(async () => {
    await api(ruta, { metodo: 'POST' });
    setConfirmar(null);
    integridad.recargar();
    backups.recargar();
  });

  return (
    <section className="pagina">
      <h1>Integridad y backups</h1>
      <Aviso error={accion.error} />
      {tienePermiso('INTEGRIDAD_GESTIONAR') && (
        <Cargando estado={integridad}>
          {(r) => (
            <section aria-labelledby="titulo-integridad">
              <h2 id="titulo-integridad">Dígitos verificadores</h2>
              {r.integra
                ? <Aviso tipo="exito">La base está íntegra. Última verificación: {formatoFechaHora(r.fecha)}.</Aviso>
                : (
                  <>
                    <Aviso>Se detectaron {r.inconsistencias.length} inconsistencias. Revisalas antes de recalcular: recalcular acepta los datos actuales como válidos.</Aviso>
                    <ul className="lista-compacta">
                      {r.inconsistencias.map((i, n) => (
                        <li key={n}>Tabla {i.tabla}: {i.tipo === 'DVV' ? 'faltan o sobran filas (DVV)' : `fila ${JSON.stringify(i.fila)} modificada (DVH)`}</li>
                      ))}
                    </ul>
                    <Boton variante="peligro" onClick={() => setConfirmar({ ruta: '/seguridad/integridad/recalcular', texto: 'Recalcular los dígitos verificadores' })}>
                      Recalcular dígitos verificadores
                    </Boton>
                  </>
                )}
            </section>
          )}
        </Cargando>
      )}
      {tienePermiso('BACKUP_GESTIONAR') && (
        <section aria-labelledby="titulo-backups">
          <h2 id="titulo-backups">Backups</h2>
          <Boton pendiente={accion.pendiente} onClick={() => ejecutar('/seguridad/backups')}>Hacer un backup ahora</Boton>
          <Cargando estado={backups}>
            {(lista) => (lista.length === 0 ? <Vacio titulo="Todavía no hay backups." /> : (
              <ul className="lista-compacta">
                {lista.map((b) => (
                  <li key={b.nombre}>
                    {b.nombre}, {formatoFechaHora(b.fecha)}
                    <button type="button" className="boton-texto"
                      onClick={() => setConfirmar({ ruta: `/seguridad/backups/${encodeURIComponent(b.nombre)}/restaurar`, texto: `Restaurar ${b.nombre}` })}>
                      Restaurar
                    </button>
                  </li>
                ))}
              </ul>
            ))}
          </Cargando>
        </section>
      )}
      <Dialogo abierto={Boolean(confirmar)} alCerrar={() => setConfirmar(null)} titulo={confirmar?.texto}>
        <p>Esta operación reemplaza datos de la base y queda registrada en la bitácora. ¿Querés continuar?</p>
        <div className="acciones">
          <Boton variante="secundario" onClick={() => setConfirmar(null)}>Volver</Boton>
          <Boton variante="peligro" pendiente={accion.pendiente} onClick={() => ejecutar(confirmar.ruta)}>{confirmar?.texto}</Boton>
        </div>
      </Dialogo>
    </section>
  );
}

/** RF10 Indicadores, ingresos (RF13, RF14) y configuración de comisiones (RN-K01). */
export function Reportes() {
  const { tienePermiso } = useSesion();
  const [periodo, setPeriodo] = useState({ desde: '', hasta: '' });
  const consulta = {
    desde: periodo.desde ? `${periodo.desde}T00:00:00-03:00` : '',
    hasta: periodo.hasta ? `${periodo.hasta}T23:59:59-03:00` : '',
  };
  const indicadores = useConsulta(tienePermiso('REPORTES_VER') ? '/reportes/indicadores' : '/planes', consulta);
  const ingresos = useConsulta(tienePermiso('REPORTES_VER') ? '/reportes/ingresos' : '/planes', consulta);

  return (
    <section className="pagina">
      <h1>Reportes</h1>
      {tienePermiso('REPORTES_VER') && (
        <>
          <form className="filtros" onSubmit={(e) => e.preventDefault()} aria-label="Período">
            <Campo etiqueta="Desde" type="date" value={periodo.desde} onChange={(e) => setPeriodo((p) => ({ ...p, desde: e.target.value }))}
              ayuda="Sin fechas: últimos 90 días." />
            <Campo etiqueta="Hasta" type="date" value={periodo.hasta} onChange={(e) => setPeriodo((p) => ({ ...p, hasta: e.target.value }))} />
          </form>
          <Cargando estado={indicadores}>
            {(r) => r.conversion && (
              <div className="reportes">
                <dl className="cifras">
                  <div><dt>Solicitudes</dt><dd>{r.conversion.solicitudes}</dd></div>
                  <div><dt>Adjudicadas</dt><dd>{formatoPorcentaje(r.conversion.tasaSolicitudes)}</dd></div>
                  <div><dt>Presupuestos aceptados</dt><dd>{formatoPorcentaje(r.conversion.tasaPresupuestos)}</dd></div>
                  <div><dt>Respuesta promedio</dt><dd>{r.tiempoRespuestaPromedioHoras === null ? '—' : `${r.tiempoRespuestaPromedioHoras} h`}</dd></div>
                </dl>
                <Barras titulo="Demanda por zona" filas={r.demandaPorZona} />
                <Barras titulo="Demanda por oficio" filas={r.demandaPorCategoria} />
                <section>
                  <h2>Precio promedio aceptado</h2>
                  {r.tendenciaPrecios.length === 0 ? <Vacio titulo="Todavía no hay presupuestos aceptados en el período." /> : (
                    <table className="tabla">
                      <thead><tr><th scope="col">Oficio</th><th scope="col">Mes</th><th scope="col">Promedio</th><th scope="col">Cantidad</th></tr></thead>
                      <tbody>{r.tendenciaPrecios.map((t) => (
                        <tr key={`${t.categoria}${t.mes}`}><th scope="row">{t.categoria}</th><td>{t.mes}</td><td className="numero">{formatoPesos(t.promedio)}</td><td>{t.cantidad}</td></tr>
                      ))}</tbody>
                    </table>
                  )}
                </section>
              </div>
            )}
          </Cargando>
          <Cargando estado={ingresos}>
            {(i) => i.comisiones && (
              <section>
                <h2>Ingresos de la plataforma</h2>
                <dl className="cifras">
                  <div><dt>Comisiones registradas</dt><dd>{formatoPesos(i.comisiones.registradas)}</dd></div>
                  <div><dt>Comisiones cobradas</dt><dd>{formatoPesos(i.comisiones.liquidadas)}</dd></div>
                  <div><dt>Planes</dt><dd>{formatoPesos(i.planes)}</dd></div>
                  <div><dt>Total</dt><dd>{formatoPesos(i.total)}</dd></div>
                </dl>
              </section>
            )}
          </Cargando>
        </>
      )}
      {tienePermiso('COMISION_CONFIGURAR') && <Comisiones />}
    </section>
  );
}

function Barras({ titulo, filas }) {
  const maximo = Math.max(1, ...filas.map((f) => f.solicitudes));
  return (
    <section>
      <h2>{titulo}</h2>
      {filas.length === 0 ? <Vacio titulo="Sin solicitudes en el período." /> : (
        <ul className="barras">
          {filas.map((f) => (
            <li key={f.id}>
              <span className="barras-nombre">{f.nombre}</span>
              <span className="barras-barra" style={{ '--proporcion': f.solicitudes / maximo }} aria-hidden="true" />
              <span className="barras-valor">{f.solicitudes}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** RN-K01 a RN-K03: porcentajes y liquidación del balance de un prestador. */
function Comisiones() {
  const tasas = useConsulta('/comisiones/tasas');
  const categorias = useCatalogo('categorias');
  const [balance, setBalance] = useState(null);
  const accion = useAccion();
  const [error, guardar, pendiente] = useActionState(async (_a, f) => {
    try {
      await api('/comisiones/tasas', { metodo: 'PUT', cuerpo: { idCategoria: f.get('idCategoria') || null, porcentaje: Number(f.get('porcentaje')) } });
      tasas.recargar();
      return null;
    } catch (e) {
      return e;
    }
  }, null);

  return (
    <section aria-labelledby="titulo-comisiones">
      <h2 id="titulo-comisiones">Comisiones</h2>
      <Cargando estado={tasas}>
        {(lista) => (
          <ul className="lista-compacta">
            {lista.map((t) => <li key={t.id}>{t.general ? 'General' : t.categoria.nombre}: {t.porcentaje} %</li>)}
          </ul>
        )}
      </Cargando>
      <form action={guardar} className="filtros">
        <Seleccion etiqueta="Aplicar a" name="idCategoria" vacia="Todas (general)" opciones={categorias.datos} />
        <Campo etiqueta="Porcentaje" name="porcentaje" type="number" min="0" max="100" step="0.01" required />
        <Boton type="submit" pendiente={pendiente}>Guardar porcentaje</Boton>
      </form>
      <Aviso error={error} />

      <form className="filtros" onSubmit={(e) => {
        e.preventDefault();
        const id = new FormData(e.currentTarget).get('idPrestador');
        accion.ejecutar(async () => setBalance(await api(`/comisiones/prestadores/${id}`)));
      }}>
        <Campo etiqueta="Balance del prestador N.º" name="idPrestador" type="number" min="1" required />
        <Boton type="submit" variante="secundario" pendiente={accion.pendiente}>Consultar balance</Boton>
      </form>
      <Aviso error={accion.error} />
      {balance && (
        <div className="balance">
          <p>{nombreCompleto(balance.prestador)}: pendiente {formatoPesos(balance.pendiente)}, liquidado {formatoPesos(balance.liquidado)}.</p>
          {balance.pendiente > 0 && (
            <Boton onClick={() => accion.ejecutar(async () => setBalance(await api(`/comisiones/prestadores/${balance.prestador.id}/liquidar`, { metodo: 'POST' })))}>
              Registrar pago de {formatoPesos(balance.pendiente)}
            </Boton>
          )}
        </div>
      )}
    </section>
  );
}
