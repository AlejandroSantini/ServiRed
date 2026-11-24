import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCatalogo, useConsulta } from '../api/ganchos.js';
import { Aviso, Boton, Cargando, Estrellas, Seleccion, Vacio } from '../componentes/Basicos.jsx';
import { formatoFecha, formatoPesos } from '../componentes/formato.js';

const MAX_DESTINATARIOS = 3;
const CALIFICACIONES = [
  { id: '0', nombre: 'Cualquiera' }, { id: '3', nombre: '3 o más' }, { id: '4', nombre: '4 o más' }, { id: '4.5', nombre: '4,5 o más' },
];

/** Pantalla 4 – Búsqueda y filtrado (RF03). Desde acá se eligen hasta 3 prestadores para pedir presupuesto. */
export function Busqueda() {
  const [parametros, setParametros] = useSearchParams();
  const filtros = {
    idCategoria: parametros.get('idCategoria') ?? '',
    idZona: parametros.get('idZona') ?? '',
    calificacionMinima: parametros.get('calificacionMinima') ?? '0',
  };
  const categorias = useCatalogo('categorias');
  const zonas = useCatalogo('zonas');
  const resultados = useConsulta('/prestadores', filtros);
  const [elegidos, setElegidos] = useState([]);
  const navegar = useNavigate();

  const cambiarFiltro = (campo, valor) => {
    const nuevos = new URLSearchParams(parametros);
    if (valor) nuevos.set(campo, valor);
    else nuevos.delete(campo);
    setParametros(nuevos, { replace: true });
    setElegidos([]);
  };
  const alternar = (id) => setElegidos((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));
  const puedePedir = elegidos.length > 0 && filtros.idCategoria && filtros.idZona;

  function pedirPresupuesto() {
    const consulta = new URLSearchParams({ prestadores: elegidos.join(','), idCategoria: filtros.idCategoria, idZona: filtros.idZona });
    navegar(`/solicitudes/nueva?${consulta}`);
  }

  return (
    <section className="pagina">
      <h1>¿Qué necesitás arreglar?</h1>
      <form className="filtros" onSubmit={(e) => e.preventDefault()} aria-label="Filtros de búsqueda">
        <Seleccion etiqueta="Oficio" vacia="Todos los oficios" opciones={categorias.datos} value={filtros.idCategoria}
          onChange={(e) => cambiarFiltro('idCategoria', e.target.value)} />
        <Seleccion etiqueta="Zona" vacia="Todas las zonas" opciones={zonas.datos} value={filtros.idZona}
          onChange={(e) => cambiarFiltro('idZona', e.target.value)} />
        <Seleccion etiqueta="Calificación" opciones={CALIFICACIONES} value={filtros.calificacionMinima}
          onChange={(e) => cambiarFiltro('calificacionMinima', e.target.value === '0' ? '' : e.target.value)} />
      </form>

      <Cargando estado={resultados}>
        {(datos) => (datos.items.length === 0
          ? <Vacio titulo={datos.mensaje} />
          : (
            <>
              <p className="resumen" aria-live="polite">
                {datos.total} {datos.total === 1 ? 'prestador encontrado' : 'prestadores encontrados'}.
                {(!filtros.idCategoria || !filtros.idZona) && ' Elegí un oficio y una zona para pedir presupuesto a hasta tres.'}
              </p>
              <ul className="directorio">
                {datos.items.map((p) => (
                  <li key={p.id} className={elegidos.includes(p.id) ? 'elegido' : ''}>
                    <label className="directorio-elegir">
                      <input type="checkbox" checked={elegidos.includes(p.id)} onChange={() => alternar(p.id)}
                        disabled={!filtros.idCategoria || !filtros.idZona || (!elegidos.includes(p.id) && elegidos.length >= MAX_DESTINATARIOS)} />
                      <span className="solo-lectores">Elegir a {p.nombre} {p.apellido}</span>
                    </label>
                    <div className="directorio-principal">
                      <Link to={`/prestadores/${p.id}`} className="directorio-nombre">{p.nombre} {p.apellido}</Link>
                      {p.plan && <span className={`sello sello-${p.plan.toLowerCase()}`}>{p.plan}</span>}
                      <p className="directorio-oficios">{p.categorias.map((c) => c.nombre).join(', ')}</p>
                      <p className="directorio-zonas">{p.zonas.map((z) => z.nombre).join(', ')}</p>
                    </div>
                    <div className="directorio-numeros">
                      <Estrellas valor={p.reputacionPromedio} />
                      <span>{p.trabajosRealizados} {p.trabajosRealizados === 1 ? 'trabajo' : 'trabajos'}</span>
                      <span>Desde {formatoPesos(p.tarifaBase)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ))}
      </Cargando>

      {elegidos.length > 0 && (
        <div className="barra-accion" role="region" aria-label="Prestadores elegidos">
          <p>{elegidos.length} de {MAX_DESTINATARIOS} elegidos</p>
          <Boton onClick={pedirPresupuesto} disabled={!puedePedir}>Pedir presupuesto</Boton>
        </div>
      )}
    </section>
  );
}

/** Perfil público del prestador (Iteración 3 Pantalla 1, Iteración 6 Pantalla 3). */
export function PerfilPrestador() {
  const { id } = useParams();
  const perfil = useConsulta(`/prestadores/${id}`);
  return (
    <section className="pagina">
      <Link to="/buscar" className="volver">Volver a la búsqueda</Link>
      <Cargando estado={perfil}>
        {(p) => (
          <div className="perfil">
            <header className="perfil-encabezado">
              <div>
                <h1>{p.nombre} {p.apellido}</h1>
                <p className="bajada">{p.categorias.map((c) => c.nombre).join(', ')} en {p.zonas.map((z) => z.nombre).join(', ')}</p>
              </div>
              {p.plan && <span className={`sello sello-${p.plan.toLowerCase()}`}>{p.plan}</span>}
            </header>
            <dl className="cifras">
              <div><dt>Calificación</dt><dd><Estrellas valor={p.reputacionPromedio} /></dd></div>
              <div><dt>Trabajos realizados</dt><dd>{p.trabajosRealizados}</dd></div>
              <div><dt>Tarifa base</dt><dd>{formatoPesos(p.tarifaBase)}</dd></div>
            </dl>
            {p.descripcion && <p className="perfil-descripcion">{p.descripcion}</p>}
            {p.disponibilidad && <p><strong>Horarios:</strong> {p.disponibilidad}</p>}
            {!p.disponibilidadActiva && <Aviso tipo="info">Por ahora no está tomando trabajos nuevos.</Aviso>}
            {p.disponibilidadActiva && (
              <Link className="boton boton-primario" to={`/solicitudes/nueva?prestadores=${p.id}`}>Pedirle un presupuesto</Link>
            )}

            <h2>Valoraciones</h2>
            {p.resenasRecientes.length === 0
              ? <Vacio titulo="Todavía no tiene valoraciones." />
              : (
                <ul className="resenas">
                  {p.resenasRecientes.map((r) => (
                    <li key={r.id}>
                      <Estrellas valor={r.puntaje} />
                      {r.comentario && <blockquote>{r.comentario}</blockquote>}
                      <p className="resena-pie">{r.cliente.nombre}, {r.categoria}, {formatoFecha(r.fechaFeedback.slice(0, 10))}</p>
                    </li>
                  ))}
                </ul>
              )}
          </div>
        )}
      </Cargando>
    </section>
  );
}
