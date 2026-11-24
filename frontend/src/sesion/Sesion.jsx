import { createContext, use, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api, guardarToken, hayToken, alVencerSesion } from '../api/cliente.js';

const SesionContext = createContext(null);

export function ProveedorSesion({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(hayToken);
  // RN-S09: el administrador entra aunque la base esté alterada, y se le avisa.
  const [integridad, setIntegridad] = useState(null);

  useEffect(() => {
    alVencerSesion(() => setUsuario(null));
    if (!hayToken()) return undefined;
    let vigente = true;
    api('/auth/yo')
      .then((datos) => vigente && setUsuario(datos))
      .catch(() => {})
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, []);

  async function iniciarSesion(email, contrasena) {
    const respuesta = await api('/auth/login', { metodo: 'POST', cuerpo: { email, contrasena } });
    guardarToken(respuesta.token);
    setUsuario(respuesta.usuario);
    setIntegridad(respuesta.integridad);
    return respuesta.usuario;
  }

  async function cerrarSesion() {
    try {
      await api('/auth/logout', { metodo: 'POST' });
    } finally {
      guardarToken(null);
      setUsuario(null);
      setIntegridad(null);
    }
  }

  const valor = {
    usuario,
    cargando,
    integridad,
    descartarIntegridad: () => setIntegridad(null),
    iniciarSesion,
    cerrarSesion,
    /** Las patentes llegan ya resueltas del Composite (familias → patentes). */
    tienePermiso: (...codigos) => codigos.some((c) => usuario?.permisos?.includes(c)),
  };
  return <SesionContext value={valor}>{children}</SesionContext>;
}

export function useSesion() {
  const sesion = use(SesionContext);
  if (!sesion) throw new Error('useSesion debe usarse dentro de ProveedorSesion.');
  return sesion;
}

/** Protege una pantalla: exige sesión y, si se indican, alguna de las patentes. */
export function Protegida({ patentes = [], children }) {
  const { usuario, cargando, tienePermiso } = useSesion();
  if (cargando) return <p className="cargando">Cargando…</p>;
  if (!usuario) return <Navigate to="/ingresar" replace />;
  if (patentes.length && !tienePermiso(...patentes)) {
    return (
      <section className="pagina">
        <h1>Sin acceso</h1>
        <p>Tu usuario no tiene permiso para ver esta pantalla. Si lo necesitás, pedíselo al administrador.</p>
      </section>
    );
  }
  return children;
}
