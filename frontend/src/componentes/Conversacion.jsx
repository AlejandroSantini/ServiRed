import { useActionState, useState } from 'react';
import { api } from '../api/cliente.js';
import { useDatos } from '../api/ganchos.js';
import { useSesion } from '../sesion/Sesion.jsx';
import { Aviso, Boton, Cargando } from './Basicos.jsx';
import { formatoFechaHora } from './formato.js';

/**
 * Pantalla 5 (11.2) – Mensajería interna asociada a una solicitud (RF06).
 * El cliente tiene una conversación con cada prestador; el prestador solo con el cliente.
 */
export function Conversacion({ solicitud }) {
  const { usuario } = useSesion();
  const esCliente = usuario.rol === 'cliente';
  const [idPrestador, setIdPrestador] = useState(esCliente ? solicitud.destinatarios[0]?.id : usuario.id);
  const mensajes = useDatos(
    () => api(`/solicitudes/${solicitud.id}/mensajes`, { consulta: { idPrestador } }),
    [solicitud.id, idPrestador],
  );
  const cerrada = ['Vencida', 'Cancelada'].includes(solicitud.estado);

  const [error, enviar, pendiente] = useActionState(async (_a, formulario) => {
    try {
      await api(`/solicitudes/${solicitud.id}/mensajes`, { metodo: 'POST', cuerpo: { idPrestador, texto: formulario.get('texto') } });
      mensajes.recargar();
      return null;
    } catch (e) {
      return e;
    }
  }, null);

  const conQuien = esCliente ? solicitud.destinatarios.find((p) => p.id === idPrestador) : solicitud.cliente;

  return (
    <section className="conversacion" aria-labelledby="titulo-mensajes">
      <h2 id="titulo-mensajes">Mensajes</h2>
      {esCliente && solicitud.destinatarios.length > 1 && (
        <div className="pestanas" role="tablist" aria-label="Elegí con quién hablar">
          {solicitud.destinatarios.map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={p.id === idPrestador} onClick={() => setIdPrestador(p.id)}>
              {p.nombre} {p.apellido}
            </button>
          ))}
        </div>
      )}
      <Cargando estado={mensajes}>
        {(lista) => (lista.length === 0
          ? <p className="nota">Todavía no hay mensajes con {conQuien?.nombre}. Coordiná acá los detalles sin compartir tu teléfono.</p>
          : (
            <ol className="mensajes">
              {lista.map((m) => (
                <li key={m.id} className={m.remitente.id === usuario.id ? 'propio' : ''}>
                  <p>{m.texto}</p>
                  <p className="mensaje-pie">{m.remitente.id === usuario.id ? 'Vos' : m.remitente.nombre}, {formatoFechaHora(m.fecha)}</p>
                </li>
              ))}
            </ol>
          ))}
      </Cargando>
      {cerrada
        ? <p className="nota">La solicitud está {solicitud.estado.toLowerCase()}: ya no se pueden enviar mensajes.</p>
        : (
          <form action={enviar} className="mensaje-nuevo">
            <label htmlFor="texto-mensaje" className="solo-lectores">Mensaje para {conQuien?.nombre}</label>
            <textarea id="texto-mensaje" name="texto" rows={2} maxLength={1000} required placeholder={`Escribile a ${conQuien?.nombre ?? ''}`} />
            <Boton type="submit" pendiente={pendiente}>Enviar</Boton>
          </form>
        )}
      <Aviso error={error} />
    </section>
  );
}
