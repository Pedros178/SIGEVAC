import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import BarraNavegacion from '../components/BarraNavegacion.jsx';
import BadgeSemaforo from '../components/BadgeSemaforo.jsx';
import api from '../services/api';

const ESTADO_DOCUMENTO_BADGE = {
  pendiente: 'sg-badge-danger',
  cargado: 'sg-badge-warning',
  aprobado: 'sg-badge-success',
  rechazado: 'sg-badge-danger',
};

const ESTADO_DOCUMENTO_ETIQUETA = {
  pendiente: 'Pendiente',
  cargado: 'En revisión',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
};

export default function VoluntarioDetalle() {
  const { id } = useParams();
  const [voluntario, setVoluntario] = useState(null);
  const [expediente, setExpediente] = useState(null);
  const [credencial, setCredencial] = useState(null);
  const [horas, setHoras] = useState(null);
  const [generandoCredencial, setGenerandoCredencial] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [subiendoId, setSubiendoId] = useState(null);
  const [error, setError] = useState('');

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const [{ data: volData }, { data: expData }, { data: horasData }] = await Promise.all([
        api.get(`/voluntarios/${id}`),
        api.get(`/voluntarios/${id}/expediente`),
        api.get(`/voluntarios/${id}/horas-servicio`),
      ]);
      setVoluntario(volData.voluntario);
      setExpediente(expData.expediente);
      setHoras(horasData);
      try {
        const { data: credData } = await api.get(`/voluntarios/${id}/credencial`);
        setCredencial(credData.credencial);
      } catch {
        setCredencial(null); // aún no tiene credencial generada
      }
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cargar el voluntario.');
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  async function manejarGenerarCredencial() {
    setGenerandoCredencial(true);
    setError('');
    try {
      const { data } = await api.post(`/voluntarios/${id}/credencial`, {});
      setCredencial(data.credencial);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo generar la credencial.');
    } finally {
      setGenerandoCredencial(false);
    }
  }

  async function manejarSubirArchivo(documentoId, archivo) {
    setSubiendoId(documentoId);
    setError('');
    try {
      const formData = new FormData();
      formData.append('archivo', archivo);
      await api.post(`/documentos/${documentoId}/archivos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo subir el archivo.');
    } finally {
      setSubiendoId(null);
    }
  }

  async function manejarAprobar(documentoId) {
    try {
      await api.post(`/documentos/${documentoId}/aprobar`, {});
      await cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo aprobar el documento.');
    }
  }

  async function manejarRechazar(documentoId) {
    const observaciones = window.prompt('Motivo del rechazo:');
    if (!observaciones) return;
    try {
      await api.post(`/documentos/${documentoId}/rechazar`, { observaciones });
      await cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo rechazar el documento.');
    }
  }

  if (cargando) {
    return (
      <div>
        <BarraNavegacion />
        <div style={styles.contenedor}><p style={{ color: 'var(--sg-ink-soft)' }}>Cargando expediente…</p></div>
      </div>
    );
  }

  if (!voluntario) {
    return (
      <div>
        <BarraNavegacion />
        <div style={styles.contenedor}>
          <p style={{ color: 'var(--sg-danger)' }}>{error || 'Voluntario no encontrado.'}</p>
          <Link to="/voluntarios">← Volver al listado</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <BarraNavegacion />
      <div style={styles.contenedor}>
        <Link to="/voluntarios" style={{ fontSize: 13.5, color: 'var(--sg-ink-soft)' }}>← Volver a Voluntarios</Link>

        <div style={styles.encabezadoVoluntario}>
          <div>
            <h1 style={{ fontSize: 26 }}>
              {voluntario.nombre} {voluntario.apellido_paterno} {voluntario.apellido_materno}
            </h1>
            <p style={{ color: 'var(--sg-ink-soft)', fontSize: 14 }}>
              Folio {voluntario.numero_voluntario} · {voluntario.es_menor_edad ? 'Menor de edad' : 'Mayor de edad'}
              {voluntario.tutor && ` · Tutor: ${voluntario.tutor.nombre}`}
            </p>
          </div>
          {expediente && <BadgeSemaforo estado={expediente.estado} porcentaje={expediente.porcentaje_avance} />}
        </div>

        {error && (
          <div style={{ background: 'rgba(196,69,61,0.1)', color: 'var(--sg-danger)', padding: '10px 12px', borderRadius: 8, fontSize: 13.5, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <h2 style={{ fontSize: 17, marginBottom: 12 }}>Expediente digital</h2>
        <div style={styles.listaDocumentos}>
          {expediente?.documentos?.map((doc) => (
            <div key={doc.id} style={styles.filaDocumento}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{doc.tipo_etiqueta}</div>
                {doc.observaciones && (
                  <div style={{ fontSize: 12.5, color: 'var(--sg-danger)', marginTop: 2 }}>{doc.observaciones}</div>
                )}
              </div>
              <span className={`sg-badge ${ESTADO_DOCUMENTO_BADGE[doc.estado]}`}>
                {ESTADO_DOCUMENTO_ETIQUETA[doc.estado]}
              </span>
              <div style={styles.accionesDocumento}>
                <label style={styles.botonSubir}>
                  {subiendoId === doc.id ? 'Subiendo…' : doc.total_versiones > 0 ? 'Reemplazar' : 'Subir archivo'}
                  <input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/webp"
                    style={{ display: 'none' }}
                    disabled={subiendoId === doc.id}
                    onChange={(e) => e.target.files[0] && manejarSubirArchivo(doc.id, e.target.files[0])}
                  />
                </label>
                {doc.estado === 'cargado' && (
                  <>
                    <button style={styles.botonAprobar} onClick={() => manejarAprobar(doc.id)}>Aprobar</button>
                    <button style={styles.botonRechazar} onClick={() => manejarRechazar(doc.id)}>Rechazar</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={styles.filaDosColumnas}>
          <div>
            <h2 style={{ fontSize: 17, margin: '28px 0 12px' }}>Credencial digital</h2>
            <div style={styles.tarjetaCredencial}>
              {credencial ? (
                <>
                  <img src={credencial.qr_imagen} alt="Código QR de la credencial" style={{ width: 120, height: 120 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{credencial.nombre}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--sg-ink-soft)' }}>Folio {credencial.numero_voluntario}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--sg-ink-soft)', marginTop: 4 }}>
                      Vigente hasta {new Date(credencial.vigente_hasta).toLocaleDateString('es-MX')}
                    </div>
                    <button style={{ ...styles.botonSubir, marginTop: 10 }} onClick={manejarGenerarCredencial} disabled={generandoCredencial}>
                      {generandoCredencial ? 'Renovando…' : 'Renovar credencial'}
                    </button>
                  </div>
                </>
              ) : (
                <div>
                  <p style={{ fontSize: 13.5, color: 'var(--sg-ink-soft)', marginBottom: 10 }}>
                    Este voluntario aún no tiene una credencial digital generada.
                  </p>
                  <button className="sg-button-primary" style={{ width: 'auto', padding: '9px 16px' }} onClick={manejarGenerarCredencial} disabled={generandoCredencial}>
                    {generandoCredencial ? 'Generando…' : 'Generar credencial'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: 17, margin: '28px 0 12px' }}>Horas de servicio</h2>
            <div style={styles.tarjetaHoras}>
              <div style={{ fontFamily: 'var(--sg-font-display)', fontSize: 28, fontWeight: 600, color: 'var(--sg-primary)' }}>
                {horas?.total_horas ?? 0} h
              </div>
              {horas?.detalle?.length > 0 ? (
                <div style={{ marginTop: 10 }}>
                  {horas.detalle.map((h) => (
                    <div key={`${h.tipo}-${h.periodo}`} style={{ fontSize: 12.5, color: 'var(--sg-ink-soft)', display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span>{h.tipo} · {h.periodo}</span>
                      <span>{h.horas_acumuladas} h</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12.5, color: 'var(--sg-ink-soft)', marginTop: 8 }}>Sin horas registradas todavía.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  contenedor: { maxWidth: 900, margin: '0 auto', padding: '24px 24px 60px' },
  encabezadoVoluntario: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    margin: '14px 0 24px',
  },
  listaDocumentos: {
    background: 'var(--sg-surface)',
    border: '1px solid var(--sg-border)',
    borderRadius: 'var(--sg-radius)',
    overflow: 'hidden',
  },
  filaDocumento: {
    display: 'grid',
    gridTemplateColumns: '2fr auto 2fr',
    gap: 14,
    alignItems: 'center',
    padding: '14px 18px',
    borderBottom: '1px solid var(--sg-border)',
  },
  accionesDocumento: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  botonSubir: {
    fontSize: 12.5,
    fontWeight: 600,
    padding: '7px 12px',
    borderRadius: 8,
    border: '1px solid var(--sg-primary)',
    color: 'var(--sg-primary)',
    cursor: 'pointer',
  },
  botonAprobar: {
    fontSize: 12.5,
    fontWeight: 600,
    padding: '7px 12px',
    borderRadius: 8,
    border: 'none',
    background: 'var(--sg-success)',
    color: 'white',
  },
  botonRechazar: {
    fontSize: 12.5,
    fontWeight: 600,
    padding: '7px 12px',
    borderRadius: 8,
    border: 'none',
    background: 'var(--sg-danger)',
    color: 'white',
  },
  filaDosColumnas: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 24,
  },
  tarjetaCredencial: {
    background: 'var(--sg-surface)',
    border: '1px solid var(--sg-border)',
    borderRadius: 'var(--sg-radius)',
    padding: 18,
    display: 'flex',
    gap: 16,
    alignItems: 'center',
  },
  tarjetaHoras: {
    background: 'var(--sg-surface)',
    border: '1px solid var(--sg-border)',
    borderRadius: 'var(--sg-radius)',
    padding: 18,
  },
};
