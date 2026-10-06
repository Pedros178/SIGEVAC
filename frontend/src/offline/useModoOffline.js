import { useState, useEffect, useCallback, useRef } from 'react';
import { contarAccionesPendientes } from './db';
import { sincronizarPendientes } from './sincronizador';

/**
 * Expone el estado de conexión y de la cola offline, y sincroniza
 * automáticamente:
 *  - al recuperar conexión (evento 'online')
 *  - al montar el componente, por si ya hay pendientes de una sesión previa
 *  - cada 30s mientras haya conexión y acciones pendientes, como respaldo
 *    por si el navegador no dispara 'online' de forma confiable
 */
export function useModoOffline(onSincronizado) {
  const [enLinea, setEnLinea] = useState(navigator.onLine);
  const [pendientes, setPendientes] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);
  const sincronizandoRef = useRef(false);
  const onSincronizadoRef = useRef(onSincronizado);
  onSincronizadoRef.current = onSincronizado;

  const actualizarConteo = useCallback(async () => {
    setPendientes(await contarAccionesPendientes());
  }, []);

  const sincronizarAhora = useCallback(async () => {
    if (sincronizandoRef.current || !navigator.onLine) return;
    sincronizandoRef.current = true;
    setSincronizando(true);
    try {
      const resultado = await sincronizarPendientes();
      if (resultado.sincronizadas > 0 && onSincronizadoRef.current) {
        await onSincronizadoRef.current();
      }
    } finally {
      sincronizandoRef.current = false;
      setSincronizando(false);
      await actualizarConteo();
    }
  }, [actualizarConteo]);

  useEffect(() => {
    actualizarConteo();

    function manejarOnline() {
      setEnLinea(true);
      sincronizarAhora();
    }
    function manejarOffline() {
      setEnLinea(false);
    }

    window.addEventListener('online', manejarOnline);
    window.addEventListener('offline', manejarOffline);
    window.addEventListener('sigevac:cola-cambio', actualizarConteo);

    if (navigator.onLine) sincronizarAhora();

    const intervalo = setInterval(() => {
      if (navigator.onLine) sincronizarAhora();
    }, 30000);

    return () => {
      window.removeEventListener('online', manejarOnline);
      window.removeEventListener('offline', manejarOffline);
      window.removeEventListener('sigevac:cola-cambio', actualizarConteo);
      clearInterval(intervalo);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { enLinea, pendientes, sincronizando, sincronizarAhora, actualizarConteo };
}
