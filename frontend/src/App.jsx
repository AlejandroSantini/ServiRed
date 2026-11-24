import { Navigate, Route, Routes } from 'react-router-dom';
import { Protegida, useSesion } from './sesion/Sesion.jsx';
import { Marco } from './componentes/Marco.jsx';
import { Ingreso } from './pantallas/Ingreso.jsx';
import { RegistroCliente, RegistroPrestador } from './pantallas/Registro.jsx';
import { Busqueda, PerfilPrestador } from './pantallas/Busqueda.jsx';
import { NuevaSolicitud } from './pantallas/NuevaSolicitud.jsx';
import { DetalleSolicitud, Solicitudes } from './pantallas/Solicitudes.jsx';
import { DetalleOrden, Ordenes } from './pantallas/Ordenes.jsx';
import { Agenda, Historial, Notificaciones, Planes, ResenasRecibidas } from './pantallas/Seguimiento.jsx';
import { Bitacora, Integridad, Moderacion, Reportes, Usuarios } from './pantallas/admin/Administracion.jsx';

/** Pantalla de inicio según el tipo de usuario. */
function Inicio() {
  const { usuario } = useSesion();
  const destino = { cliente: '/buscar', prestador: '/solicitudes', administrador: '/admin/moderacion' }[usuario.rol] ?? '/notificaciones';
  return <Navigate to={destino} replace />;
}

const conPermiso = (patentes, elemento) => <Protegida patentes={patentes}>{elemento}</Protegida>;

export function App() {
  return (
    <Routes>
      <Route path="/ingresar" element={<Ingreso />} />
      <Route path="/registro/cliente" element={<RegistroCliente />} />
      <Route path="/registro/prestador" element={<RegistroPrestador />} />
      <Route element={<Protegida><Marco /></Protegida>}>
        <Route index element={<Inicio />} />
        <Route path="buscar" element={conPermiso(['PRESTADOR_BUSCAR'], <Busqueda />)} />
        <Route path="prestadores/:id" element={conPermiso(['PRESTADOR_BUSCAR'], <PerfilPrestador />)} />
        <Route path="solicitudes" element={conPermiso(['SOLICITUD_CREAR', 'PRESUPUESTO_EMITIR'], <Solicitudes />)} />
        <Route path="solicitudes/nueva" element={conPermiso(['SOLICITUD_CREAR'], <NuevaSolicitud />)} />
        <Route path="solicitudes/:id" element={conPermiso(['SOLICITUD_CREAR', 'PRESUPUESTO_EMITIR'], <DetalleSolicitud />)} />
        <Route path="ordenes" element={conPermiso(['ORDEN_CONFIRMAR', 'ORDEN_EJECUTAR'], <Ordenes />)} />
        <Route path="ordenes/:id" element={conPermiso(['ORDEN_CONFIRMAR', 'ORDEN_EJECUTAR'], <DetalleOrden />)} />
        <Route path="agenda" element={conPermiso(['AGENDA_GESTIONAR'], <Agenda />)} />
        <Route path="historial" element={conPermiso(['HISTORIAL_VER'], <Historial />)} />
        <Route path="resenas" element={conPermiso(['RESENA_DENUNCIAR'], <ResenasRecibidas />)} />
        <Route path="planes" element={conPermiso(['PLAN_GESTIONAR', 'BALANCE_VER'], <Planes />)} />
        <Route path="notificaciones" element={<Notificaciones />} />
        <Route path="admin/moderacion" element={conPermiso(['DENUNCIA_MODERAR'], <Moderacion />)} />
        <Route path="admin/reportes" element={conPermiso(['REPORTES_VER', 'COMISION_CONFIGURAR'], <Reportes />)} />
        <Route path="admin/usuarios" element={conPermiso(['USUARIO_GESTIONAR'], <Usuarios />)} />
        <Route path="admin/bitacora" element={conPermiso(['BITACORA_VER'], <Bitacora />)} />
        <Route path="admin/integridad" element={conPermiso(['INTEGRIDAD_GESTIONAR', 'BACKUP_GESTIONAR'], <Integridad />)} />
        <Route path="*" element={<section className="pagina"><h1>No encontramos esa página</h1></section>} />
      </Route>
    </Routes>
  );
}
