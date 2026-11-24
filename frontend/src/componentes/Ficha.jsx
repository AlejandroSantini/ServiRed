/**
 * Ficha de una solicitud u orden: el número, el estado y el recorrido del
 * diagrama de estados (sección 12.2.1) con el paso actual marcado.
 * Los estados alternativos (Vencida, Cancelada, Interrumpida) se muestran donde ocurren.
 */
const RECORRIDOS = {
  solicitud: { pasos: ['Abierta', 'Adjudicada', 'Finalizada'], finales: ['Vencida', 'Cancelada'] },
  orden: { pasos: ['Programada', 'En ejecución', 'Finalizada', 'Cerrada'], finales: ['Cancelada'], variantes: { Interrumpida: 'En ejecución' } },
};

export function Ficha({ tipo, numero, estado, subestado, children, acciones }) {
  const { pasos, finales, variantes = {} } = RECORRIDOS[tipo];
  const terminoAntes = finales.includes(estado);
  const actual = pasos.indexOf(variantes[estado] ?? estado);

  return (
    <article className={`ficha ficha-${tipo}`} aria-label={`${tipo === 'orden' ? 'Orden' : 'Solicitud'} ${numero}, estado ${estado}`}>
      <header className="ficha-encabezado">
        <p className="ficha-tipo">{tipo === 'orden' ? 'Orden de servicio' : 'Solicitud de presupuesto'}</p>
        <p className="ficha-numero">N.º {String(numero).padStart(5, '0')}</p>
      </header>
      <ol className="recorrido">
        {pasos.map((paso, i) => {
          const alcanzado = !terminoAntes && i < actual;
          const enCurso = !terminoAntes && i === actual;
          const etiqueta = enCurso && variantes[estado] ? estado : paso;
          return (
            <li key={paso} className={`${alcanzado ? 'hecho' : ''} ${enCurso ? 'actual' : ''} ${enCurso && variantes[estado] ? 'alerta' : ''}`}
              aria-current={enCurso ? 'step' : undefined}>
              <span className="recorrido-nombre">{etiqueta}</span>
              {enCurso && subestado && <span className="recorrido-detalle">{subestado === 'ConPresupuestos' ? 'Con presupuestos' : 'Sin presupuestos'}</span>}
            </li>
          );
        })}
        {terminoAntes && <li className="final" aria-current="step"><span className="recorrido-nombre">{estado}</span></li>}
      </ol>
      <div className="ficha-troquel" aria-hidden="true" />
      <div className="ficha-cuerpo">{children}</div>
      {acciones && <footer className="ficha-acciones">{acciones}</footer>}
    </article>
  );
}

export function Dato({ nombre, children }) {
  return (
    <div className="dato">
      <dt>{nombre}</dt>
      <dd>{children}</dd>
    </div>
  );
}
