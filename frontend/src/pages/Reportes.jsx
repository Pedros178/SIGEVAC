import { useEffect, useState } from 'react';
import BarraNavegacion from '../components/BarraNavegacion.jsx';
import api from '../services/api';

const ETIQUETAS_REPORTE = {
  'voluntarios-activos': 'Voluntarios activos',
  'voluntarios-inactivos': 'Voluntarios inactivos',
  'expedientes-completos': 'Expedientes completos',
  'expedientes-pendientes': 'Expedientes pendientes',
  'horas-acumuladas': 'Horas de servicio acumuladas',
  'participacion-por-actividad': 'Participación por actividad',
  'documentos-faltantes': 'Documentos faltantes',
  'menores': 'Voluntarios menores de edad',
  'mayores': 'Voluntarios mayores de edad',
  'voluntarios-por-municipio': 'Voluntarios por municipio',
};

const FORMATOS = [
  { valor: 'pdf', etiqueta: 'PDF' },
  { valor: 'xlsx', etiqueta: 'Excel' },
  { valor: 'csv', etiqueta: 'CSV' },
];

export default function Reportes() {
  const [tipos, setTipos] = useState([]);
  const [tipoSeleccionado, setTipoSeleccionado] = useState(null);
  const [vistaPrevia, setVistaPrevia] = useState(null);
  const [cargandoVista, setCargandoVista] = useState(false);
  const [descargando, setDescargando] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/reportes/tipos').then(({ data }) => setTipos(data.tipos)).catch(() => {});
  }, []);

  async function seleccionarReporte(tipo) {
    setTipoSeleccionado(tipo);
    setCargandoVista(true);
    setError('');
    try {
      const { data } = await api.get(`/reportes/${tipo}`, { params: { formato: 'json' } });
      setVistaPrevia(data);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cargar la vista previa del reporte.');
    } finally {
      setCargandoVista(false);
    }
  }

  async function descargar(formato) {
    setDescargando(formato);
    setError('');
    try {
      const respuesta = await api.get(`/reportes/${tipoSeleccionado}`, {
        params: { formato },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([respuesta.data]));
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `sigevac_${tipoSeleccionado}.${formato}`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('No se pudo descargar el reporte.');
    } finally {
      setDescargando(null);
    }
  }

  return (
    <div>
      <BarraNavegacion />
      <div style={styles.contenedor}>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>Reportes</h1>
        <p style={{ color: 'var(--sg-ink-soft)', fontSize: 14, marginBottom: 20 }}>
          Exporta información del sistema en PDF, Excel o CSV (Módulo 15)
        </p>

        <div style={styles.layout}>
          <div style={styles.listaReportes}>
            {tipos.map((tipo) => (
              <button
                key={tipo}
                onClick={() => seleccionarReporte(tipo)}
                style={{
                  ...styles.itemReporte,
                  ...(tipo === tipoSeleccionado ? styles.itemReporteActivo : {}),
                }}
              >
                {ETIQUETAS_REPORTE[tipo] || tipo}
              </button>
            ))}
          </div>

          <div style={styles.panelDetalle}>
            {!tipoSeleccionado ? (
              <p style={{ color: 'var(--sg-ink-soft)', fontSize: 14 }}>
                Selecciona un reporte de la lista para ver una vista previa y descargarlo.
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h2 style={{ fontSize: 18 }}>{ETIQUETAS_REPORTE[tipoSeleccionado]}</h2>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {FORMATOS.map((f) => (
                      <button
                        key={f.valor}
                        onClick={() => descargar(f.valor)}
                        disabled={descargando === f.valor}
                        style={styles.botonFormato}
                      >
                        {descargando === f.valor ? 'Generando…' : `Descargar ${f.etiqueta}`}
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div style={{ background: 'rgba(196,69,61,0.1)', color: 'var(--sg-danger)', padding: '10px 12px', borderRadius: 8, fontSize: 13.5, marginBottom: 16 }}>
                    {error}
                  </div>
                )}

                {cargandoVista ? (
                  <p style={{ color: 'var(--sg-ink-soft)', fontSize: 14 }}>Cargando vista previa…</p>
                ) : vistaPrevia && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={styles.tabla}>
                      <thead>
                        <tr>
                          {vistaPrevia.columnas.map((c) => (
                            <th key={c.key} style={styles.th}>{c.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {vistaPrevia.filas.length === 0 ? (
                          <tr><td colSpan={vistaPrevia.columnas.length} style={styles.tdVacio}>Sin registros.</td></tr>
                        ) : vistaPrevia.filas.slice(0, 15).map((fila, i) => (
                          <tr key={i}>
                            {vistaPrevia.columnas.map((c) => (
                              <td key={c.key} style={styles.td}>{String(fila[c.key] ?? '—')}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {vistaPrevia.filas.length > 15 && (
                      <p style={{ fontSize: 12, color: 'var(--sg-ink-soft)', marginTop: 8 }}>
                        Mostrando 15 de {vistaPrevia.filas.length} registros. Descarga el archivo para verlos todos.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  contenedor: { maxWidth: 1080, margin: '0 auto', padding: '32px 24px 60px' },
  layout: { display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 },
  listaReportes: {
    background: 'var(--sg-surface)', border: '1px solid var(--sg-border)', borderRadius: 'var(--sg-radius)',
    overflow: 'hidden', height: 'fit-content',
  },
  itemReporte: {
    display: 'block', width: '100%', textAlign: 'left', padding: '12px 16px', fontSize: 13.5,
    background: 'transparent', border: 'none', borderBottom: '1px solid var(--sg-border)', cursor: 'pointer',
  },
  itemReporteActivo: { background: 'rgba(54, 169, 214, 0.10)', color: 'var(--sg-primary)', fontWeight: 600 },
  panelDetalle: {
    background: 'var(--sg-surface)', border: '1px solid var(--sg-border)', borderRadius: 'var(--sg-radius)', padding: 20,
  },
  botonFormato: {
    fontSize: 12.5, fontWeight: 600, padding: '8px 14px', borderRadius: 8,
    border: '1px solid var(--sg-primary)', color: 'var(--sg-primary)', background: 'transparent', cursor: 'pointer',
  },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--sg-border)',
    color: 'var(--sg-ink-soft)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.03em',
  },
  td: { padding: '8px 10px', borderBottom: '1px solid var(--sg-border)' },
  tdVacio: { padding: 20, textAlign: 'center', color: 'var(--sg-ink-soft)' },
};
