import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NotificacionesMenu from './NotificacionesMenu.jsx';

const enlaces = [
  { to: '/', etiqueta: 'Dashboard' },
  { to: '/voluntarios', etiqueta: 'Voluntarios' },
  { to: '/actividades', etiqueta: 'Actividades' },
  { to: '/reportes', etiqueta: 'Reportes' },
  { to: '/administracion', etiqueta: 'Administración' },
];

export default function BarraNavegacion() {
  const { usuario, logout } = useAuth();
  const location = useLocation();

  return (
    <header style={styles.encabezado}>
      <div style={styles.izquierda}>
        <span style={styles.marca}>SIGEVAC</span>
        <nav style={styles.nav}>
          {enlaces.map((enlace) => (
            <Link
              key={enlace.to}
              to={enlace.to}
              style={{
                ...styles.enlace,
                ...(location.pathname === enlace.to ? styles.enlaceActivo : {}),
              }}
            >
              {enlace.etiqueta}
            </Link>
          ))}
        </nav>
      </div>
      <div style={styles.derecha}>
        <NotificacionesMenu />
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{usuario?.nombre}</div>
          <div style={{ fontSize: 12, color: 'var(--sg-ink-soft)' }}>
            {usuario?.roles?.map((r) => r.nombre).join(', ') || 'Sin rol'}
          </div>
        </div>
        <button onClick={logout} className="sg-button-primary" style={{ width: 'auto', padding: '8px 16px' }}>
          Salir
        </button>
      </div>
    </header>
  );
}

const styles = {
  encabezado: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid var(--sg-border)',
    background: 'var(--sg-surface)',
  },
  izquierda: { display: 'flex', alignItems: 'center', gap: 32 },
  marca: {
    fontFamily: 'var(--sg-font-display)',
    fontSize: 20,
    fontWeight: 600,
    color: 'var(--sg-primary)',
  },
  nav: { display: 'flex', gap: 4 },
  enlace: {
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--sg-ink-soft)',
    textDecoration: 'none',
  },
  enlaceActivo: {
    background: 'rgba(91, 42, 134, 0.08)',
    color: 'var(--sg-primary)',
  },
  derecha: { display: 'flex', alignItems: 'center', gap: 16 },
};
