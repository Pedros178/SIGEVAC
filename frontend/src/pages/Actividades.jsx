import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BarraNavegacion from '../components/BarraNavegacion.jsx';
import FormularioActividad from '../components/FormularioActividad.jsx';
import MapaActividades from '../components/MapaActividades.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api';

export default function Actividades() {
  const { tienePermiso } = useAuth();
  const [actividades, setActividades] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [vista, setVista] = useState('calendario'); // 'calendario' | 'lista' | 'mapa'

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
          {!mostrarFormulario && tienePermiso('actividades.crear') && (
            <button className="sg-button-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={() => setMostrarFormulario(true)}>
              + Nueva actividad
            </button>
          )}
        </div>

        <div style={styles.controles}>
          <button type="button" style={vista === 'calendario' ? styles.controlActivo : styles.control} onClick={() => setVista('calendario')}>Calendario</button>
          <button type="button" style={vista === 'lista' ? styles.controlActivo : styles.control} onClick={() => setVista('lista')}>Lista</button>
          <button type="button" style={vista === 'mapa' ? styles.controlActivo : styles.control} onClick={() => setVista('mapa')}>Mapa</button>
        </div>

        {mostrarFormulario && tienePermiso('actividades.crear') && (
          <FormularioActividad onCreada={manejarCreada} onCancelar={() => setMostrarFormulario(false)} />
        )}

        {cargando ? (
          <p style={{ color: 'var(--sg-ink-soft)' }}>Cargando actividades…</p>
        ) : actividades.length === 0 ? (
          <p style={{ color: 'var(--sg-ink-soft)' }}>Aún no hay actividades registradas.</p>
        ) : vista === 'calendario' ? <Calendario actividades={actividades} />
          : vista === 'mapa' ? <MapaActividades actividades={actividades} />
          : (
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

function Calendario({ actividades }) {
  const hoy = new Date();
  const primeraActividad = actividades
    .map((actividad) => obtenerFechaActividad(actividad.fecha))
    .find(Boolean);
  const [mes, setMes] = useState(() => primeraActividad
    ? new Date(primeraActividad.getFullYear(), primeraActividad.getMonth(), 1)
    : new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const primerDia = new Date(mes.getFullYear(), mes.getMonth(), 1).getDay();
  const diasMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const celdas = Array.from({ length: primerDia + diasMes }, (_, i) => i < primerDia ? null : i - primerDia + 1);
  const actividadesDia = (dia) => actividades.filter((actividad) => {
    const fecha = obtenerFechaActividad(actividad.fecha);
    return fecha
      && fecha.getFullYear() === mes.getFullYear()
      && fecha.getMonth() === mes.getMonth()
      && fecha.getDate() === dia;
  });
  return <div style={styles.calendario}>
    <div style={styles.navegacionMes}><button type="button" style={styles.control} onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}>←</button><strong>{mes.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}</strong><button type="button" style={styles.control} onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}>→</button></div>
    <div style={styles.diasSemana}>{['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((dia) => <span key={dia}>{dia}</span>)}</div>
    <div className="sg-calendar-grid" style={styles.grilla}>{celdas.map((dia, indice) => <div key={`${dia}-${indice}`} style={styles.celda}>{dia && <><strong>{dia}</strong>{actividadesDia(dia).map((actividad) => <Link key={actividad.id} to={`/actividades/${actividad.id}`} style={styles.evento}>{actividad.hora_inicio ? `${String(actividad.hora_inicio).slice(0, 5)} ` : ''}{actividad.nombre}</Link>)}</>}</div>)}</div>
  </div>;
}

function obtenerFechaActividad(valor) {
  if (!valor) return null;
  const coincidencia = String(valor).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!coincidencia) return null;
  const fecha = new Date(Number(coincidencia[1]), Number(coincidencia[2]) - 1, Number(coincidencia[3]));
  return Number.isNaN(fecha.getTime()) ? null : fecha;
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
  controles: { display: 'flex', gap: 4, marginBottom: 16 },
  control: { border: '1px solid var(--sg-border)', background: 'var(--sg-surface)', color: 'var(--sg-ink-soft)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer' },
  controlActivo: { border: '1px solid var(--sg-primary)', background: 'rgba(54, 169, 214, 0.10)', color: 'var(--sg-primary)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontWeight: 600 },
  calendario: { background: 'var(--sg-surface)', border: '1px solid var(--sg-border)', borderRadius: 'var(--sg-radius)', padding: 16 },
  navegacionMes: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, textTransform: 'capitalize' },
  diasSemana: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, color: 'var(--sg-ink-soft)', fontSize: 12, fontWeight: 700, textAlign: 'center', marginBottom: 4 },
  grilla: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 1, background: 'var(--sg-border)' },
  celda: { minHeight: 100, background: 'var(--sg-surface)', padding: 7, fontSize: 12 },
  evento: { display: 'block', marginTop: 6, padding: '4px 5px', borderRadius: 5, background: 'rgba(54, 169, 214, 0.12)', color: 'var(--sg-primary-dark)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
};
