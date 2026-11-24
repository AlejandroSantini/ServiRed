import { useEffect, useState, useTransition } from 'react';
import { api } from './cliente.js';

/**
 * Carga datos de la API cuando cambian las dependencias. Ignora respuestas
 * de pedidos viejos (si el usuario cambió de pantalla o de filtro a mitad de camino).
 */
export function useDatos(cargar, dependencias) {
  const [estado, setEstado] = useState({ datos: null, error: null, cargando: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    setEstado((anterior) => ({ ...anterior, cargando: true }));
    cargar()
      .then((datos) => vigente && setEstado({ datos, error: null, cargando: false }))
      .catch((error) => vigente && setEstado({ datos: null, error, cargando: false }));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencias, version]);

  return { ...estado, recargar: () => setVersion((v) => v + 1) };
}

/** Atajo para GET. */
export function useConsulta(ruta, consulta = null) {
  return useDatos(() => api(ruta, { consulta }), [ruta, JSON.stringify(consulta)]);
}

/**
 * Ejecuta una acción (aceptar, iniciar, denunciar...) sin bloquear la interfaz,
 * con su estado "en curso" y el error de la regla de negocio si la API la rechaza.
 */
export function useAccion() {
  const [pendiente, iniciarTransicion] = useTransition();
  const [error, setError] = useState(null);

  function ejecutar(accion) {
    iniciarTransicion(async () => {
      setError(null);
      try {
        await accion();
      } catch (e) {
        setError(e);
      }
    });
  }

  return { ejecutar, pendiente, error, limpiarError: () => setError(null) };
}

/** Catálogos de referencia, que casi no cambian. */
const cacheCatalogos = new Map();
export function useCatalogo(nombre) {
  return useDatos(() => {
    if (!cacheCatalogos.has(nombre)) {
      cacheCatalogos.set(nombre, api(`/catalogos/${nombre}`).catch((e) => {
        cacheCatalogos.delete(nombre);
        throw e;
      }));
    }
    return cacheCatalogos.get(nombre);
  }, [nombre]);
}
