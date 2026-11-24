/**
 * Tablas protegidas con dígitos verificadores (RN-S09) y columnas que entran en el DVH.
 * Son las tablas cuya alteración manual permitiría tomar una cuenta o escalar
 * privilegios (usuario, permisos) o borrar rastros (bitácora).
 * Las columnas cifradas o que cambian sin riesgo no entran en el DVH.
 */
export const TABLAS_CONTROLADAS = Object.freeze({
  usuario: {
    clave: ['id_usuario'],
    columnas: ['id_usuario', 'rol', 'email', 'hash_contrasena', 'id_estado', 'intentos_fallidos'],
  },
  permiso: {
    clave: ['id_permiso'],
    columnas: ['id_permiso', 'codigo', 'es_familia'],
  },
  permiso_hijo: {
    clave: ['id_padre', 'id_hijo'],
    columnas: ['id_padre', 'id_hijo'],
  },
  usuario_permiso: {
    clave: ['id_usuario', 'id_permiso'],
    columnas: ['id_usuario', 'id_permiso'],
  },
  bitacora: {
    clave: ['id_bitacora'],
    columnas: ['id_bitacora', 'fecha', 'id_usuario', 'email_usuario', 'modulo', 'evento', 'descripcion', 'id_criticidad', 'ip'],
  },
});

export function definicionTabla(tabla) {
  const definicion = TABLAS_CONTROLADAS[tabla];
  if (!definicion) throw new Error(`La tabla ${tabla} no tiene dígitos verificadores.`);
  return definicion;
}

export function claveDeFila(tabla, fila) {
  return Object.fromEntries(definicionTabla(tabla).clave.map((c) => [c, fila[c]]));
}

export function compararPorClave(tabla) {
  const { clave } = definicionTabla(tabla);
  return (a, b) => {
    for (const columna of clave) {
      const diferencia = Number(a[columna]) - Number(b[columna]);
      if (diferencia !== 0) return diferencia;
    }
    return 0;
  };
}
