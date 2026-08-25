import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import BarraNavegacion from '../components/BarraNavegacion.jsx';
import api from '../services/api';

export default function ActividadDetalle() {
  const { id } = useParams();
  const [actividad, setActividad] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [busquedaVoluntario, setBusquedaVoluntario] = useState('');
  const [resultadosVoluntario, setResultadosVoluntario] = useState([]);
  const [subiendoEvidencia, setSubiendoEvidencia] = useState(false);
  const [codigoQr, setCodigoQr] = useState('');
  const [procesandoQr, setProcesandoQr] = useState(false);
  const [mensajeQr, setMensajeQr] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await api.get(`/actividades/${id}`);
      setActividad(data.actividad);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cargar la actividad.');
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  async function buscarVoluntarios(texto) {
    setBusquedaVoluntario(texto);
    if (texto.length < 2) { setResultadosVoluntario([]); return; }
    const { data } = await api.get('/voluntarios', { params: { busqueda: texto } });
    setResultadosVoluntario(data.voluntarios);
  }

  async function inscribir(voluntarioId) {
    setError('');
    try {
      await api.post(`/actividades/${id}/participaciones`, { voluntarioId });
      setBusquedaVoluntario('');
      setResultadosVoluntario([]);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo inscribir al voluntario.');
    }
  }

  async function registrarEntrada(participacionId) {
    try {
      await api.post(`/participaciones/${participacionId}/entrada`, {});
      await cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar la entrada.');
    }
  }

  async function registrarSalida(participacionId) {
    try {
      await api.post(`/participaciones/${participacionId}/salida`, {});
      await cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar la salida.');
    }
  }

  async function subirEvidencia(archivo) {
    setSubiendoEvidencia(true);
    try {
      const formData = new FormData();
      formData.append('evidencia', archivo);
      await api.post(`/actividades/${id}/evidencias`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo subir la evidencia.');
    } finally {
      setSubiendoEvidencia(false);
    }
  }

  async function registrarPorQr(evento) {
    evento.preventDefault();
    setProcesandoQr(true); setMensajeQr(''); setError('');
    try {
      const { data } = await api.post(`/qr/${encodeURIComponent(codigoQr.trim())}/asistencia`, { actividad_id: id });
      setMensajeQr(data.mensaje); setCodigoQr(''); await cargar();
    } catch (err) { setError(err.response?.data?.error || 'No se pudo registrar la asistencia por QR.'); }
    finally { setProcesandoQr(false); }
  }

  if (cargando) {
    return <div><BarraNavegacion /><div style={styles.contenedor}><p style={{ color: 'var(--sg-ink-soft)' }}>Cargando actividad…</p></div></div>;
  }
  if (!actividad) {
    return <div><BarraNavegacion /><div style={styles.contenedor}><p style={{ color: 'var(--sg-danger)' }}>{error || 'Actividad no encontrada.'}</p></div></div>;
  }

  return (
    <div>
      <BarraNavegacion />
      <div style={styles.contenedor}>
        <Link to="/actividades" style={{ fontSize: 13.5, color: 'var(--sg-ink-soft)' }}>← Volver a Actividades</Link>

        <div style={{ margin: '14px 0 24px' }}>
          <h1 style={{ fontSize: 26 }}>{actividad.nombre}</h1>
          <p style={{ color: 'var(--sg-ink-soft)', fontSize: 14 }}>
            {new Date(actividad.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
            {actividad.lugar && ` · ${actividad.lugar}`}
            {actividad.cupo && ` · Cupo: ${actividad.participantes.length}/${actividad.cupo}`}
          </p>
          {actividad.descripcion && <p style={{ fontSize: 14, marginTop: 8 }}>{actividad.descripcion}</p>}
        </div>

        {error && (
          <div style={{ background: 'rgba(196,69,61,0.1)', color: 'var(--sg-danger)', padding: '10px 12px', borderRadius: 8, fontSize: 13.5, marginBottom: 16 }}>{error}</div>
        )}

        <section style={styles.escaneoQr}>
          <h2 style={{ fontSize: 17, margin: '0 0 6px' }}>Asistencia por QR</h2>
          <p style={{ color: 'var(--sg-ink-soft)', fontSize: 13, margin: '0 0 10px' }}>Captura el código de la credencial. El primer registro marca entrada y el segundo marca salida.</p>
          <form onSubmit={registrarPorQr} style={{ display: 'flex', gap: 8, maxWidth: 480 }}>
            <input className="sg-input" value={codigoQr} onChange={(e) => setCodigoQr(e.target.value)} placeholder="Código QR de la credencial" required />
            <button type="submit" className="sg-button-primary" style={{ width: 'auto', whiteSpace: 'nowrap' }} disabled={procesandoQr}>{procesandoQr ? 'Registrando…' : 'Registrar QR'}</button>
          </form>
          {mensajeQr && <p style={{ color: 'var(--sg-success)', fontSize: 13, marginBottom: 0 }}>{mensajeQr}</p>}
        </section>

        <h2 style={{ fontSize: 17, marginBottom: 10 }}>Inscribir voluntario</h2>
        <div style={{ position: 'relative', marginBottom: 24, maxWidth: 400 }}>
          <input
            className="sg-input"
            placeholder="Buscar por nombre o CURP…"
            value={busquedaVoluntario}
            onChange={(e) => buscarVoluntarios(e.target.value)}
          />
          {resultadosVoluntario.length > 0 && (
            <div style={styles.resultados}>
              {resultadosVoluntario.map((v) => (
                <button key={v.id} style={styles.resultadoItem} onClick={() => inscribir(v.id)}>
                  {v.nombre} {v.apellido_paterno} {v.apellido_materno}
                </button>
              ))}
            </div>
          )}
        </div>

        <h2 style={{ fontSize: 17, marginBottom: 10 }}>Participantes</h2>
        <div style={styles.listaParticipantes}>
          {actividad.participantes.length === 0 && (
            <p style={{ padding: 16, color: 'var(--sg-ink-soft)', fontSize: 14 }}>Aún no hay voluntarios inscritos.</p>
          )}
          {actividad.participantes.map((p) => (
            <div key={p.participacion_id} style={styles.filaParticipante}>
              <span style={{ fontWeight: 600 }}>{p.nombre} {p.apellido_paterno} {p.apellido_materno}</span>
              <span style={{ fontSize: 13, color: 'var(--sg-ink-soft)' }}>
                {p.hora_entrada ? `Entrada: ${new Date(p.hora_entrada).toLocaleTimeString('es-MX')}` : 'Sin registrar'}
              </span>
              <span style={{ fontSize: 13, color: 'var(--sg-ink-soft)' }}>
                {p.horas_realizadas ? `${p.horas_realizadas} h realizadas` : (p.hora_entrada ? 'En curso' : '—')}
              </span>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                {!p.hora_entrada && (
                  <button style={styles.botonAccion} onClick={() => registrarEntrada(p.participacion_id)}>Registrar entrada</button>
                )}
                {p.hora_entrada && !p.hora_salida && (
                  <button style={{ ...styles.botonAccion, background: 'var(--sg-success)', color: 'white', border: 'none' }} onClick={() => registrarSalida(p.participacion_id)}>
                    Registrar salida
                  </button>
                )}
                {p.hora_salida && <span className="sg-badge sg-badge-success">Completado</span>}
              </div>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: 17, margin: '28px 0 10px' }}>Evidencias fotográficas</h2>
        <label style={{ ...styles.botonAccion, display: 'inline-block', marginBottom: 16 }}>
          {subiendoEvidencia ? 'Subiendo…' : '+ Subir evidencia'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: 'none' }}
            disabled={subiendoEvidencia}
            onChange={(e) => e.target.files[0] && subirEvidencia(e.target.files[0])}
          />
        </label>
        {actividad.evidencias.length === 0 ? (
          <p style={{ color: 'var(--sg-ink-soft)', fontSize: 14 }}>Sin evidencias cargadas todavía.</p>
        ) : (
          <div style={styles.galeria}>
            {actividad.evidencias.map((ev) => (
              <div key={ev.id} style={styles.evidenciaCard}>
                <div style={{ fontSize: 12.5, color: 'var(--sg-ink-soft)' }}>{ev.descripcion || 'Sin descripción'}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  contenedor: { maxWidth: 900, margin: '0 auto', padding: '24px 24px 60px' },
  escaneoQr: { background: 'var(--sg-bg)', border: '1px solid var(--sg-border)', borderRadius: 'var(--sg-radius)', padding: 16, marginBottom: 24 },
  resultados: {
    position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--sg-surface)',
    border: '1px solid var(--sg-border)', borderRadius: 10, marginTop: 4, zIndex: 10,
    boxShadow: 'var(--sg-shadow)', overflow: 'hidden',
  },
  resultadoItem: {
    display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
    fontSize: 14, background: 'transparent', border: 'none', borderBottom: '1px solid var(--sg-border)',
  },
  listaParticipantes: {
    background: 'var(--sg-surface)', border: '1px solid var(--sg-border)', borderRadius: 'var(--sg-radius)', overflow: 'hidden',
  },
  filaParticipante: {
    display: 'grid', gridTemplateColumns: '2fr 1.3fr 1.3fr 1.6fr', gap: 12, alignItems: 'center',
    padding: '14px 18px', borderBottom: '1px solid var(--sg-border)', fontSize: 14,
  },
  botonAccion: {
    fontSize: 12.5, fontWeight: 600, padding: '8px 14px', borderRadius: 8,
    border: '1px solid var(--sg-primary)', color: 'var(--sg-primary)', cursor: 'pointer', background: 'transparent',
  },
  galeria: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 },
  evidenciaCard: {
    background: 'var(--sg-surface)', border: '1px solid var(--sg-border)', borderRadius: 10,
    padding: 16, minHeight: 80, display: 'flex', alignItems: 'flex-end',
  },
};
