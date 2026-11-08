import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

const TIPOS_ARCO = [
  ['acceso', 'Acceso'], ['rectificacion', 'Rectificación'], ['cancelacion', 'Cancelación'], ['oposicion', 'Oposición'],
];
const CAMPOS_AVISO = [
  ['persona_designada', 'Persona o departamento de datos personales (art. 29)'],
  ['correo_arco', 'Correo para derechos ARCO'],
  ['telefono_arco', 'Teléfono para derechos ARCO (opcional)'],
  ['domicilio', 'Domicilio del responsable'],
  ['version_aviso', 'Versión del aviso (cámbiala cuando modifiques el aviso)'],
  ['medios_limitar_uso', 'Medios adicionales para limitar el uso o divulgación (opcional)'],
];
const fecha = (v) => (v ? String(v).slice(0, 10) : '—');
const mensajeError = (err, defecto) => err.response?.data?.error || defecto;

/**
 * Panel de privacidad (Ley Federal de Protección de Datos Personales en Posesión de los Particulares, 2025):
 * datos del aviso de privacidad, solicitudes ARCO con sus plazos (20 días hábiles de respuesta + 15 de ejecución,
 * ampliables una sola vez) y revisión de datos que ya podrían suprimirse. Requiere el permiso privacidad.gestionar.
 */
export default function PanelPrivacidad() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SeccionAviso />
      <SeccionArco />
      <SeccionConservacion />
    </div>
  );
}

function SeccionAviso() {
  const [campos, setCampos] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/privacidad/aviso')
      .then(({ data }) => setCampos(Object.fromEntries(CAMPOS_AVISO.map(([k]) => [k, data.aviso?.[k] || '']))))
      .catch((err) => setError(mensajeError(err, 'No se pudo cargar el aviso.')));
  }, []);

  async function guardar(e) {
    e.preventDefault();
    setMensaje(''); setError('');
    try {
      const enviar = Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== ''));
      await api.put('/privacidad/aviso', enviar);
      setMensaje('Aviso guardado. Ya se muestra en la página pública /aviso-privacidad.');
    } catch (err) { setError(mensajeError(err, 'No se pudo guardar.')); }
  }

  if (!campos) return error ? <p role="alert">{error}</p> : <p>Cargando…</p>;
  return (
    <section>
      <h3>Aviso de privacidad</h3>
      <p style={{ fontSize: 13 }}>
        El aviso integral es público en <code>/aviso-privacidad</code>. Mientras falten el domicilio, el correo ARCO o la persona designada, el sistema lo
        marca como <b>incompleto</b>. El texto debe ser revisado por la representación legal de la asociación.
      </p>
      <form onSubmit={guardar} style={{ display: 'grid', gap: 10, maxWidth: 640 }}>
        {CAMPOS_AVISO.map(([clave, etiqueta]) => (
          <label key={clave} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13.5, fontWeight: 600 }}>
            {etiqueta}
            <input className="sg-input" value={campos[clave]} onChange={(e) => setCampos((c) => ({ ...c, [clave]: e.target.value }))} />
          </label>
        ))}
        <div><button type="submit" className="sg-button-primary">Guardar aviso</button></div>
      </form>
      {mensaje && <p role="status">{mensaje}</p>}
      {error && <p role="alert" style={{ color: '#b42318' }}>{error}</p>}
    </section>
  );
}

function SeccionArco() {
  const [solicitudes, setSolicitudes] = useState(null);
  const [nueva, setNueva] = useState({ tipo: 'acceso', detalle: '' });
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    api.get('/privacidad/arco')
      .then(({ data }) => setSolicitudes(data.solicitudes))
      .catch((err) => setError(mensajeError(err, 'No se pudieron cargar las solicitudes.')));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function accion(fn, defecto) {
    setError('');
    try { await fn(); cargar(); } catch (err) { setError(mensajeError(err, defecto)); }
  }

  async function registrar(e) {
    e.preventDefault();
    await accion(async () => {
      await api.post('/privacidad/arco', { tipo: nueva.tipo, detalle: nueva.detalle || undefined });
      setNueva({ tipo: 'acceso', detalle: '' });
    }, 'No se pudo registrar la solicitud.');
  }

  async function resolver(s, estado) {
    const resolucion = window.prompt('Resolución o comentario para el expediente de la solicitud (opcional):') ?? undefined;
    if (resolucion === undefined) return;
    const notificadoTitular = estado === 'atendida' && s.tipo === 'cancelacion'
      ? window.confirm('Art. 24: ¿ya avisaste a la persona titular que sus datos fueron cancelados?')
      : false;
    await accion(() => api.patch(`/privacidad/arco/${s.id}`, { estado, resolucion: resolucion || undefined, notificadoTitular }), 'No se pudo actualizar.');
  }

  async function descargarDatos(s) {
    setError('');
    try {
      const { data } = await api.get(`/privacidad/voluntarios/${s.voluntario_id}/datos-personales`, { params: { descargar: 1 }, responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url; a.download = `datos-personales-${s.voluntario_id}.json`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { setError(mensajeError(err, 'No se pudieron descargar los datos.')); }
  }

  return (
    <section>
      <h3>Solicitudes ARCO (acceso, rectificación, cancelación, oposición)</h3>
      <p style={{ fontSize: 13 }}>
        Plazos legales (art. 31): <b>20 días hábiles</b> para responder y <b>15 días hábiles</b> más para hacerla efectiva (“En proceso” = ya comunicaste la
        determinación). Se pueden ampliar <b>una sola vez</b>. El trámite es gratuito. Para atender un acceso, descarga los datos; para una cancelación,
        usa la sección “Conservación” o la API de anonimización.
      </p>
      <form onSubmit={registrar} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <select className="sg-input" value={nueva.tipo} onChange={(e) => setNueva((n) => ({ ...n, tipo: e.target.value }))} aria-label="Tipo de solicitud">
          {TIPOS_ARCO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input className="sg-input" style={{ flex: 1, minWidth: 220 }} placeholder="Detalle de lo que solicita la persona titular" value={nueva.detalle} onChange={(e) => setNueva((n) => ({ ...n, detalle: e.target.value }))} />
        <button type="submit" className="sg-button-primary">Registrar solicitud</button>
      </form>
      {error && <p role="alert" style={{ color: '#b42318' }}>{error}</p>}
      {!solicitudes ? <p>Cargando…</p> : solicitudes.length === 0 ? <p>No hay solicitudes registradas.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead><tr><th align="left">Tipo</th><th align="left">Persona</th><th align="left">Estado</th><th align="left">Responder antes de</th><th align="left">Ejecutar antes de</th><th align="left">Acciones</th></tr></thead>
            <tbody>
              {solicitudes.map((s) => (
                <tr key={s.id} style={{ borderTop: '1px solid var(--sg-line, #e4e7ec)' }}>
                  <td>{TIPOS_ARCO.find(([v]) => v === s.tipo)?.[1]}</td>
                  <td>{s.voluntario_nombre || '—'}</td>
                  <td>{s.estado.replace('_', ' ')}{s.vencida && <b style={{ color: '#b42318' }}> · VENCIDA</b>}{s.ampliada && ' · ampliada'}</td>
                  <td>{fecha(s.fecha_limite)}</td>
                  <td>{fecha(s.fecha_limite_ejecucion)}</td>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['recibida', 'en_proceso'].includes(s.estado) && (
                      <>
                        {s.estado === 'recibida' && <button type="button" className="sg-button-secondary" onClick={() => resolver(s, 'en_proceso')}>En proceso</button>}
                        <button type="button" className="sg-button-secondary" onClick={() => resolver(s, 'atendida')}>Atendida</button>
                        <button type="button" className="sg-button-secondary" onClick={() => resolver(s, 'rechazada')}>Rechazar</button>
                        {!s.ampliada && <button type="button" className="sg-button-secondary" onClick={() => accion(() => api.patch(`/privacidad/arco/${s.id}/ampliar`), 'No se pudo ampliar.')}>Ampliar plazo</button>}
                      </>
                    )}
                    {s.voluntario_id && <button type="button" className="sg-button-secondary" onClick={() => descargarDatos(s)}>Descargar datos</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SeccionConservacion() {
  const [anios, setAnios] = useState(5);
  const [candidatos, setCandidatos] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  async function buscar() {
    setError(''); setMensaje('');
    try {
      const { data } = await api.get('/privacidad/retencion/candidatos', { params: { anios } });
      setCandidatos(data.candidatos);
    } catch (err) { setError(mensajeError(err, 'No se pudo consultar.')); }
  }

  async function anonimizar(c) {
    const motivo = window.prompt(`Motivo para eliminar los datos personales de ${c.nombre} (queda en la auditoría):`);
    if (!motivo) return;
    if (!window.confirm(`Esta acción es IRREVERSIBLE: se borran los datos personales, el expediente y los archivos de ${c.nombre}. ¿Continuar?`)) return;
    try {
      await api.post(`/privacidad/voluntarios/${c.id}/anonimizar`, { confirmar: true, motivo });
      setMensaje(`Datos de ${c.nombre} eliminados. Si fue por una solicitud de cancelación, avisa a la persona titular (art. 24).`);
      buscar();
    } catch (err) { setError(mensajeError(err, 'No se pudo anonimizar.')); }
  }

  return (
    <section>
      <h3>Conservación de datos</h3>
      <p style={{ fontSize: 13 }}>
        Los datos que ya no son necesarios para las finalidades del aviso deben suprimirse una vez concluido el plazo de conservación (art. 10 y 12).
        Aquí aparecen las bajas antiguas que aún conservan datos personales; <b>nada se borra solo</b>: tú decides. Algunos datos pueden tener que conservarse
        por obligaciones legales o fiscales (art. 25): consúltalo con tu representación legal.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <label>Bajas de hace más de{' '}
          <input className="sg-input" type="number" min="1" max="50" value={anios} onChange={(e) => setAnios(e.target.value)} style={{ width: 70 }} /> años
        </label>
        <button type="button" className="sg-button-secondary" onClick={buscar}>Buscar</button>
      </div>
      {mensaje && <p role="status">{mensaje}</p>}
      {error && <p role="alert" style={{ color: '#b42318' }}>{error}</p>}
      {candidatos && (candidatos.length === 0 ? <p>No hay bajas antiguas con datos pendientes de revisión.</p> : (
        <ul style={{ paddingLeft: 18 }}>
          {candidatos.map((c) => (
            <li key={c.id} style={{ marginBottom: 6 }}>
              {c.numero_voluntario} · {c.nombre} · baja {fecha(c.fecha_baja)}{' '}
              <button type="button" className="sg-button-secondary" onClick={() => anonimizar(c)}>Eliminar datos personales</button>
            </li>
          ))}
        </ul>
      ))}
    </section>
  );
}
