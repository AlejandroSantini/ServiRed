import { ReglaNegocioError } from '../dominio/errores.js';
import { PATENTE } from '../dominio/seguridad/permisosDelSistema.js';

/**
 * RN-S07: el sistema siempre conserva al menos un usuario activo que puede
 * gestionar permisos. Se evalúa sobre el estado RESULTANTE de la operación,
 * antes de guardarla.
 *
 * @param usuarioModificado  usuario con el cambio ya aplicado en memoria (bloqueo, baja, permiso quitado)
 * @param arbolPermisos      árbol de permisos con el cambio aplicado (cuando se modifica una familia)
 */
export async function asegurarAdministradorDisponible({ usuarioRepositorio, usuarioModificado = null, arbolPermisos = null }) {
  const usuarios = await usuarioRepositorio.listar();
  const resultantes = usuarios.map((u) => (usuarioModificado && u.id === usuarioModificado.id ? usuarioModificado : u));
  const puedeGestionar = (u) => u.permisos.some((p) => (arbolPermisos?.get(p.codigo) ?? p).tienePermiso(PATENTE.PERMISO_GESTIONAR));
  if (!resultantes.some((u) => u.estaActivo() && puedeGestionar(u))) {
    throw new ReglaNegocioError('La operación dejaría al sistema sin ningún usuario activo que pueda gestionar permisos.', 'RN-S07');
  }
}
