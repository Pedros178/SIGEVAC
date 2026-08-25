import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import BarraNavegacion from '../components/BarraNavegacion.jsx';
import BadgeSemaforo from '../components/BadgeSemaforo.jsx';
import PadFirma from '../components/PadFirma.jsx';
import FotoVoluntario from '../components/FotoVoluntario.jsx';
import EscanerDocumento from '../components/EscanerDocumento.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api';

const TIPOS_CON_PLANTILLA = ['carta_responsiva', 'aviso_privacidad', 'reglamento_interno', 'uso_imagen', 'carta_autorizacion'];

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
  const { tienePermiso } = useAuth();
  const [voluntario, setVoluntario] = useState(null);
  const [expediente, setExpediente] = useState(null);
  const [credencial, setCredencial] = useState(null);
  const [horas, setHoras] = useState(null);
  const [generandoCredencial, setGenerandoCredencial] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [subiendoId, setSubiendoId] = useState(null);
  const [generandoId, setGenerandoId] = useState(null);
  const [documentoAFirmar, setDocumentoAFirmar] = useState(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [descargandoFicha, setDescargandoFicha] = useState(null); // 'pdf' | 'xlsx' | 'imprimir' | null
  const [documentoAEscanear, setDocumentoAEscanear] = useState(null); // { id, tipoClave } | null
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

  async function manejarGenerarPlantilla(documentoId) {
    setGenerandoId(documentoId);
    setError('');
    try {
      await api.post(`/documentos/${documentoId}/generar`, {});
      await cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo generar el documento.');
    } finally {
      setGenerandoId(null);
    }
  }

  async function manejarConfirmarFirma({ imagenPngBase64, firmanteNombre }) {
    setError('');
    try {
      await api.post(`/documentos/${documentoAFirmar}/firmar`, {
        imagenPngBase64, firmanteNombre, firmanteTipo: voluntario.es_menor_edad ? 'tutor' : 'voluntario',
      });
      setDocumentoAFirmar(null);
      await cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar la firma.');
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

  async function manejarSubirFoto(archivo) {
    setSubiendoFoto(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('foto', archivo);
      await api.post(`/voluntarios/${id}/foto`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo subir la fotografía.');
    } finally {
      setSubiendoFoto(false);
    }
  }

  /** Se llama cuando el escáner (EscanerDocumento) ya recortó/mejoró la
   * foto y el usuario confirmó usarla. Sube el archivo resultante con el
   * mismo flujo de siempre, y si el OCR detectó un CURP y el voluntario
   * no tiene uno capturado, ofrece guardarlo también. */
  async function manejarEscaneoConfirmado(archivo, curpDetectado) {
    const documentoId = documentoAEscanear?.id;
    setDocumentoAEscanear(null);
    if (!documentoId) return;

    await manejarSubirArchivo(documentoId, archivo);

    if (curpDetectado && !voluntario.curp) {
      const confirmar = window.confirm(
        `Se detectó este CURP en el documento:\n\n${curpDetectado}\n\n¿Guardarlo en los datos del voluntario?`
      );
      if (confirmar) {
        try {
          await api.put(`/voluntarios/${id}`, { curp: curpDetectado });
          await cargarDatos();
        } catch {
          setError('El documento se subió, pero no se pudo guardar el CURP detectado. Puedes capturarlo manualmente.');
        }
      }
    }
  }

  /** Descarga la ficha en PDF/Excel, o la abre en una pestaña nueva lista
   * para imprimir (el visor de PDF del navegador ya trae su propio botón
   * de impresión). Reutiliza el mismo patrón de descarga por blob que
   * Reportes.jsx y Administración > Respaldos. */
  async function manejarFicha(accion) {
    setDescargandoFicha(accion);
    setError('');
    try {
      const extension = accion === 'xlsx' ? 'xlsx' : 'pdf';
      const respuesta = await api.get(`/voluntarios/${id}/ficha.${extension}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([respuesta.data]));

      if (accion === 'imprimir') {
        window.open(url, '_blank');
      } else {
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `ficha-${voluntario.numero_voluntario}.${extension}`;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
      }
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setError('No se pudo generar la ficha. Intenta de nuevo.');
    } finally {
      setDescargandoFicha(null);
    }
  }

  async function manejarImprimirDocumento(archivoId) {
    try {
      const respuesta = await api.get(`/archivos/${archivoId}/visualizar`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(respuesta.data);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setError('No se pudo abrir el documento para imprimir.');
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
          <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <FotoVoluntario voluntarioId={id} tieneFoto={!!voluntario.fotografia_url} refrescarKey={voluntario.fotografia_url} />
              {tienePermiso('voluntarios.editar') && (
                <label style={styles.botonCambiarFoto} title="Cambiar fotografía">
                  {subiendoFoto ? '…' : '✎'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    style={{ display: 'none' }}
                    disabled={subiendoFoto}
                    onChange={(e) => e.target.files[0] && manejarSubirFoto(e.target.files[0])}
                  />
                </label>
              )}
            </div>
            <div>
              <h1 style={{ fontSize: 26 }}>
                {voluntario.nombre} {voluntario.apellido_paterno} {voluntario.apellido_materno}
              </h1>
              <p style={{ color: 'var(--sg-ink-soft)', fontSize: 14 }}>
                Folio {voluntario.numero_voluntario} · {voluntario.es_menor_edad ? 'Menor de edad' : 'Mayor de edad'}
                {voluntario.tutor && ` · Tutor: ${voluntario.tutor.nombre}`}
              </p>
              <p style={{ color: 'var(--sg-ink-soft)', fontSize: 12.5, marginTop: 6 }}>
                Ingreso: {voluntario.fecha_ingreso ? new Date(voluntario.fecha_ingreso).toLocaleDateString('es-MX') : '—'}
                {' · '}
                Baja: {voluntario.fecha_baja ? new Date(voluntario.fecha_baja).toLocaleDateString('es-MX') : 'Activo'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            {expediente && <BadgeSemaforo estado={expediente.estado} porcentaje={expediente.porcentaje_avance} />}
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={styles.botonSubir} onClick={() => manejarFicha('pdf')} disabled={!!descargandoFicha}>
                {descargandoFicha === 'pdf' ? 'Generando…' : '⬇ Ficha PDF'}
              </button>
              <button style={styles.botonSubir} onClick={() => manejarFicha('xlsx')} disabled={!!descargandoFicha}>
                {descargandoFicha === 'xlsx' ? 'Generando…' : '⬇ Excel'}
              </button>
              <button style={styles.botonSubir} onClick={() => manejarFicha('imprimir')} disabled={!!descargandoFicha}>
                {descargandoFicha === 'imprimir' ? 'Abriendo…' : '🖶 Imprimir'}
              </button>
            </div>
          </div>
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
                {TIPOS_CON_PLANTILLA.includes(doc.tipo_clave) && (
                  <button
                    style={styles.botonSubir}
                    onClick={() => manejarGenerarPlantilla(doc.id)}
                    disabled={generandoId === doc.id}
                  >
                    {generandoId === doc.id ? 'Generando…' : 'Generar'}
                  </button>
                )}
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
                <button
                  style={styles.botonSubir}
                  onClick={() => setDocumentoAEscanear({ id: doc.id, tipoClave: doc.tipo_clave })}
                  disabled={subiendoId === doc.id}
                  title="Tomar foto y recortar/mejorar automáticamente"
                >
                  📷 Escanear
                </button>
                {TIPOS_CON_PLANTILLA.includes(doc.tipo_clave) && doc.total_versiones > 0 && (
                  <button style={styles.botonSubir} onClick={() => setDocumentoAFirmar(doc.id)}>Firmar</button>
                )}
                {doc.ultimo_archivo_id && (
                  <details style={styles.historialArchivos}>
                    <summary style={styles.botonSubir}>Archivos ({doc.archivos?.length || doc.total_versiones})</summary>
                    <div style={styles.listaArchivos}>
                      {(doc.archivos || [{ id: doc.ultimo_archivo_id, version: doc.total_versiones }]).map((archivo) => (
                        <div key={archivo.id} style={styles.filaArchivo}>
                          <span>Versión {archivo.version}{archivo.nombre_original ? ` · ${archivo.nombre_original}` : ''}</span>
                          <button type="button" style={styles.botonArchivo} onClick={() => manejarImprimirDocumento(archivo.id)}>Imprimir</button>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {doc.estado === 'cargado' && tienePermiso('expedientes.aprobar') && (
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
                    <a href={credencial.url_verificacion} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: 12, marginTop: 8 }}>Abrir verificación pública</a>
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

      {documentoAFirmar && (
        <PadFirma
          nombreSugerido={voluntario.es_menor_edad ? (voluntario.tutor?.nombre || '') : `${voluntario.nombre} ${voluntario.apellido_paterno || ''}`.trim()}
          onFirmar={manejarConfirmarFirma}
          onCancelar={() => setDocumentoAFirmar(null)}
        />
      )}

      {documentoAEscanear && (
        <EscanerDocumento
          ofrecerLecturaCurp={['curp', 'ine', 'ine_tutor'].includes(documentoAEscanear.tipoClave)}
          onConfirmar={manejarEscaneoConfirmado}
          onCancelar={() => setDocumentoAEscanear(null)}
        />
      )}
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
  accionesDocumento: { display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' },
  historialArchivos: { position: 'relative' },
  listaArchivos: { position: 'absolute', zIndex: 2, right: 0, top: 'calc(100% + 5px)', minWidth: 260, padding: 8, background: 'var(--sg-surface)', border: '1px solid var(--sg-border)', borderRadius: 8, boxShadow: 'var(--sg-shadow)' },
  filaArchivo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '7px 4px', fontSize: 11.5, borderBottom: '1px solid var(--sg-border)' },
  botonArchivo: { border: 0, background: 'transparent', color: 'var(--sg-primary)', fontWeight: 700, cursor: 'pointer', fontSize: 11.5 },
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
  botonCambiarFoto: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: '50%',
    background: 'var(--sg-primary)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    cursor: 'pointer',
    border: '2px solid var(--sg-surface)',
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
