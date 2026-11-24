import { useActionState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useSesion } from '../sesion/Sesion.jsx';
import { Aviso, Boton, Campo } from '../componentes/Basicos.jsx';

/** Pantalla 1 – Inicio / Login (sección 11.2). */
export function Ingreso() {
  const { usuario, iniciarSesion } = useSesion();
  const navegar = useNavigate();
  const [error, ingresar, pendiente] = useActionState(async (_anterior, formulario) => {
    try {
      await iniciarSesion(formulario.get('email'), formulario.get('contrasena'));
      navegar('/');
      return null;
    } catch (e) {
      return e;
    }
  }, null);

  if (usuario) return <Navigate to="/" replace />;

  return (
    <div className="portada">
      <section className="portada-texto">
        <p className="marca marca-grande">Servi<span>Red</span></p>
        <h1>Plomeros, electricistas y carpinteros de Rosario, con presupuesto y reseñas reales.</h1>
        <p>Pedí hasta tres presupuestos, elegí el que te convenga y seguí el trabajo hasta el final. Solo opinan los clientes que contrataron.</p>
      </section>
      <section className="portada-formulario" aria-labelledby="titulo-ingreso">
        <h2 id="titulo-ingreso">Ingresar</h2>
        <form action={ingresar} className="formulario">
          <Campo etiqueta="Correo electrónico" name="email" type="email" autoComplete="email" required />
          <Campo etiqueta="Contraseña" name="contrasena" type="password" autoComplete="current-password" required />
          <Aviso error={error} />
          <Boton type="submit" pendiente={pendiente}>Ingresar</Boton>
        </form>
        <div className="registro-opciones">
          <p>¿Todavía no tenés cuenta?</p>
          <Link to="/registro/cliente" className="boton boton-secundario">Busco un servicio</Link>
          <Link to="/registro/prestador" className="boton boton-secundario">Ofrezco mi oficio</Link>
        </div>
      </section>
    </div>
  );
}
