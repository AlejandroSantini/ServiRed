import { useActionState, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/cliente.js';
import { useCatalogo } from '../api/ganchos.js';
import { useSesion } from '../sesion/Sesion.jsx';
import { Aviso, Boton, Campo, Seleccion } from '../componentes/Basicos.jsx';

const AYUDA_CONTRASENA = 'Entre 8 y 64 caracteres, con letras y números. No puede contener tu correo.';

function DatosPersonales({ valores = {}, alCambiar }) {
  const propiedades = (nombre) => (alCambiar
    ? { name: nombre, value: valores[nombre] ?? '', onChange: (e) => alCambiar(nombre, e.target.value) }
    : { name: nombre });
  return (
    <>
      <div className="fila-campos">
        <Campo etiqueta="Nombre" autoComplete="given-name" required {...propiedades('nombre')} />
        <Campo etiqueta="Apellido" autoComplete="family-name" required {...propiedades('apellido')} />
      </div>
      <Campo etiqueta="Correo electrónico" type="email" autoComplete="email" required {...propiedades('email')} />
      <Campo etiqueta="Contraseña" type="password" autoComplete="new-password" required minLength={8} maxLength={64}
        ayuda={AYUDA_CONTRASENA} {...propiedades('contrasena')} />
      <Campo etiqueta="Teléfono (opcional)" type="tel" autoComplete="tel" ayuda="Se guarda cifrado y no se muestra a otros usuarios."
        {...propiedades('telefono')} />
    </>
  );
}

/** Después del alta se inicia sesión con los mismos datos. */
function useAltaEIngreso(ruta) {
  const { iniciarSesion } = useSesion();
  const navegar = useNavigate();
  return async (datos) => {
    await api(ruta, { metodo: 'POST', cuerpo: datos });
    await iniciarSesion(datos.email, datos.contrasena);
    navegar('/');
  };
}

/** Pantalla 3 – Registro de cliente (RF02). */
export function RegistroCliente() {
  const zonas = useCatalogo('zonas');
  const darDeAlta = useAltaEIngreso('/usuarios/clientes');
  const [error, registrar, pendiente] = useActionState(async (_a, f) => {
    try {
      await darDeAlta({
        nombre: f.get('nombre'), apellido: f.get('apellido'), email: f.get('email'), contrasena: f.get('contrasena'),
        telefono: f.get('telefono') || null, idZona: Number(f.get('idZona')),
      });
      return null;
    } catch (e) {
      return e;
    }
  }, null);

  return (
    <section className="pagina pagina-angosta">
      <Link to="/ingresar" className="volver">Volver al ingreso</Link>
      <h1>Crear cuenta de cliente</h1>
      <p className="bajada">Con tu zona te mostramos los prestadores que trabajan cerca.</p>
      <form action={registrar} className="formulario">
        <DatosPersonales />
        <Seleccion etiqueta="Zona donde vivís" name="idZona" required vacia="Elegí tu barrio o localidad" opciones={zonas.datos} />
        <Aviso error={error} />
        <Boton type="submit" pendiente={pendiente}>Crear cuenta</Boton>
      </form>
    </section>
  );
}

const PASOS = ['Tus datos', 'Oficios y zonas', 'Tarifa y horarios'];

/** Pantalla 2 – Registro de prestador en tres pasos (RF01). */
export function RegistroPrestador() {
  const zonas = useCatalogo('zonas');
  const categorias = useCatalogo('categorias');
  const darDeAlta = useAltaEIngreso('/usuarios/prestadores');
  const [paso, setPaso] = useState(0);
  const [datos, setDatos] = useState({ idsZonas: [], idsCategorias: [] });
  const [errorPaso, setErrorPaso] = useState(null);
  const cambiar = (campo, valor) => setDatos((d) => ({ ...d, [campo]: valor }));
  const alternar = (campo, id) => setDatos((d) => ({
    ...d, [campo]: d[campo].includes(id) ? d[campo].filter((x) => x !== id) : [...d[campo], id],
  }));

  const [error, enviar, pendiente] = useActionState(async () => {
    try {
      await darDeAlta({ ...datos, telefono: datos.telefono || null, tarifaBase: Number(datos.tarifaBase) });
      return null;
    } catch (e) {
      return e;
    }
  }, null);

  function siguiente(evento) {
    evento.preventDefault();
    if (!evento.currentTarget.reportValidity()) return;
    if (paso === 1 && (!datos.idsCategorias.length || !datos.idsZonas.length)) {
      setErrorPaso('Elegí al menos un oficio y una zona.');
      return;
    }
    setErrorPaso(null);
    setPaso((p) => p + 1);
  }

  return (
    <section className="pagina pagina-angosta">
      <Link to="/ingresar" className="volver">Volver al ingreso</Link>
      <h1>Ofrecer mi oficio en ServiRed</h1>
      <ol className="pasos" aria-label="Pasos del registro">
        {PASOS.map((nombre, i) => (
          <li key={nombre} className={i === paso ? 'actual' : i < paso ? 'hecho' : ''} aria-current={i === paso ? 'step' : undefined}>
            <span className="pasos-numero">{i + 1}</span> {nombre}
          </li>
        ))}
      </ol>

      <form className="formulario" onSubmit={paso < 2 ? siguiente : undefined} action={paso === 2 ? enviar : undefined}>
        {paso === 0 && <DatosPersonales valores={datos} alCambiar={cambiar} />}
        {paso === 1 && (
          <>
            <fieldset className="opciones">
              <legend>¿Qué oficios hacés?</legend>
              {(categorias.datos ?? []).map((c) => (
                <label key={c.id} className="opcion">
                  <input type="checkbox" checked={datos.idsCategorias.includes(c.id)} onChange={() => alternar('idsCategorias', c.id)} />
                  {c.nombre}
                </label>
              ))}
            </fieldset>
            <fieldset className="opciones">
              <legend>¿En qué zonas trabajás?</legend>
              {(zonas.datos ?? []).map((z) => (
                <label key={z.id} className="opcion">
                  <input type="checkbox" checked={datos.idsZonas.includes(z.id)} onChange={() => alternar('idsZonas', z.id)} />
                  {z.nombre}
                </label>
              ))}
            </fieldset>
          </>
        )}
        {paso === 2 && (
          <>
            <Campo etiqueta="Tarifa base por visita (pesos)" type="number" min="1" step="0.01" required
              value={datos.tarifaBase ?? ''} onChange={(e) => cambiar('tarifaBase', e.target.value)} />
            <Campo etiqueta="Descripción profesional">
              {(a) => <textarea {...a} rows={4} maxLength={1000} value={datos.descripcion ?? ''} onChange={(e) => cambiar('descripcion', e.target.value)}
                placeholder="Años de experiencia, especialidades, si emitís factura…" />}
            </Campo>
            <Campo etiqueta="Disponibilidad horaria" placeholder="Por ejemplo: lunes a viernes de 8 a 17" maxLength={500}
              value={datos.disponibilidad ?? ''} onChange={(e) => cambiar('disponibilidad', e.target.value)} />
          </>
        )}
        <Aviso error={error}>{errorPaso}</Aviso>
        <div className="acciones">
          {paso > 0 && <Boton type="button" variante="secundario" onClick={() => setPaso((p) => p - 1)}>Anterior</Boton>}
          <Boton type="submit" pendiente={pendiente}>{paso < 2 ? 'Siguiente' : 'Crear cuenta de prestador'}</Boton>
        </div>
      </form>
    </section>
  );
}
