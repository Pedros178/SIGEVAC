import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api';

export default function Dashboard() {
  const { usuario, logout } = useAuth();
  const [asociacion, setAsociacion] = useState(null);

  useEffect(() => {
    api.get('/asociacion').then(({ data }) => setAsociacion(data.asociacion)).catch(() => {});
  }, []);

  const indicadores = [
    { etiqueta: 'Voluntarios totales', valor: '—', nota: 'Módulo 4 · Fase 2' },
    { etiqueta: 'Expedientes completos', valor: '—', nota: 'Módulo 9 · Fase 2' },
    { etiqueta: 'Actividades del mes', valor: '—', nota: 'Módulo 10 · Fase 3' },
    { etiqueta: 'Horas de servicio', valor: '—', nota: 'Módulo 12 · Fase 3' },
  ];

  return (
    <div style={styles.contenedor}>
      <header style={styles.encabezado}>
        <div>
          <h1 style={styles.titulo}>SIGEVAC</h1>
          <p style={styles.subtitulo}>{asociacion?.nombre || 'Sueños de Comedia A.C.'}</p>
        </div>
        <div style={styles.usuarioBox}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{usuario?.nombre}</div>
            <div style={{ fontSize: 12.5, color: 'var(--sg-ink-soft)' }}>
              {usuario?.roles?.map((r) => r.nombre).join(', ') || 'Sin rol asignado'}
            </div>
          </div>
          <button onClick={logout} className="sg-button-primary" style={{ width: 'auto', padding: '8px 16px' }}>
            Salir
          </button>
        </div>
      </header>

      <section style={styles.grid}>
        {indicadores.map((ind) => (
          <div key={ind.etiqueta} style={styles.tarjeta}>
            <div style={styles.valorTarjeta}>{ind.valor}</div>
            <div style={styles.etiquetaTarjeta}>{ind.etiqueta}</div>
            <div style={styles.notaTarjeta}>{ind.nota}</div>
          </div>
        ))}
      </section>

      <section style={styles.avisoFase}>
        <span className="sg-badge sg-badge-success">Fase 1 activa</span>
        <p>
          Autenticación, usuarios/roles y datos de la asociación están funcionando. Los módulos de
          voluntarios, expedientes y actividades se activarán en las siguientes fases del roadmap.
        </p>
      </section>
    </div>
  );
}

const styles = {
  contenedor: {
    maxWidth: 1080,
    margin: '0 auto',
    padding: '32px 24px 60px',
  },
  encabezado: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  titulo: { fontSize: 28 },
  subtitulo: {
    fontFamily: 'var(--sg-font-body)',
    color: 'var(--sg-ink-soft)',
    fontSize: 14,
    marginTop: 2,
  },
  usuarioBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
    marginBottom: 28,
  },
  tarjeta: {
    background: 'var(--sg-surface)',
    border: '1px solid var(--sg-border)',
    borderRadius: 'var(--sg-radius)',
    boxShadow: 'var(--sg-shadow)',
    padding: '20px 18px',
  },
  valorTarjeta: {
    fontFamily: 'var(--sg-font-display)',
    fontSize: 30,
    fontWeight: 600,
    color: 'var(--sg-primary)',
  },
  etiquetaTarjeta: {
    fontSize: 13.5,
    fontWeight: 600,
    marginTop: 4,
  },
  notaTarjeta: {
    fontSize: 12,
    color: 'var(--sg-ink-soft)',
    marginTop: 6,
  },
  avisoFase: {
    background: 'var(--sg-surface)',
    border: '1px solid var(--sg-border)',
    borderRadius: 'var(--sg-radius)',
    padding: '18px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    alignItems: 'flex-start',
    fontSize: 14,
    color: 'var(--sg-ink-soft)',
    lineHeight: 1.6,
  },
};
