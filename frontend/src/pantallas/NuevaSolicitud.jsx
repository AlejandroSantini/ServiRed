import { useActionState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/cliente.js';
import { useCatalogo, useDatos } from '../api/ganchos.js';
import { Aviso, Boton, Campo, Seleccion } from '../componentes/Basicos.jsx';
import { hoy } from '../componentes/formato.js';

/** Iteración 3, Pantalla 2 – Solicitud de presupuesto (CU05.1, RN-C01). */
export function NuevaSolicitud() {
  const [parametros] = useSearchParams();
  const navegar = useNavigate();
  const ids = (parametros.get('prestadores') ?? '').split(',').map(Number).filter(Boolean).slice(0, 3);
  const categorias = useCatalogo('categorias');
  const zonas = useCatalogo('zonas');
  const turnos = useCatalogo('turnos');
  const elegidos = useDatos(() => Promise.all(ids.map((id) => api(`/prestadores/${id}`, { consulta: { vista: 'resumen' } }))), [ids.join(',')]);

  const [error, enviar, pendiente] = useActionState(async (_a, f) => {
    try {
      const solicitud = await api('/solicitudes', {
        metodo: 'POST',
        cuerpo: {
          idCategoria: Number(f.get('idCategoria')),
          idZona: Number(f.get('idZona')),
          idTurnoPreferido: Number(f.get('idTurnoPreferido')),
          descripcion: f.get('descripcion'),
          direccion: f.get('direccion'),
          fechaPreferida: f.get('fechaPreferida'),
          idsPrestadores: ids,
        },
      });
      navegar(`/solicitudes/${solicitud.id}`);
      return null;
    } catch (e) {
      return e;
    }
  }, null);

  if (ids.length === 0) {
    return (
      <section className="pagina pagina-angosta">
        <h1>Pedir presupuesto</h1>
        <p>Primero elegí entre uno y tres prestadores en la <Link to="/buscar">búsqueda</Link>.</p>
      </section>
    );
  }

  return (
    <section className="pagina pagina-angosta">
      <Link to="/buscar" className="volver">Cambiar prestadores</Link>
      <h1>Pedir presupuesto</h1>
      <div className="destinatarios">
        <p>Se lo vas a pedir a:</p>
        <ul>
          {(elegidos.datos ?? []).map((p) => <li key={p.id}>{p.nombre} {p.apellido}</li>)}
        </ul>
      </div>
      <form action={enviar} className="formulario">
        <div className="fila-campos">
          <Seleccion etiqueta="Oficio" name="idCategoria" required vacia="Elegí el oficio" opciones={categorias.datos}
            defaultValue={parametros.get('idCategoria') ?? ''} key={`c${categorias.datos?.length}`} />
          <Seleccion etiqueta="Zona" name="idZona" required vacia="Elegí la zona" opciones={zonas.datos}
            defaultValue={parametros.get('idZona') ?? ''} key={`z${zonas.datos?.length}`} />
        </div>
        <Campo etiqueta="¿Qué problema tenés?">
          {(a) => <textarea {...a} name="descripcion" rows={4} maxLength={1000} required placeholder="Contá qué pasa, desde cuándo y lo que ya probaste." />}
        </Campo>
        <Campo etiqueta="Dirección del trabajo" name="direccion" maxLength={200} required autoComplete="street-address"
          ayuda="Solo la ven los prestadores a los que les pedís presupuesto. Se guarda cifrada." />
        <div className="fila-campos">
          <Campo etiqueta="Fecha preferida" name="fechaPreferida" type="date" min={hoy()} defaultValue={hoy()} required />
          <Seleccion etiqueta="Turno" name="idTurnoPreferido" required opciones={turnos.datos} key={`t${turnos.datos?.length}`} />
        </div>
        <Aviso error={error} />
        <Boton type="submit" pendiente={pendiente}>Enviar pedido</Boton>
        <p className="nota">La solicitud queda abierta 15 días. Si no aceptás ningún presupuesto en ese plazo, vence.</p>
      </form>
    </section>
  );
}
