import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import BarraNavegacion from '../components/BarraNavegacion.jsx';
import api from '../services/api';

const COLORES_ESTADO = { completo: '#2F9E6E', en_revision: '#F0A800', incompleto: '#C4453D' };
const ETIQUETAS_ESTADO = { completo: 'Completos', en_revision: 'En revisión', incompleto: 'Incompletos' };
const DashboardCharts = lazy(() => import('../components/DashboardCharts.jsx'));

function formatearMes(periodo) {
  if (!periodo) return '';
  const [anio, mes] = periodo.split('-');
  return new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(new Date(Number(anio), Number(mes) - 1));
}

export default function Dashboard() {
  const { usuario } = useAuth();
  const [asociacion, setAsociacion] = useState(null);
  const [indicadores, setIndicadores] = useState(null);
  const [error, setError] = useState(false);
  const [actualizado, setActualizado] = useState(null);

  useEffect(() => {
    let activo = true;
    const cargarDashboard = async () => {
      try {
        const [asociacionResp, dashboardResp] = await Promise.all([api.get('/asociacion'), api.get('/dashboard')]);
        if (!activo) return;
        setAsociacion(asociacionResp.data.asociacion);
        setIndicadores(dashboardResp.data.indicadores);
        setActualizado(new Date());
        setError(false);
      } catch {
        if (activo) setError(true);
      }
    };
    cargarDashboard();
    const intervalo = window.setInterval(cargarDashboard, 60000);
    return () => { activo = false; window.clearInterval(intervalo); };
  }, []);

  const tarjetas = [
    ['Voluntarios activos', indicadores?.total_voluntarios, `${indicadores?.nuevos_este_mes ?? 0} nuevos este mes`, 'var(--sg-primary)'],
    ['Expedientes completos', indicadores?.expedientes_completos, `${indicadores?.expedientes_incompletos ?? 0} incompletos`, 'var(--sg-success)'],
    ['Actividades del mes', indicadores?.actividades_del_mes, 'Programadas este mes', 'var(--sg-secondary)'],
    ['Horas de servicio', indicadores?.horas_realizadas_total, 'Acumuladas en total', 'var(--sg-accent)'],
    ['Documentos faltantes', indicadores?.documentos_faltantes, 'Pendientes de cargar', 'var(--sg-danger)'],
    ['En revisión', indicadores?.expedientes_en_revision, 'Listos para validar', 'var(--sg-warning)'],
  ];
  const voluntarios = (indicadores?.voluntarios_por_mes || []).map((fila) => ({ ...fila, total: Number(fila.total), mes: formatearMes(fila.periodo) }));
  const horas = (indicadores?.horas_por_mes || []).map((fila) => ({ ...fila, total: Number(fila.total), mes: formatearMes(fila.periodo) }));
  const estados = (indicadores?.expedientes_por_estado || []).map((fila) => ({ ...fila, total: Number(fila.total), etiqueta: ETIQUETAS_ESTADO[fila.estado] || fila.estado }));

  return (
    <div>
      <BarraNavegacion />
      <main style={styles.contenedor}>
        <div style={styles.encabezadoPagina}>
          <div><p style={styles.eyebrow}>CENTRO DE OPERACIONES</p><h1 style={styles.titulo}>Bienvenido, {usuario?.nombre?.split(' ')[0]}</h1><p style={styles.subtitulo}>{asociacion?.nombre || 'Sueños de Comedia A.C.'}</p></div>
          <div style={styles.metaFecha}>
            <div style={styles.fecha}>{new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' }).format(new Date())}</div>
            <span>{actualizado ? `Actualizado a las ${actualizado.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}` : 'Cargando indicadores...'}</span>
          </div>
        </div>
        {error && <div style={styles.error}>No se pudieron cargar los indicadores. Actualiza la página para intentarlo de nuevo.</div>}
        <section style={styles.grid} aria-label="Indicadores principales">
          {tarjetas.map(([etiqueta, valor, nota, color]) => <div key={etiqueta} style={styles.tarjeta}><div style={{ ...styles.valorTarjeta, color }}>{valor ?? '—'}</div><div style={styles.etiquetaTarjeta}>{etiqueta}</div><div style={styles.notaTarjeta}>{nota}</div></div>)}
        </section>
        <Suspense fallback={<div style={styles.cargandoGraficas}>Preparando visualizaciones...</div>}>
          <DashboardCharts voluntarios={voluntarios} horas={horas} estados={estados} />
        </Suspense>
        <section style={styles.acciones}><div><p style={styles.eyebrow}>SIGUIENTE PASO</p><h2 style={styles.accionTitulo}>Mantén la operación en movimiento</h2></div><div style={styles.enlacesAccion}><Link to="/voluntarios" style={styles.accionPrimaria}>+ Registrar voluntario</Link><Link to="/actividades" style={styles.accionSecundaria}>Ver actividades</Link><Link to="/reportes" style={styles.accionSecundaria}>Abrir reportes</Link></div></section>
      </main>
    </div>
  );
}

const styles = {
  contenedor: { maxWidth: 1120, margin: '0 auto', padding: '34px 24px 60px' },
  encabezadoPagina: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, gap: 20 },
  eyebrow: { margin: '0 0 7px', color: 'var(--sg-secondary)', fontSize: 11, fontWeight: 700, letterSpacing: 1.5 },
  titulo: { fontSize: 32 }, subtitulo: { color: 'var(--sg-ink-soft)', fontSize: 14, margin: '6px 0 0' },
  metaFecha: { color: 'var(--sg-ink-soft)', fontSize: 12, textAlign: 'right', lineHeight: 1.7 },
  fecha: { color: 'var(--sg-ink)', fontSize: 13, whiteSpace: 'nowrap', fontWeight: 600 },
  error: { background: '#FFF1EF', color: 'var(--sg-danger)', border: '1px solid #F1C7C2', padding: '12px 16px', borderRadius: 8, marginBottom: 18 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: 12, marginBottom: 18 },
  tarjeta: { background: 'var(--sg-surface)', border: '1px solid var(--sg-border)', borderRadius: 10, padding: '17px 16px', boxShadow: '0 4px 18px rgba(22,52,71,.06)' },
  valorTarjeta: { fontFamily: 'var(--sg-font-display)', fontSize: 28, fontWeight: 600 }, etiquetaTarjeta: { fontSize: 13, fontWeight: 700, marginTop: 5 }, notaTarjeta: { color: 'var(--sg-ink-soft)', fontSize: 11.5, marginTop: 5 },
  cargandoGraficas: { minHeight: 270, display: 'grid', placeItems: 'center', color: 'var(--sg-ink-soft)', background: 'var(--sg-surface)', border: '1px solid var(--sg-border)', borderRadius: 10 },
  acciones: { marginTop: 18, padding: '20px 22px', background: '#E8F5F8', border: '1px solid #C7E4EA', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18, flexWrap: 'wrap' }, accionTitulo: { fontSize: 21 }, enlacesAccion: { display: 'flex', gap: 9, flexWrap: 'wrap' }, accionPrimaria: { background: 'var(--sg-secondary)', color: 'white', padding: '10px 14px', borderRadius: 7, textDecoration: 'none', fontSize: 13, fontWeight: 700 }, accionSecundaria: { background: 'white', color: 'var(--sg-secondary)', border: '1px solid #B5D6DE', padding: '10px 14px', borderRadius: 7, textDecoration: 'none', fontSize: 13, fontWeight: 700 },
};
