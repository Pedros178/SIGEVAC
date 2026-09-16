import React, { useEffect, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { useParams, Link } from 'react-router-dom';
import BarraNavegacion from '../components/BarraNavegacion.jsx';
import MapaActividades from '../components/MapaActividades.jsx';
import IndicadorConexion from '../components/IndicadorConexion.jsx';
import api from '../services/api';
import { useModoOffline } from '../offline/useModoOffline';
import { encolarAccion, guardarActividadEnCache, obtenerActividadDeCache } from '../offline/db';

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
  const [desdeCache, setDesdeCache] = useState(false);
  const [escaneandoQr, setEscaneandoQr] = useState(false);
  const [errorEscanerQr, setErrorEscanerQr] = useState('');
  const videoQrRef = React.useRef(null);
  const flujoQrRef = React.useRef(null);

  useEffect(() => () => detenerEscanerQr(), []);

  function detenerEscanerQr() {
    flujoQrRef.current?.getTracks().forEach((pista) => pista.stop());
    flujoQrRef.current = null;
    setEscaneandoQr(false);
  }

  async function abrirEscanerQr() {
    setErrorEscanerQr('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorEscanerQr('El navegador no permite usar la cámara. Puedes escribir el código manualmente.');
      return;
    }
    try {
      const flujo = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      flujoQrRef.current = flujo;
      setEscaneandoQr(true);
      if (videoQrRef.current) videoQrRef.current.srcObject = flujo;
    } catch (err) {
      setErrorEscanerQr(err.name === 'NotAllowedError'
        ? 'El acceso a la cámara fue bloqueado. Permite la cámara desde el candado del navegador.'
        : 'No se pudo abrir la cámara. Verifica que esté conectada y que no la use otra aplicación.');
    }
  }

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await api.get(`/actividades/${id}`);
      setActividad(data.actividad);
      setDesdeCache(false);
      guardarActividadEnCache(id, data.actividad); // por si luego se pierde la conexión
    } catch (err) {
      const esErrorDeRed = !err.response;
      if (esErrorDeRed) {
        const enCache = await obtenerActividadDeCache(id);
        if (enCache) {
          setActividad(enCache.datos);
          setDesdeCache(true);
          setError('');
        } else {
          setError('Sin conexión y sin una copia guardada de esta actividad todavía.');
        }
      } else {
        setError(err.response?.data?.error || 'No se pudo cargar la actividad.');
      }
    } finally {
      setCargando(false);
    }
  }, [id]);

  const { enLinea, pendientes, sincronizando, sincronizarAhora } = useModoOffline(cargar);

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
    setError('');
    const horaCliente = new Date().toISOString();
    if (!navigator.onLine) {
      await encolarAccion({ actividadId: id, participacionId, tipo: 'entrada', horaCliente });
      actualizarParticipanteLocal(participacionId, { hora_entrada: horaCliente, _pendienteSync: true });
      return;
    }
    try {
      await api.post(`/participaciones/${participacionId}/entrada`, { horaCliente });
      await cargar();
    } catch (err) {
      if (!err.response) {
        // Falló por red aunque el navegador creía estar en línea: se
        // encola igual, no se pierde el registro.
        await encolarAccion({ actividadId: id, participacionId, tipo: 'entrada', horaCliente });
        actualizarParticipanteLocal(participacionId, { hora_entrada: horaCliente, _pendienteSync: true });
        return;
      }
      setError(err.response?.data?.error || 'No se pudo registrar la entrada.');
    }
  }

  async function registrarSalida(participacionId) {
    setError('');
    const horaCliente = new Date().toISOString();
    if (!navigator.onLine) {
      await encolarAccion({ actividadId: id, participacionId, tipo: 'salida', horaCliente });
      actualizarParticipanteLocal(participacionId, { hora_salida: horaCliente, _pendienteSync: true });
      return;
    }
    try {
      await api.post(`/participaciones/${participacionId}/salida`, { horaCliente });
      await cargar();
    } catch (err) {
      if (!err.response) {
        await encolarAccion({ actividadId: id, participacionId, tipo: 'salida', horaCliente });
        actualizarParticipanteLocal(participacionId, { hora_salida: horaCliente, _pendienteSync: true });
        return;
      }
      setError(err.response?.data?.error || 'No se pudo registrar la salida.');
    }
  }

  /**
   * Refleja el registro en pantalla de inmediato aunque no haya conexión
   * (feedback optimista), sin esperar a que la sincronización confirme
   * el dato real del servidor.
   */
  function actualizarParticipanteLocal(participacionId, cambios) {
    setActividad((prev) => prev && ({
      ...prev,
      participantes: prev.participantes.map((p) => (p.participacion_id === participacionId ? { ...p, ...cambios } : p)),
    }));
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
    await registrarCodigoQr(codigoQr.trim());
  }

  const registrarCodigoQr = useCallback(async (codigo) => {
    if (!codigo) return;
    setProcesandoQr(true); setMensajeQr(''); setError('');
    try {
      const { data } = await api.post(`/qr/${encodeURIComponent(codigo)}/asistencia`, { actividad_id: id });
      setMensajeQr(data.mensaje); setCodigoQr(''); await cargar();
    } catch (err) { setError(err.response?.data?.error || 'No se pudo registrar la asistencia por QR.'); }
    finally { setProcesandoQr(false); }
  }, [cargar, id]);

  useEffect(() => {
    if (!escaneandoQr || !videoQrRef.current || !flujoQrRef.current) return undefined;
    const video = videoQrRef.current;
    video.srcObject = flujoQrRef.current;
    const canvas = document.createElement('canvas');
    const contexto = canvas.getContext('2d', { willReadFrequently: true });
    let activo = true;
    const revisar = async () => {
      if (!activo || !video.videoWidth) return;
      try {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        contexto.drawImage(video, 0, 0, canvas.width, canvas.height);
        const codigoDetectado = jsQR(contexto.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        if (codigoDetectado?.data) {
          const codigo = codigoDetectado.data;
          setCodigoQr(codigo);
          detenerEscanerQr();
          await registrarCodigoQr(codigo);
          return;
        }
      } catch {
        // Continúa intentando mientras la cámara esté activa.
      }
      if (activo) window.requestAnimationFrame(revisar);
    };
    const iniciar = () => window.requestAnimationFrame(revisar);
    video.addEventListener('playing', iniciar, { once: true });
    return () => {
      activo = false;
      video.removeEventListener('playing', iniciar);
    };
  }, [escaneandoQr, registrarCodigoQr]);

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

        <IndicadorConexion enLinea={enLinea} pendientes={pendientes} sincronizando={sincronizando} onSincronizar={sincronizarAhora} />

        {desdeCache && (
          <div style={{ background: 'rgba(224, 164, 0, 0.14)', color: '#8A5A00', padding: '10px 12px', borderRadius: 8, fontSize: 13.5, marginBottom: 16 }}>
            📴 Mostrando la última versión guardada de esta actividad. Los registros de entrada/salida que hagas ahora se sincronizarán al recuperar la conexión.
          </div>
        )}

        <div style={{ margin: '14px 0 24px' }}>
          <h1 style={{ fontSize: 26 }}>{actividad.nombre}</h1>
          <p style={{ color: 'var(--sg-ink-soft)', fontSize: 14 }}>
            {new Date(actividad.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
            {actividad.lugar && ` · ${actividad.lugar}`}
            {actividad.cupo && ` · Cupo: ${actividad.participantes.length}/${actividad.cupo}`}
          </p>
          {actividad.descripcion && <p style={{ fontSize: 14, marginTop: 8 }}>{actividad.descripcion}</p>}
        </div>

        {actividad.latitud != null && actividad.longitud != null && (
          <div style={{ marginBottom: 24 }}>
            <MapaActividades actividades={[actividad]} altura={260} />
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(196,69,61,0.1)', color: 'var(--sg-danger)', padding: '10px 12px', borderRadius: 8, fontSize: 13.5, marginBottom: 16 }}>{error}</div>
        )}

        <section style={styles.escaneoQr}>
          <h2 style={{ fontSize: 17, margin: '0 0 6px' }}>Asistencia por QR</h2>
          <p style={{ color: 'var(--sg-ink-soft)', fontSize: 13, margin: '0 0 10px' }}>Captura el código de la credencial. El primer registro marca entrada y el segundo marca salida.</p>
          <form onSubmit={registrarPorQr} style={{ display: 'flex', gap: 8, maxWidth: 620, flexWrap: 'wrap' }}>
            <input className="sg-input" value={codigoQr} onChange={(e) => setCodigoQr(e.target.value)} placeholder="Código QR de la credencial" required />
            <button type="submit" className="sg-button-primary" style={{ width: 'auto', whiteSpace: 'nowrap' }} disabled={procesandoQr}>{procesandoQr ? 'Registrando…' : 'Registrar QR'}</button>
            <button type="button" onClick={abrirEscanerQr} style={{ ...styles.botonAccion, width: 'auto', whiteSpace: 'nowrap' }} disabled={procesandoQr}>Escanear con cámara</button>
          </form>
          {errorEscanerQr && <p style={{ color: 'var(--sg-danger)', fontSize: 13, marginBottom: 0 }}>{errorEscanerQr}</p>}
          {escaneandoQr && (
            <div style={{ marginTop: 12, maxWidth: 420 }}>
              <video ref={videoQrRef} autoPlay playsInline muted style={{ width: '100%', borderRadius: 8, background: '#101820' }} />
              <button type="button" onClick={detenerEscanerQr} style={{ ...styles.botonAccion, marginTop: 8 }}>Cerrar cámara</button>
            </div>
          )}
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
                {p.hora_entrada ? `Entrada: ${new Date(p.hora_entrada).toLocaleTimeString('es-MX')}${p._pendienteSync && !p.hora_salida ? ' ⏳' : ''}` : 'Sin registrar'}
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
                {p.hora_salida && (
                  p._pendienteSync
                    ? <span className="sg-badge sg-badge-warning">⏳ Pendiente de sincronizar</span>
                    : <span className="sg-badge sg-badge-success">Completado</span>
                )}
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
