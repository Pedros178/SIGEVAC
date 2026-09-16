import { useEffect, useState } from 'react';
import axios from 'axios';
import PanelInsignias from '../components/PanelInsignias.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const portalApi = axios.create({ baseURL: API_URL });

const ESTADO_DOCUMENTO_ETIQUETA = {
  pendiente: 'Pendiente',
  cargado: 'En revisión',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
};

export default function Portal() {
  const parametros = new URLSearchParams(window.location.search);
  const [token] = useState(parametros.get('token'));
  const [correo, setCorreo] = useState('');
  const [solicitudEnviada, setSolicitudEnviada] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [expediente, setExpediente] = useState(null);
  const [voluntario, setVoluntario] = useState(null);
  const [insignias, setInsignias] = useState([]);
  const [nivel, setNivel] = useState(null);
  const [pestana, setPestana] = useState('expediente'); // 'expediente' | 'insignias'
  const [cargando, setCargando] = useState(!!token);
  const [error, setError] = useState('');
  const [subiendoId, setSubiendoId] = useState(null);

  async function cargarExpediente() {
    setCargando(true);
    try {
      const [{ data }, { data: insigniasData }] = await Promise.all([
        portalApi.get('/portal/expediente', { headers: { Authorization: `Bearer ${token}` } }),
        portalApi.get('/portal/insignias', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setVoluntario(data.voluntario);
      setExpediente(data.expediente);
      setInsignias(insigniasData.insignias);
      setNivel(insigniasData.nivel);
    } catch (err) {
      setError(err.response?.data?.error || 'Tu enlace de acceso no es válido o ya expiró.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (token) cargarExpediente();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function solicitarAcceso(e) {
    e.preventDefault();
    setEnviando(true);
    try {
      await portalApi.post('/portal/solicitar-acceso', { correo });
      setSolicitudEnviada(true);
    } catch {
      setError('No se pudo procesar tu solicitud. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  async function subirArchivo(documentoId, archivo) {
    setSubiendoId(documentoId);
    try {
      const formData = new FormData();
      formData.append('archivo', archivo);
      await portalApi.post(`/portal/documentos/${documentoId}/archivos`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      await cargarExpediente();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo subir el archivo.');
    } finally {
      setSubiendoId(null);
    }
  }

  return (
    <div style={styles.pagina}>
      <div style={styles.tarjeta}>
        <h1 style={styles.titulo}>Portal del Voluntario</h1>
        <p style={styles.subtitulo}>Asociación Juvenil "Sueños de Comedia", A.C.</p>

        {!token ? (
          solicitudEnviada ? (
            <p style={styles.mensaje}>
              Si tu correo está registrado como voluntario (o como tutor de un voluntario menor de edad),
              te enviamos un enlace de acceso válido por 24 horas. Revisa tu bandeja de entrada.
            </p>
          ) : (
            <form onSubmit={solicitarAcceso}>
              <p style={styles.mensaje}>
                Ingresa tu correo (o el de tu tutor, si eres menor de edad) para recibir un enlace de
                acceso a tu expediente. No necesitas contraseña.
              </p>
              <input
                type="email" required className="sg-input" placeholder="tu.correo@ejemplo.com"
                value={correo} onChange={(e) => setCorreo(e.target.value)} style={{ marginBottom: 12 }}
              />
              <button type="submit" className="sg-button-primary" disabled={enviando}>
                {enviando ? 'Enviando…' : 'Solicitar acceso'}
              </button>
            </form>
          )
        ) : cargando ? (
          <p style={styles.mensaje}>Cargando tu expediente…</p>
        ) : error ? (
          <p style={{ ...styles.mensaje, color: 'var(--sg-danger)' }}>{error}</p>
        ) : (
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 4 }}>Hola, {voluntario?.nombre}</h2>
            <p style={{ fontSize: 13, color: 'var(--sg-ink-soft)', marginBottom: 20 }}>
              Folio {voluntario?.numero_voluntario} · Avance del expediente: {expediente?.porcentaje_avance ?? 0}%
            </p>

            <div style={styles.pestanas}>
              <button
                style={{ ...styles.botonPestana, ...(pestana === 'expediente' ? styles.botonPestanaActiva : {}) }}
                onClick={() => setPestana('expediente')}
              >
                Expediente
              </button>
              <button
                style={{ ...styles.botonPestana, ...(pestana === 'insignias' ? styles.botonPestanaActiva : {}) }}
                onClick={() => setPestana('insignias')}
              >
                Mis insignias {insignias.length > 0 ? `(${insignias.length})` : ''}
              </button>
            </div>

            {pestana === 'expediente' ? (
              expediente?.documentos?.map((doc) => (
                <div key={doc.id} style={styles.filaDocumento}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{doc.tipo_etiqueta}</div>
                    <div style={{ fontSize: 12, color: 'var(--sg-ink-soft)' }}>{ESTADO_DOCUMENTO_ETIQUETA[doc.estado]}</div>
                  </div>
                  {doc.estado !== 'aprobado' && (
                    <label style={styles.botonSubir}>
                      {subiendoId === doc.id ? 'Subiendo…' : 'Subir'}
                      <input
                        type="file" style={{ display: 'none' }} disabled={subiendoId === doc.id}
                        accept="application/pdf,image/png,image/jpeg,image/webp"
                        onChange={(e) => e.target.files[0] && subirArchivo(doc.id, e.target.files[0])}
                      />
                    </label>
                  )}
                </div>
              ))
            ) : (
              <PanelInsignias insignias={insignias} nivel={nivel} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  pagina: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--sg-bg)', padding: 24,
  },
  tarjeta: {
    background: 'var(--sg-surface)', borderRadius: 16, padding: 32, width: '100%', maxWidth: 480,
    boxShadow: 'var(--sg-shadow)',
  },
  pestanas: {
    display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--sg-border)',
  },
  botonPestana: {
    background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
    padding: '8px 4px', color: 'var(--sg-ink-soft)', borderBottom: '2px solid transparent',
  },
  botonPestanaActiva: {
    color: 'var(--sg-primary)', borderBottom: '2px solid var(--sg-primary)',
  },
  titulo: { fontFamily: 'var(--sg-font-display)', fontSize: 24, color: 'var(--sg-primary)', marginBottom: 4 },
  subtitulo: { fontSize: 13, color: 'var(--sg-ink-soft)', marginBottom: 20 },
  mensaje: { fontSize: 13.5, color: 'var(--sg-ink-soft)', lineHeight: 1.6, marginBottom: 14 },
  filaDocumento: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 0', borderBottom: '1px solid var(--sg-border)',
  },
  botonSubir: {
    fontSize: 12.5, fontWeight: 600, padding: '7px 14px', borderRadius: 8,
    border: '1px solid var(--sg-primary)', color: 'var(--sg-primary)', cursor: 'pointer',
  },
};
