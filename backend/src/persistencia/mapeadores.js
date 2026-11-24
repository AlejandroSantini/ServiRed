/**
 * Conversión entre objetos del dominio (camelCase) y filas de la base (snake_case).
 * Lo comparten las implementaciones en memoria y PostgreSQL, así ambas guardan
 * exactamente las mismas columnas (y los mismos dígitos verificadores).
 */
import { Cliente } from '../dominio/usuarios/Cliente.js';
import { Prestador } from '../dominio/usuarios/Prestador.js';
import { Administrador } from '../dominio/usuarios/Administrador.js';
import { EstadoUsuario } from '../dominio/usuarios/EstadoUsuario.js';
import { Patente } from '../dominio/seguridad/Patente.js';
import { Familia } from '../dominio/seguridad/Familia.js';
import { Sesion } from '../dominio/seguridad/Sesion.js';
import { EntradaBitacora } from '../dominio/seguridad/EntradaBitacora.js';
import { Criticidad } from '../dominio/seguridad/Criticidad.js';

export const TABLA_SUBTIPO = Object.freeze({ cliente: 'cliente', prestador: 'prestador', administrador: 'administrador' });

// ---------- Usuario (herencia: una tabla por subclase, PK = FK a usuario) ----------

export function usuarioAFilas(usuario, cifrador) {
  const fila = {
    id_usuario: usuario.id,
    rol: usuario.rol,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    email: usuario.email,
    hash_contrasena: usuario.hashContrasena,
    telefono_cifrado: cifrador.cifrar(usuario.telefono),
    id_estado: usuario.estado.id,
    intentos_fallidos: usuario.intentosFallidos,
    fecha_alta: usuario.fechaAlta,
    fecha_ultimo_acceso: usuario.fechaUltimoAcceso,
  };

  let subtipo = { id_usuario: usuario.id };
  let zonas = [];
  let categorias = [];
  if (usuario instanceof Cliente) {
    subtipo = { ...subtipo, id_zona: usuario.zona.id };
  } else if (usuario instanceof Prestador) {
    subtipo = {
      ...subtipo,
      tarifa_base: usuario.tarifaBase,
      descripcion: usuario.descripcion,
      disponibilidad: usuario.disponibilidad,
      disponibilidad_activa: usuario.disponibilidadActiva,
      reputacion_promedio: usuario.reputacionPromedio,
    };
    zonas = usuario.zonas.map((z) => z.id);
    categorias = usuario.categorias.map((c) => c.id);
  }

  return {
    usuario: fila,
    subtipo: { tabla: TABLA_SUBTIPO[usuario.rol], fila: subtipo },
    zonas,
    categorias,
    permisos: usuario.permisos.map((p) => p.id),
  };
}

/** @param {{fila, subtipo, zonas, categorias, permisos}} datos zonas/categorías/permisos ya reconstruidos */
export function filasAUsuario({ fila, subtipo, zonas = [], categorias = [], permisos = [] }, cifrador) {
  const comunes = {
    id: Number(fila.id_usuario),
    nombre: fila.nombre,
    apellido: fila.apellido,
    email: fila.email,
    hashContrasena: fila.hash_contrasena,
    telefono: cifrador.descifrar(fila.telefono_cifrado),
    estado: EstadoUsuario.desdeId(fila.id_estado),
    intentosFallidos: Number(fila.intentos_fallidos),
    fechaAlta: new Date(fila.fecha_alta),
    fechaUltimoAcceso: fila.fecha_ultimo_acceso ? new Date(fila.fecha_ultimo_acceso) : null,
    permisos,
  };
  switch (fila.rol) {
    case 'cliente':
      return new Cliente({ ...comunes, zona: zonas[0] });
    case 'prestador':
      return new Prestador({
        ...comunes,
        zonas,
        categorias,
        tarifaBase: Number(subtipo.tarifa_base),
        descripcion: subtipo.descripcion,
        disponibilidad: subtipo.disponibilidad,
        disponibilidadActiva: subtipo.disponibilidad_activa,
        reputacionPromedio: Number(subtipo.reputacion_promedio),
      });
    case 'administrador':
      return new Administrador(comunes);
    default:
      throw new Error(`Rol desconocido: ${fila.rol}`);
  }
}

// ---------- Permisos (Composite) ----------

export function componenteAFila(componente) {
  return {
    id_permiso: componente.id,
    codigo: componente.codigo,
    nombre: componente.nombre,
    es_familia: componente.esFamilia(),
  };
}

/** Reconstruye el árbol completo: primero crea todos los nodos y después los enlaza. */
export function filasAArbolPermisos(filasPermiso, filasHijo) {
  const porId = new Map();
  for (const fila of filasPermiso) {
    const Clase = fila.es_familia ? Familia : Patente;
    porId.set(Number(fila.id_permiso), new Clase({ id: Number(fila.id_permiso), codigo: fila.codigo, nombre: fila.nombre }));
  }
  for (const { id_padre: idPadre, id_hijo: idHijo } of filasHijo) {
    const padre = porId.get(Number(idPadre));
    const hijo = porId.get(Number(idHijo));
    if (padre && hijo) padre.agregar(hijo);
  }
  return new Map([...porId.values()].map((c) => [c.codigo, c]));
}

// ---------- Sesión ----------

export function sesionAFila(sesion) {
  return {
    id_sesion: sesion.id,
    id_usuario: sesion.idUsuario,
    fecha_inicio: sesion.fechaInicio,
    fecha_expiracion: sesion.fechaExpiracion,
    fecha_cierre: sesion.fechaCierre,
    ip: sesion.ip,
  };
}

export function filaASesion(fila) {
  return new Sesion({
    id: fila.id_sesion,
    idUsuario: Number(fila.id_usuario),
    fechaInicio: new Date(fila.fecha_inicio),
    fechaExpiracion: new Date(fila.fecha_expiracion),
    fechaCierre: fila.fecha_cierre ? new Date(fila.fecha_cierre) : null,
    ip: fila.ip,
  });
}

// ---------- Bitácora ----------

export function entradaAFila(entrada) {
  return {
    id_bitacora: entrada.id,
    fecha: entrada.fecha,
    id_usuario: entrada.idUsuario,
    email_usuario: entrada.emailUsuario,
    modulo: entrada.modulo,
    evento: entrada.evento,
    descripcion: entrada.descripcion,
    id_criticidad: entrada.criticidad.id,
    ip: entrada.ip,
  };
}

export function filaAEntrada(fila) {
  return new EntradaBitacora({
    id: Number(fila.id_bitacora),
    fecha: new Date(fila.fecha),
    idUsuario: fila.id_usuario === null ? null : Number(fila.id_usuario),
    emailUsuario: fila.email_usuario,
    modulo: fila.modulo,
    evento: fila.evento,
    descripcion: fila.descripcion,
    criticidad: Criticidad.desdeId(fila.id_criticidad),
    ip: fila.ip,
  });
}
