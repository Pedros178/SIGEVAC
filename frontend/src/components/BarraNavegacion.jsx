import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NotificacionesMenu from './NotificacionesMenu.jsx';

// Cada enlace declara el/los permisos que lo habilitan. `null` = visible
// para cualquier usuario autenticado (no requiere permiso específico).
const ENLACES = [
  { to: '/', etiqueta: 'Dashboard', permisos: null },
  { to: '/voluntarios', etiqueta: 'Voluntarios', permisos: ['voluntarios.consultar'] },
  { to: '/actividades', etiqueta: 'Actividades', permisos: ['actividades.consultar'] },
  { to: '/reportes', etiqueta: 'Reportes', permisos: ['reportes.consultar'] },
  {
    to: '/administracion',
    etiqueta: 'Administración',
    permisos: ['usuarios.consultar', 'auditoria.consultar', 'configuracion.consultar', 'respaldos.gestionar'],
  },
];

export default function BarraNavegacion() {
  const { usuario, logout, tieneAlgunPermiso, cambiarAsociacion } = useAuth();
  const location = useLocation();

  const enlacesVisibles = ENLACES.filter((e) => !e.permisos || tieneAlgunPermiso(e.permisos));

  return (
    <header className="sg-navigation" style={styles.encabezado}>
      <div className="sg-navigation-left" style={styles.izquierda}>
        <span style={styles.marca}>
          <img src="/logo-sigevac.png" alt="" style={{ width: 30, height: 30, objectFit: 'contain' }} />
          SIGEVAC
        </span>
        <nav className="sg-navigation-links" style={styles.nav}>
          {enlacesVisibles.map((enlace) => (
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
      <div className="sg-navigation-right" style={styles.derecha}>
        {usuario?.asociaciones?.length > 1 && (
          <SelectorAsociacion
            asociaciones={usuario.asociaciones}
            activaId={usuario.asociacion_id}
            onCambiar={cambiarAsociacion}
          />
        )}
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

/**
 * Multi-asociación (diferenciador): solo se muestra cuando el usuario
 * pertenece a más de una asociación civil. Al elegir otra, pide un
 * access token nuevo con esa asociación activa (ver AuthContext.cambiarAsociacion)
 * y recarga la vista para que todas las pantallas usen el contexto nuevo.
 */
function SelectorAsociacion({ asociaciones, activaId, onCambiar }) {
  const [cambiando, setCambiando] = useState(false);

  async function manejarCambio(e) {
    const nuevaId = e.target.value;
    if (nuevaId === activaId) return;
    setCambiando(true);
    try {
      await onCambiar(nuevaId);
      window.location.reload(); // fuerza a que todas las pantallas recarguen datos con la asociación nueva
    } catch {
      setCambiando(false);
      alert('No se pudo cambiar de asociación. Intenta de nuevo.');
    }
  }

  return (
    <select
      value={activaId || ''}
      onChange={manejarCambio}
      disabled={cambiando}
      style={styles.selectorAsociacion}
      title="Cambiar de asociación"
    >
      {asociaciones.map((a) => (
        <option key={a.id} value={a.id}>{a.nombre}</option>
      ))}
    </select>
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
    display: 'flex',
    alignItems: 'center',
    gap: 8,
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
    background: 'rgba(54, 169, 214, 0.12)',
    color: 'var(--sg-primary)',
  },
  derecha: { display: 'flex', alignItems: 'center', gap: 16 },
  selectorAsociacion: {
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid var(--sg-border)',
    background: 'var(--sg-surface)',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--sg-primary)',
    maxWidth: 180,
  },
};
