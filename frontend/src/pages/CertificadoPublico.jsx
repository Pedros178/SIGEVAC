import { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export default function CertificadoPublico() {
  const [certificado, setCertificado] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const codigo = new URLSearchParams(window.location.search).get('codigo');

  useEffect(() => {
    if (!codigo) { setError('No se proporcionó un código de verificación.'); setCargando(false); return; }
    axios.get(`${API_URL}/publico/certificados/${encodeURIComponent(codigo)}`)
      .then(({ data }) => setCertificado(data.certificado))
      .catch((err) => setError(err.response?.data?.error || 'El código no es válido.'))
      .finally(() => setCargando(false));
  }, [codigo]);

  return (
    <main style={styles.pagina}>
      <section style={styles.panel}>
        <div style={styles.marca}>SIGEVAC <span>VERIFICACIÓN PÚBLICA</span></div>
        {cargando && <p style={styles.mensaje}>Consultando certificado...</p>}
        {!cargando && error && <div style={styles.error}><strong>No se pudo verificar</strong><p>{error}</p></div>}
        {!cargando && certificado && (
          <div>
            <div style={styles.sello}>✓</div>
            <p style={styles.etiqueta}>CERTIFICADO AUTÉNTICO</p>
            <h1 style={styles.nombre}>{certificado.nombre} {certificado.apellido_paterno || ''} {certificado.apellido_materno || ''}</h1>
            <p style={styles.folio}>Folio {certificado.numero_voluntario}</p>
            <div style={styles.total}>{certificado.total_horas}<small> horas acumuladas</small></div>
            <p style={styles.asociacion}>{certificado.asociacion_nombre}</p>
            <div style={styles.detalle}>{certificado.detalle.length ? certificado.detalle.map((fila) => <div key={`${fila.periodo}-${fila.tipo}`}><span>{fila.periodo} · {fila.tipo}</span><strong>{fila.horas} h</strong></div>) : <span>No hay horas registradas todavía.</span>}</div>
            <a href={`${API_URL}/publico/certificados/${encodeURIComponent(codigo)}.pdf`} target="_blank" rel="noreferrer" style={styles.boton}>Descargar certificado PDF</a>
          </div>
        )}
      </section>
    </main>
  );
}

const styles = {
  pagina: { minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: '8vh 20px', background: 'linear-gradient(135deg, #E8F5F8 0%, #F8FCFC 55%, #FFF8E8 100%)', color: 'var(--sg-ink)' },
  panel: { width: '100%', maxWidth: 560, background: 'white', border: '1px solid var(--sg-border)', borderRadius: 14, boxShadow: 'var(--sg-shadow)', padding: '30px 34px', textAlign: 'center' },
  marca: { color: 'var(--sg-secondary)', fontWeight: 800, letterSpacing: 1.5, fontSize: 13, marginBottom: 42 },
  marcaSpan: {}, mensaje: { color: 'var(--sg-ink-soft)' },
  sello: { width: 54, height: 54, lineHeight: '54px', margin: '0 auto 14px', borderRadius: '50%', background: 'var(--sg-success)', color: 'white', fontSize: 30 },
  etiqueta: { color: 'var(--sg-success)', fontSize: 11, fontWeight: 800, letterSpacing: 1.5 },
  nombre: { fontSize: 30, margin: '12px 0 5px' }, folio: { color: 'var(--sg-ink-soft)', fontSize: 13 }, total: { fontFamily: 'var(--sg-font-display)', color: 'var(--sg-secondary)', fontSize: 48, margin: '30px 0 2px' }, totalSmall: {}, asociacion: { color: 'var(--sg-ink-soft)', marginTop: 0 },
  detalle: { borderTop: '1px solid var(--sg-border)', borderBottom: '1px solid var(--sg-border)', margin: '24px 0', padding: '12px 0', textAlign: 'left', fontSize: 13 },
  detalleFila: {}, error: { color: 'var(--sg-danger)', padding: 20 }, boton: { display: 'inline-block', background: 'var(--sg-secondary)', color: 'white', borderRadius: 7, padding: '11px 16px', textDecoration: 'none', fontWeight: 700, fontSize: 13 },
};
