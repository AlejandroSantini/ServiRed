import { useEffect, useId, useRef } from 'react';

/** Error de la API. Muestra la regla que no se cumplió para que el usuario (y el docente) la identifiquen. */
export function Aviso({ error, tipo = 'error', children }) {
  if (!error && !children) return null;
  return (
    <div className={`aviso aviso-${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      <p>{children ?? error.message}</p>
      {error?.regla && error.regla !== 'DATOS' && <p className="aviso-regla">Regla {error.regla}</p>}
    </div>
  );
}

export function Campo({ etiqueta, ayuda, error, children, ...props }) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      {children
        ? children({ id, 'aria-describedby': ayuda ? idAyuda : undefined })
        : <input id={id} aria-describedby={ayuda ? idAyuda : undefined} aria-invalid={error ? true : undefined} {...props} />}
      {ayuda && <p className="campo-ayuda" id={idAyuda}>{ayuda}</p>}
    </div>
  );
}

export function Seleccion({ etiqueta, opciones, vacia, ayuda, ...props }) {
  return (
    <Campo etiqueta={etiqueta} ayuda={ayuda}>
      {(accesibilidad) => (
        <select {...accesibilidad} {...props}>
          {vacia !== undefined && <option value="">{vacia}</option>}
          {(opciones ?? []).map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
      )}
    </Campo>
  );
}

export function Boton({ variante = 'primario', pendiente = false, children, ...props }) {
  return (
    <button className={`boton boton-${variante}`} disabled={pendiente || props.disabled} aria-busy={pendiente || undefined} {...props}>
      {pendiente ? 'Procesando…' : children}
    </button>
  );
}

export function Cargando({ estado, children }) {
  if (estado.cargando && !estado.datos) return <p className="cargando">Cargando…</p>;
  if (estado.error) return <Aviso error={estado.error} />;
  return children(estado.datos);
}

export function Vacio({ titulo, children }) {
  return (
    <div className="vacio">
      <p className="vacio-titulo">{titulo}</p>
      {children && <div>{children}</div>}
    </div>
  );
}

/** Diálogo modal nativo (<dialog>): maneja foco, Escape y fondo inerte. */
export function Dialogo({ abierto, alCerrar, titulo, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialogo = ref.current;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);
  return (
    <dialog ref={ref} className="dialogo" onClose={alCerrar} aria-labelledby={titulo ? 'titulo-dialogo' : undefined}>
      {abierto && (
        <>
          <div className="dialogo-encabezado">
            <h2 id="titulo-dialogo">{titulo}</h2>
            <button type="button" className="boton-cerrar" onClick={alCerrar} aria-label="Cerrar">×</button>
          </div>
          {children}
        </>
      )}
    </dialog>
  );
}

/** Puntaje de 1 a 5. Solo lectura o como grupo de opciones accesible (RN-V02). */
export function Estrellas({ valor = 0, nombre, alCambiar, invalido = false }) {
  if (!alCambiar) {
    const redondeado = Math.round(valor);
    return (
      <span className="estrellas" aria-label={valor ? `${valor} de 5` : 'Sin calificaciones'}>
        {[1, 2, 3, 4, 5].map((n) => <span key={n} aria-hidden="true" className={n <= redondeado ? 'llena' : ''}>★</span>)}
        <span className="estrellas-numero">{valor ? valor.toFixed(1).replace('.', ',') : 'Nuevo'}</span>
      </span>
    );
  }
  return (
    <fieldset className={`estrellas-entrada${invalido ? ' invalido' : ''}`}>
      <legend>Puntaje</legend>
      {[1, 2, 3, 4, 5].map((n) => (
        <label key={n} className={n <= valor ? 'llena' : ''}>
          <input type="radio" name={nombre} value={n} checked={valor === n} onChange={() => alCambiar(n)} />
          <span aria-hidden="true">★</span>
          <span className="solo-lectores">{n} {n === 1 ? 'estrella' : 'estrellas'}</span>
        </label>
      ))}
    </fieldset>
  );
}
