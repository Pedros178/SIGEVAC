import React, { useEffect, useRef, useState } from 'react';
import api from '../services/api';

export default function NotificacionesMenu() {
  const [abierto, setAbierto] = useState(false);
  const [notificaciones, setNotificaciones] = useState([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const contenedorRef = useRef(null);

  async function cargar() {
    try {
      const { data } = await api.get('/notificaciones');
      setNotificaciones(data.notificaciones);
      setNoLeidas(data.no_leidas);
    } catch {
      // silencioso: la campanita no debe romper el resto de la UI
    }
  }

  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, 60000); // refresco cada minuto
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    function manejarClicFuera(e) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener('mousedown', manejarClicFuera);
    return () => document.removeEventListener('mousedown', manejarClicFuera);
  }, []);

  async function marcarLeida(id) {
    try {
      await api.patch(`/notificaciones/${id}/leida`);
      setNotificaciones((prev) => prev.map((n) => (n.id === id ? { ...n, leida: true } : n)));
      setNoLeidas((prev) => Math.max(0, prev - 1));
    } catch {
      // no crítico
    }
  }

  return (
    <div style={{ position: 'relative' }} ref={contenedorRef}>
      <button onClick={() => setAbierto((v) => !v)} style={styles.botonCampana} aria-label="Notificaciones">
        🔔
        {noLeidas > 0 && <span style={styles.contador}>{noLeidas > 9 ? '9+' : noLeidas}</span>}
      </button>

      {abierto && (
        <div style={styles.panel}>
          <div style={styles.panelEncabezado}>Notificaciones</div>
          {notificaciones.length === 0 ? (
            <div style={styles.vacio}>No tienes notificaciones.</div>
          ) : (
            notificaciones.map((n) => (
              <button
                key={n.id}
                onClick={() => !n.leida && marcarLeida(n.id)}
                style={{ ...styles.item, ...(n.leida ? {} : styles.itemNoLeida) }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>{n.titulo}</div>
                {n.mensaje && <div style={{ fontSize: 12, color: 'var(--sg-ink-soft)', marginTop: 2 }}>{n.mensaje}</div>}
                <div style={{ fontSize: 11, color: 'var(--sg-ink-soft)', marginTop: 4 }}>
                  {new Date(n.creado_en).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  botonCampana: {
    position: 'relative', background: 'transparent', border: 'none', fontSize: 18,
    cursor: 'pointer', padding: 6, borderRadius: 8,
  },
  contador: {
    position: 'absolute', top: -2, right: -2, background: 'var(--sg-danger)', color: 'white',
    fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '1px 5px', lineHeight: 1.4,
  },
  panel: {
    position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 320,
    background: 'var(--sg-surface)', border: '1px solid var(--sg-border)', borderRadius: 12,
    boxShadow: 'var(--sg-shadow)', overflow: 'hidden', zIndex: 20, maxHeight: 420, overflowY: 'auto',
  },
  panelEncabezado: {
    padding: '12px 16px', fontWeight: 700, fontSize: 13, borderBottom: '1px solid var(--sg-border)',
  },
  vacio: { padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--sg-ink-soft)' },
  item: {
    display: 'block', width: '100%', textAlign: 'left', padding: '12px 16px',
    borderBottom: '1px solid var(--sg-border)', background: 'transparent', border: 'none', cursor: 'pointer',
  },
  itemNoLeida: { background: 'rgba(91, 42, 134, 0.05)' },
};
