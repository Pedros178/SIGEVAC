import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BarraNavegacion from '../components/BarraNavegacion.jsx';
import FormularioActividad from '../components/FormularioActividad.jsx';
import api from '../services/api';

export default function Actividades() {
  const [actividades, setActividades] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  async function cargar() {
    setCargando(true);
    try {
      const { data } = await api.get('/actividades');
      setActividades(data.actividades);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  function manejarCreada() {
    setMostrarFormulario(false);
    cargar();
  }

  return (
    <div>
      <BarraNavegacion />
      <div style={styles.contenedor}>
        <div style={styles.encabezado}>
          <div>
            <h1 style={{ fontSize: 26 }}>Actividades</h1>
            <p style={{ color: 'var(--sg-ink-soft)', fontSize: 14 }}>
              Actividades, participación y evidencias (Módulos 10–11)
            </p>
          </div>
          {!mostrarFormulario && (
            <button className="sg-button-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={() => setMostrarFormulario(true)}>
              + Nueva actividad
            </button>
          )}
        </div>

        {mostrarFormulario && (
          <FormularioActividad onCreada={manejarCreada} onCancelar={() => setMostrarFormulario(false)} />
        )}

        {cargando ? (
          <p style={{ color: 'var(--sg-ink-soft)' }}>Cargando actividades…</p>
        ) : actividades.length === 0 ? (
          <p style={{ color: 'var(--sg-ink-soft)' }}>Aún no hay actividades registradas.</p>
        ) : (
          <div style={styles.tabla}>
            <div style={{ ...styles.filaTabla, ...styles.filaEncabezado }}>
              <span>Fecha</span>
              <span>Actividad</span>
              <span>Lugar</span>
              <span>Inscritos</span>
            </div>
            {actividades.map((a) => (
              <Link key={a.id} to={`/actividades/${a.id}`} style={{ ...styles.filaTabla, textDecoration: 'none', color: 'inherit' }}>
                <span>{new Date(a.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                <span style={{ fontWeight: 600 }}>{a.nombre}</span>
                <span>{a.lugar || '—'}</span>
                <span>{a.total_inscritos}{a.cupo ? ` / ${a.cupo}` : ''}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  contenedor: { maxWidth: 1080, margin: '0 auto', padding: '32px 24px 60px' },
  encabezado: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  tabla: {
    background: 'var(--sg-surface)', border: '1px solid var(--sg-border)', borderRadius: 'var(--sg-radius)', overflow: 'hidden',
  },
  filaTabla: {
    display: 'grid', gridTemplateColumns: '160px 2fr 1.2fr 120px', gap: 12,
    padding: '14px 18px', borderBottom: '1px solid var(--sg-border)', alignItems: 'center', fontSize: 14,
  },
  filaEncabezado: {
    fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em',
    color: 'var(--sg-ink-soft)', background: 'var(--sg-bg)',
  },
};
