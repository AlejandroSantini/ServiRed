import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSesion } from '../sesion/Sesion.jsx';
import { useConsulta } from '../api/ganchos.js';

/** El menú se arma con las patentes del usuario: lo que no puede usar, no lo ve (RN-S06). */
const MENU = [
  { a: '/buscar', texto: 'Buscar', patentes: ['PRESTADOR_BUSCAR'] },
  { a: '/solicitudes', texto: 'Solicitudes', patentes: ['SOLICITUD_CREAR', 'PRESUPUESTO_EMITIR'] },
  { a: '/ordenes', texto: 'Órdenes', patentes: ['ORDEN_CONFIRMAR', 'ORDEN_EJECUTAR'] },
  { a: '/agenda', texto: 'Agenda', patentes: ['AGENDA_GESTIONAR'] },
  { a: '/historial', texto: 'Historial', patentes: ['HISTORIAL_VER'] },
  { a: '/resenas', texto: 'Reseñas', patentes: ['RESENA_DENUNCIAR'] },
  { a: '/planes', texto: 'Planes y comisiones', patentes: ['PLAN_GESTIONAR', 'BALANCE_VER'] },
  { a: '/admin/moderacion', texto: 'Moderación', patentes: ['DENUNCIA_MODERAR'] },
  { a: '/admin/reportes', texto: 'Reportes', patentes: ['REPORTES_VER', 'COMISION_CONFIGURAR'] },
  { a: '/admin/usuarios', texto: 'Usuarios', patentes: ['USUARIO_GESTIONAR'] },
  { a: '/admin/bitacora', texto: 'Bitácora', patentes: ['BITACORA_VER'] },
  { a: '/admin/integridad', texto: 'Integridad y backups', patentes: ['INTEGRIDAD_GESTIONAR', 'BACKUP_GESTIONAR'] },
];

export function Marco() {
  const { usuario, cerrarSesion, tienePermiso, integridad, descartarIntegridad } = useSesion();
  const ubicacion = useLocation();
  const navegar = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);
  // Se vuelve a consultar al cambiar de pantalla: así el contador queda al día sin sondear.
  const avisos = useConsulta('/notificaciones', { noLeidas: 'true', _: ubicacion.pathname });
  const noLeidas = avisos.datos?.noLeidas ?? 0;
  const opciones = MENU.filter((m) => tienePermiso(...m.patentes));

  async function salir() {
    await cerrarSesion();
    navegar('/ingresar');
  }

  return (
    <div className="marco">
      <a className="saltar" href="#contenido">Ir al contenido</a>
      <header className="barra">
        <Link to="/" className="marca" aria-label="ServiRed, inicio">Servi<span>Red</span></Link>
        <button type="button" className="boton-menu" aria-expanded={menuAbierto} aria-controls="menu-principal"
          onClick={() => setMenuAbierto((a) => !a)}>
          Menú
        </button>
        <nav id="menu-principal" className={`menu ${menuAbierto ? 'abierto' : ''}`} aria-label="Principal" onClick={() => setMenuAbierto(false)}>
          {opciones.map((m) => <NavLink key={m.a} to={m.a}>{m.texto}</NavLink>)}
        </nav>
        <div className="barra-usuario">
          <Link to="/notificaciones" className="campana" aria-label={`Notificaciones${noLeidas ? `: ${noLeidas} sin leer` : ''}`}>
            Avisos{noLeidas > 0 && <span className="contador">{noLeidas}</span>}
          </Link>
          <span className="usuario-nombre" title={usuario.email}>{usuario.nombre}</span>
          <button type="button" className="boton-texto" onClick={salir}>Salir</button>
        </div>
      </header>
      {integridad && (
        <div className="aviso aviso-error aviso-global" role="alert">
          <p>
            Se detectaron {integridad.inconsistencias.length} modificaciones externas en la base de datos. Los demás usuarios no
            pueden ingresar hasta que las revises. <Link to="/admin/integridad" onClick={descartarIntegridad}>Revisar integridad</Link>
          </p>
        </div>
      )}
      <main id="contenido" className="contenido">
        <Outlet />
      </main>
    </div>
  );
}
