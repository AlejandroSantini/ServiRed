import { useActionState, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/cliente.js';
import { useAccion, useConsulta } from '../api/ganchos.js';
import { useSesion } from '../sesion/Sesion.jsx';
import { Aviso, Boton, Campo, Cargando, Dialogo, Estrellas, Vacio } from '../componentes/Basicos.jsx';
import { Dato, Ficha } from '../componentes/Ficha.jsx';
import { formatoFecha, formatoFechaHora, formatoPesos, nombreCompleto } from '../componentes/formato.js';

export function Ordenes() {
  const ordenes = useConsulta('/ordenes');
  return (
    <section className="pagina">
      <h1>Órdenes de servicio</h1>
      <Cargando estado={ordenes}>
        {(lista) => (lista.length === 0
          ? <Vacio titulo="No tenés órdenes. Se generan cuando se acepta un presupuesto." />
          : <ListaOrdenes ordenes={lista} />)}
      </Cargando>
    </section>
  );
}

export function ListaOrdenes({ ordenes }) {
  const { usuario } = useSesion();
  return (
    <ul className="lista">
      {ordenes.map((o) => (
        <li key={o.id}>
          <Link to={`/ordenes/${o.id}`} className="lista-enlace">
            <span className="lista-numero">N.º {o.id}</span>
            <span className="lista-titulo">{o.solicitud.categoria.nombre}, {formatoFecha(o.fechaProgramada)} ({o.turno.nombre.toLowerCase()})</span>
            <span className="lista-detalle">{usuario.rol === 'cliente' ? nombreCompleto(o.prestador) : `${nombreCompleto(o.cliente)}, ${o.solicitud.direccion}`}</span>
            <span className={`estado estado-${o.estado.toLowerCase().replace(' ', '-')}`}>{o.estado}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Iteración 3, Pantallas 5 (seguimiento, cliente) y 6 (orden de servicio, prestador). */
export function DetalleOrden() {
  const { id } = useParams();
  const { usuario } = useSesion();
  const orden = useConsulta(`/ordenes/${id}`);
  const accion = useAccion();
  const [dialogo, setDialogo] = useState(null);

  const ejecutar = (ruta, cuerpo) => accion.ejecutar(async () => {
    await api(`/ordenes/${id}/${ruta}`, { metodo: 'POST', cuerpo });
    setDialogo(null);
    orden.recargar();
  });

  return (
    <section className="pagina pagina-angosta">
      <Link to="/ordenes" className="volver">Volver a órdenes</Link>
      <Cargando estado={orden}>
        {(o) => {
          const esCliente = usuario.rol === 'cliente';
          const acciones = esCliente ? accionesCliente(o, setDialogo, ejecutar) : accionesPrestador(o, setDialogo, ejecutar);
          return (
            <>
              <Ficha tipo="orden" numero={o.id} estado={o.estado} acciones={acciones.length ? acciones : null}>
                <dl className="datos">
                  <Dato nombre="Trabajo">{o.solicitud.categoria.nombre}</Dato>
                  <Dato nombre="Fecha">{formatoFecha(o.fechaProgramada)}, {o.turno.nombre.toLowerCase()}</Dato>
                  <Dato nombre="Dirección">{o.solicitud.direccion}</Dato>
                  <Dato nombre={esCliente ? 'Prestador' : 'Cliente'}>{nombreCompleto(esCliente ? o.prestador : o.cliente)}</Dato>
                  <Dato nombre="Presupuesto">{formatoPesos(o.presupuesto.montoEstimado)}, {o.presupuesto.tiempoEstimadoHoras} h</Dato>
                  {o.fechaInicioReal && <Dato nombre="Inicio">{formatoFechaHora(o.fechaInicioReal)}</Dato>}
                  {o.fechaFinReal && <Dato nombre="Finalización">{formatoFechaHora(o.fechaFinReal)}</Dato>}
                  {o.fechaCierre && <Dato nombre="Cierre">{formatoFechaHora(o.fechaCierre)}{o.cerradaSinConfirmacion ? ', automático' : ''}</Dato>}
                </dl>
                {o.motivoInterrupcion && <Aviso tipo="info">Interrumpida: {o.motivoInterrupcion}</Aviso>}
                {o.confirmarHasta && esCliente && (
                  <Aviso tipo="info">El prestador terminó el trabajo. Confirmá y calificalo antes del {formatoFechaHora(o.confirmarHasta)}; si no, la orden se cierra sola y ya no vas a poder calificar.</Aviso>
                )}
                {o.solicitud.descripcion && <p className="ficha-descripcion">{o.solicitud.descripcion}</p>}
              </Ficha>
              <Aviso error={accion.error} />
              <p><Link to={`/solicitudes/${o.solicitud.id}`}>Ver la solicitud y los mensajes</Link></p>

              <Calificar abierto={dialogo === 'calificar'} orden={o} alCerrar={() => setDialogo(null)} alTerminar={orden.recargar} />
              <ConMotivo abierto={dialogo === 'interrumpir'} titulo="Registrar interrupción" etiqueta="¿Por qué se interrumpe?"
                boton="Registrar interrupción" pendiente={accion.pendiente} error={accion.error}
                alCerrar={() => setDialogo(null)} alEnviar={(motivo) => ejecutar('interrumpir', { motivo })} />
              <ConMotivo abierto={dialogo === 'cancelar'} titulo="Cancelar la orden"
                etiqueta={o.estado === 'Interrumpida' ? '¿Por qué no se puede continuar?' : 'Motivo (opcional)'}
                obligatorio={o.estado === 'Interrumpida'} boton="Cancelar la orden" peligro pendiente={accion.pendiente} error={accion.error}
                aviso="La solicitud también queda cancelada." alCerrar={() => setDialogo(null)} alEnviar={(motivo) => ejecutar('cancelar', { motivo })} />
              <Dialogo abierto={dialogo === 'confirmar'} alCerrar={() => setDialogo(null)} titulo="Confirmar sin calificar">
                <p>Si confirmás sin calificar, la orden se cierra y ya no vas a poder dejar una valoración.</p>
                <div className="acciones">
                  <Boton variante="secundario" onClick={() => setDialogo('calificar')}>Prefiero calificar</Boton>
                  <Boton pendiente={accion.pendiente} onClick={() => ejecutar('confirmar')}>Confirmar sin calificar</Boton>
                </div>
              </Dialogo>
            </>
          );
        }}
      </Cargando>
    </section>
  );
}

function accionesCliente(o, setDialogo) {
  const botones = [];
  if (o.estado === 'Finalizada' && o.confirmarHasta) {
    botones.push(<Boton key="c" onClick={() => setDialogo('calificar')}>Confirmar y calificar</Boton>);
    botones.push(<Boton key="s" variante="secundario" onClick={() => setDialogo('confirmar')}>Confirmar sin calificar</Boton>);
  }
  if (o.estado === 'Programada') botones.push(<Boton key="x" variante="peligro" onClick={() => setDialogo('cancelar')}>Cancelar la orden</Boton>);
  return botones;
}

function accionesPrestador(o, setDialogo, ejecutar) {
  const botones = [];
  if (o.estado === 'Programada') {
    botones.push(<Boton key="i" onClick={() => ejecutar('iniciar')}>Iniciar el trabajo</Boton>);
    botones.push(<Boton key="x" variante="peligro" onClick={() => setDialogo('cancelar')}>Cancelar la orden</Boton>);
  }
  if (o.estado === 'En ejecución') {
    botones.push(<Boton key="f" onClick={() => ejecutar('finalizar')}>Informar finalización</Boton>);
    botones.push(<Boton key="p" variante="secundario" onClick={() => setDialogo('interrumpir')}>Registrar interrupción</Boton>);
  }
  if (o.estado === 'Interrumpida') {
    botones.push(<Boton key="r" onClick={() => ejecutar('reanudar')}>Reanudar el trabajo</Boton>);
    botones.push(<Boton key="x" variante="peligro" onClick={() => setDialogo('cancelar')}>No se puede continuar</Boton>);
  }
  return botones;
}

function ConMotivo({ abierto, titulo, etiqueta, boton, obligatorio = true, peligro = false, aviso, pendiente, error, alCerrar, alEnviar }) {
  return (
    <Dialogo abierto={abierto} alCerrar={alCerrar} titulo={titulo}>
      <form className="formulario" onSubmit={(e) => { e.preventDefault(); alEnviar(new FormData(e.currentTarget).get('motivo')); }}>
        {aviso && <Aviso tipo="info">{aviso}</Aviso>}
        <Campo etiqueta={etiqueta}>
          {(a) => <textarea {...a} name="motivo" rows={3} maxLength={500} required={obligatorio} />}
        </Campo>
        <Aviso error={error} />
        <div className="acciones">
          <Boton type="button" variante="secundario" onClick={alCerrar}>Volver</Boton>
          <Boton type="submit" variante={peligro ? 'peligro' : 'primario'} pendiente={pendiente}>{boton}</Boton>
        </div>
      </form>
    </Dialogo>
  );
}

/** Iteración 6, Pantalla 2 – Modal de calificación (CU09.1, RN-V01, RN-V02). */
function Calificar({ abierto, orden, alCerrar, alTerminar }) {
  const [puntaje, setPuntaje] = useState(0);
  const [comentario, setComentario] = useState('');
  const [faltaPuntaje, setFaltaPuntaje] = useState(false);
  const [error, enviar, pendiente] = useActionState(async () => {
    if (!puntaje) {
      setFaltaPuntaje(true);
      return null;
    }
    try {
      await api(`/ordenes/${orden.id}/resena`, { metodo: 'POST', cuerpo: { puntaje, comentario: comentario || null } });
      alCerrar();
      alTerminar();
      return null;
    } catch (e) {
      return e;
    }
  }, null);

  return (
    <Dialogo abierto={abierto} alCerrar={alCerrar} titulo={`Calificar a ${orden.prestador.nombre}`}>
      <form action={enviar} className="formulario">
        <Estrellas nombre="puntaje" valor={puntaje} invalido={faltaPuntaje} alCambiar={(n) => { setPuntaje(n); setFaltaPuntaje(false); }} />
        {faltaPuntaje && <p className="campo-error" role="alert">Debe asignar una puntuación para continuar.</p>}
        <Campo etiqueta="Comentario (opcional)">
          {(a) => (
            <textarea {...a} rows={4} maxLength={500} value={comentario} onChange={(e) => setComentario(e.target.value.slice(0, 500))} />
          )}
        </Campo>
        <p className="contador-caracteres" aria-live="polite">{comentario.length} de 500</p>
        <p className="nota">Una vez enviada, la valoración no se puede editar ni borrar.</p>
        <Aviso error={error} />
        <Boton type="submit" pendiente={pendiente}>Enviar valoración y cerrar servicio</Boton>
      </form>
    </Dialogo>
  );
}
