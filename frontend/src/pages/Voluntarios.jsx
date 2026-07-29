import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BarraNavegacion from '../components/BarraNavegacion.jsx';
import BadgeSemaforo from '../components/BadgeSemaforo.jsx';
import FormularioVoluntario from '../components/FormularioVoluntario.jsx';
import api from '../services/api';

export default function Voluntarios() {
  const [voluntarios, setVoluntarios] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  async function cargarVoluntarios(filtro = '') {
    setCargando(true);
    try {
      const { data } = await api.get('/voluntarios', { params: { busqueda: filtro || undefined } });
      setVoluntarios(data.voluntarios);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargarVoluntarios(); }, []);

  function manejarBusqueda(e) {
    e.preventDefault();
    cargarVoluntarios(busqueda);
  }

  function manejarCreado() {
    setMostrarFormulario(false);
    cargarVoluntarios(busqueda);
  }

  return (
    <div>
      <BarraNavegacion />
      <div style={styles.contenedor}>
        <div style={styles.encabezado}>
          <div>
            <h1 style={{ fontSize: 26 }}>Voluntarios</h1>
            <p style={{ color: 'var(--sg-ink-soft)', fontSize: 14 }}>
              Registro, clasificación y expedientes digitales (Módulos 4–9)
            </p>
          </div>
          {!mostrarFormulario && (
            <button className="sg-button-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={() => setMostrarFormulario(true)}>
              + Registrar voluntario
            </button>
          )}
        </div>

        {mostrarFormulario && (
          <FormularioVoluntario onCreado={manejarCreado} onCancelar={() => setMostrarFormulario(false)} />
        )}

        <form onSubmit={manejarBusqueda} style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <input
            className="sg-input"
            placeholder="Buscar por nombre o CURP…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ maxWidth: 320 }}
          />
          <button type="submit" className="sg-button-primary" style={{ width: 'auto', padding: '10px 18px' }}>
            Buscar
          </button>
        </form>

        {cargando ? (
          <p style={{ color: 'var(--sg-ink-soft)' }}>Cargando voluntarios…</p>
        ) : voluntarios.length === 0 ? (
          <p style={{ color: 'var(--sg-ink-soft)' }}>Aún no hay voluntarios registrados.</p>
        ) : (
          <div style={styles.tabla}>
            <div style={{ ...styles.filaTabla, ...styles.filaEncabezado }}>
              <span>Folio</span>
              <span>Nombre</span>
              <span>Tipo</span>
              <span>Expediente</span>
            </div>
            {voluntarios.map((v) => (
              <Link key={v.id} to={`/voluntarios/${v.id}`} style={{ ...styles.filaTabla, textDecoration: 'none', color: 'inherit' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{v.numero_voluntario || '—'}</span>
                <span style={{ fontWeight: 600 }}>
                  {v.nombre} {v.apellido_paterno} {v.apellido_materno}
                </span>
                <span>
                  <span className={`sg-badge ${v.es_menor_edad ? 'sg-badge-warning' : 'sg-badge-success'}`}>
                    {v.es_menor_edad ? 'Menor de edad' : 'Mayor de edad'}
                  </span>
                </span>
                <span>
                  {v.expediente_estado
                    ? <BadgeSemaforo estado={v.expediente_estado} porcentaje={v.porcentaje_avance} />
                    : <span style={{ color: 'var(--sg-ink-soft)', fontSize: 13 }}>Sin expediente</span>}
                </span>
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
    background: 'var(--sg-surface)',
    border: '1px solid var(--sg-border)',
    borderRadius: 'var(--sg-radius)',
    overflow: 'hidden',
  },
  filaTabla: {
    display: 'grid',
    gridTemplateColumns: '120px 2fr 1fr 1.3fr',
    gap: 12,
    padding: '14px 18px',
    borderBottom: '1px solid var(--sg-border)',
    alignItems: 'center',
    fontSize: 14,
  },
  filaEncabezado: {
    fontSize: 12.5,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    color: 'var(--sg-ink-soft)',
    background: 'var(--sg-bg)',
  },
};
