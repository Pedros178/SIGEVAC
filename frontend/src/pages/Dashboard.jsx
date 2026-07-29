import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import BarraNavegacion from '../components/BarraNavegacion.jsx';
import api from '../services/api';

export default function Dashboard() {
  const { usuario } = useAuth();
  const [asociacion, setAsociacion] = useState(null);
  const [totalVoluntarios, setTotalVoluntarios] = useState(null);

  useEffect(() => {
    api.get('/asociacion').then(({ data }) => setAsociacion(data.asociacion)).catch(() => {});
    api.get('/voluntarios', { params: { limit: 1 } })
      .then(({ data }) => setTotalVoluntarios(data.voluntarios.length))
      .catch(() => {});
  }, []);

  const indicadores = [
    { etiqueta: 'Voluntarios registrados', valor: totalVoluntarios ?? '—', nota: 'Módulo 4 · Fase 2 activa' },
    { etiqueta: 'Expedientes completos', valor: '—', nota: 'Ver detalle por voluntario' },
    { etiqueta: 'Actividades del mes', valor: '—', nota: 'Módulo 10 · Fase 3' },
    { etiqueta: 'Horas de servicio', valor: '—', nota: 'Módulo 12 · Fase 3' },
  ];

  return (
    <div>
      <BarraNavegacion />
      <div style={styles.contenedor}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={styles.titulo}>Bienvenido, {usuario?.nombre?.split(' ')[0]}</h1>
          <p style={styles.subtitulo}>{asociacion?.nombre || 'Sueños de Comedia A.C.'}</p>
        </div>

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
          <span className="sg-badge sg-badge-success">Fase 2 activa</span>
          <p>
            Voluntarios, expedientes digitales y el gestor de archivos ya están funcionando.
            Ve a la sección <strong>Voluntarios</strong> para registrar personas y dar seguimiento
            a su expediente con semáforo de avance.
          </p>
        </section>
      </div>
    </div>
  );
}

const styles = {
  contenedor: {
    maxWidth: 1080,
    margin: '0 auto',
    padding: '32px 24px 60px',
  },
  titulo: { fontSize: 28 },
  subtitulo: {
    fontFamily: 'var(--sg-font-body)',
    color: 'var(--sg-ink-soft)',
    fontSize: 14,
    marginTop: 2,
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

