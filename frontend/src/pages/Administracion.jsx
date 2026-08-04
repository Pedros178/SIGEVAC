import React, { useEffect, useState } from 'react';
import BarraNavegacion from '../components/BarraNavegacion.jsx';
import api from '../services/api';

const PESTANAS = [
  { id: 'auditoria', etiqueta: 'Auditoría' },
  { id: 'bitacora', etiqueta: 'Bitácora' },
  { id: 'configuracion', etiqueta: 'Configuración' },
  { id: 'respaldos', etiqueta: 'Respaldos' },
];

export default function Administracion() {
  const [pestana, setPestana] = useState('auditoria');

  return (
    <div>
      <BarraNavegacion />
      <div style={styles.contenedor}>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>Administración</h1>
        <p style={{ color: 'var(--sg-ink-soft)', fontSize: 14, marginBottom: 20 }}>
          Auditoría, bitácora, configuración y respaldos (Módulos 18–21)
        </p>

        <div style={styles.tabs}>
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPestana(p.id)}
              style={{ ...styles.tab, ...(pestana === p.id ? styles.tabActivo : {}) }}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>

        {pestana === 'auditoria' && <PanelAuditoria />}
        {pestana === 'bitacora' && <PanelBitacora />}
        {pestana === 'configuracion' && <PanelConfiguracion />}
        {pestana === 'respaldos' && <PanelRespaldos />}
      </div>
    </div>
  );
}

function useCargaProtegida(cargar, deps = []) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    setError('');
    cargar()
      .then(setDatos)
      .catch((err) => setError(err.response?.status === 403
        ? 'No tienes permiso para ver esta sección.'
        : 'No se pudo cargar la información.'))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { datos, error, cargando };
}

function PanelAuditoria() {
  const { datos, error, cargando } = useCargaProtegida(() => api.get('/auditoria').then((r) => r.data.auditoria));
  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} />;
  return (
    <TablaGenerica
      columnas={['Acción', 'Módulo', 'Usuario', 'Fecha']}
      filas={datos.map((r) => [r.accion, r.modulo_afectado, r.usuario_nombre || '—', new Date(r.creado_en).toLocaleString('es-MX')])}
      vacio="Aún no hay acciones registradas."
    />
  );
}

function PanelBitacora() {
  const { datos, error, cargando } = useCargaProtegida(() => api.get('/auditoria/bitacora').then((r) => r.data.bitacora));
  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} />;
  return (
    <TablaGenerica
      columnas={['Evento', 'Estado', 'Duración', 'Fecha']}
      filas={datos.map((r) => [r.evento, r.contexto?.status, `${r.contexto?.duracion_ms ?? '—'} ms`, new Date(r.creado_en).toLocaleString('es-MX')])}
      vacio="Aún no hay actividad registrada."
    />
  );
}

function PanelConfiguracion() {
  const { datos, error, cargando } = useCargaProtegida(() => api.get('/configuracion').then((r) => r.data.configuracion));
  const [clave, setClave] = useState('');
  const [valor, setValor] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [items, setItems] = useState(null);

  useEffect(() => { if (datos) setItems(datos); }, [datos]);

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      let valorFinal = valor;
      try { valorFinal = JSON.parse(valor); } catch { /* se guarda como texto plano */ }
      await api.put(`/configuracion/${encodeURIComponent(clave)}`, { valor: valorFinal });
      const { data } = await api.get('/configuracion');
      setItems(data.configuracion);
      setClave(''); setValor('');
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} />;

  return (
    <div>
      <form onSubmit={guardar} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input className="sg-input" placeholder="Clave (p. ej. dias_alerta_vigencia)" value={clave} onChange={(e) => setClave(e.target.value)} required style={{ maxWidth: 260 }} />
        <input className="sg-input" placeholder="Valor (texto o JSON)" value={valor} onChange={(e) => setValor(e.target.value)} required style={{ maxWidth: 260 }} />
        <button type="submit" className="sg-button-primary" style={{ width: 'auto', padding: '10px 18px' }} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </form>
      <TablaGenerica
        columnas={['Clave', 'Valor']}
        filas={(items || []).map((i) => [i.clave, JSON.stringify(i.valor)])}
        vacio="Sin configuración personalizada todavía."
      />
    </div>
  );
}

function PanelRespaldos() {
  const [respaldos, setRespaldos] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState(false);

  async function cargar() {
    setCargando(true);
    try {
      const { data } = await api.get('/respaldos');
      setRespaldos(data.respaldos);
      setError('');
    } catch (err) {
      setError(err.response?.status === 403 ? 'No tienes permiso para ver esta sección.' : 'No se pudo cargar la información.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  async function generar() {
    setGenerando(true);
    try {
      await api.post('/respaldos', {});
      await cargar();
    } catch {
      setError('No se pudo generar el respaldo.');
    } finally {
      setGenerando(false);
    }
  }

  async function descargar(id) {
    const respuesta = await api.get(`/respaldos/${id}/descargar`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([respuesta.data]));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `sigevac_respaldo_${id}.sql`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    window.URL.revokeObjectURL(url);
  }

  if (cargando) return <Cargando />;
  if (error) return <Error mensaje={error} />;

  return (
    <div>
      <button className="sg-button-primary" style={{ width: 'auto', padding: '10px 18px', marginBottom: 16 }} onClick={generar} disabled={generando}>
        {generando ? 'Generando respaldo…' : '+ Generar respaldo ahora'}
      </button>
      <div style={styles.tabla}>
        <div style={{ ...styles.fila, ...styles.filaEncabezado }}>
          <span>Fecha</span><span>Tamaño</span><span>Generado por</span><span></span>
        </div>
        {respaldos.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--sg-ink-soft)', fontSize: 14 }}>Aún no se ha generado ningún respaldo.</div>
        ) : respaldos.map((r) => (
          <div key={r.id} style={styles.fila}>
            <span>{new Date(r.creado_en).toLocaleString('es-MX')}</span>
            <span>{(r.tamano_bytes / 1024).toFixed(1)} KB</span>
            <span>{r.generado_por_nombre || '—'}</span>
            <button style={styles.botonDescargar} onClick={() => descargar(r.id)}>Descargar</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TablaGenerica({ columnas, filas, vacio }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {columnas.map((c) => <th key={c} style={styles.th}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 ? (
            <tr><td colSpan={columnas.length} style={{ padding: 20, textAlign: 'center', color: 'var(--sg-ink-soft)' }}>{vacio}</td></tr>
          ) : filas.map((fila, i) => (
            <tr key={i}>
              {fila.map((valor, j) => <td key={j} style={styles.td}>{String(valor ?? '—')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cargando() { return <p style={{ color: 'var(--sg-ink-soft)', fontSize: 14 }}>Cargando…</p>; }
function Error({ mensaje }) {
  return <div style={{ background: 'rgba(196,69,61,0.1)', color: 'var(--sg-danger)', padding: '10px 12px', borderRadius: 8, fontSize: 13.5 }}>{mensaje}</div>;
}

const styles = {
  contenedor: { maxWidth: 1080, margin: '0 auto', padding: '32px 24px 60px' },
  tabs: { display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--sg-border)' },
  tab: {
    padding: '10px 16px', fontSize: 13.5, fontWeight: 600, color: 'var(--sg-ink-soft)',
    background: 'transparent', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer',
  },
  tabActivo: { color: 'var(--sg-primary)', borderBottomColor: 'var(--sg-primary)' },
  th: {
    textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--sg-border)',
    color: 'var(--sg-ink-soft)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.03em',
  },
  td: { padding: '8px 10px', borderBottom: '1px solid var(--sg-border)' },
  tabla: { background: 'var(--sg-surface)', border: '1px solid var(--sg-border)', borderRadius: 'var(--sg-radius)', overflow: 'hidden' },
  fila: {
    display: 'grid', gridTemplateColumns: '1.6fr 1fr 1.4fr auto', gap: 12, alignItems: 'center',
    padding: '12px 16px', borderBottom: '1px solid var(--sg-border)', fontSize: 13.5,
  },
  filaEncabezado: {
    fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em',
    color: 'var(--sg-ink-soft)', background: 'var(--sg-bg)',
  },
  botonDescargar: {
    fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8,
    border: '1px solid var(--sg-primary)', color: 'var(--sg-primary)', background: 'transparent', cursor: 'pointer',
  },
};
