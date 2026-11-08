import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import AvisoSimplificado from '../components/AvisoSimplificado.jsx';

/**
 * Formulario público para solicitar unirse como voluntario — no requiere
 * iniciar sesión. El backend (POST /api/solicitudes) ya lo soportaba desde
 * que se agregó el módulo de Solicitudes, pero no existía ninguna pantalla
 * para usarlo; solo el panel de revisión en Administración > Solicitudes.
 */
export default function SolicitudVoluntariado() {
  const [asociaciones, setAsociaciones] = useState(null);
  const [form, setForm] = useState({ asociacion_id: '', nombre: '', correo: '', telefono: '', mensaje: '', acepta_aviso_privacidad: false });
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/asociacion/publicas')
      .then(({ data }) => {
        setAsociaciones(data.asociaciones);
        if (data.asociaciones.length === 1) {
          setForm((f) => ({ ...f, asociacion_id: data.asociaciones[0].id }));
        }
      })
      .catch(() => setError('No se pudo cargar la lista de asociaciones. Intenta más tarde.'));
  }, []);

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await api.post('/solicitudes', form);
      setEnviado(true);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo enviar tu solicitud. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div style={estilos.pagina}>
        <div style={estilos.tarjeta}>
          <Link to="/" style={estilos.enlaceRegreso}><span aria-hidden="true">←</span> Volver al sitio</Link>
          <img src="/logo-sigevac.png" alt="" style={estilos.logo} />
          <h1 style={estilos.titulo}>¡Solicitud enviada!</h1>
          <p style={estilos.texto}>
            Gracias por tu interés en ser voluntario. Alguien del equipo revisará tu solicitud
            y se pondrá en contacto contigo por correo o teléfono.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={estilos.pagina}>
      <div style={estilos.tarjeta}>
        <Link to="/" style={estilos.enlaceRegreso}><span aria-hidden="true">←</span> Volver al sitio</Link>
        <img src="/logo-sigevac.png" alt="" style={estilos.logo} />
        <h1 style={estilos.titulo}>Quiero ser voluntario</h1>
        <p style={estilos.texto}>
          Completa este formulario y te contactaremos para continuar con tu registro.
        </p>

        {asociaciones === null ? (
          <p style={{ textAlign: 'center', color: 'var(--sg-ink-soft)' }}>Cargando…</p>
        ) : (
          <form onSubmit={enviar} style={estilos.formulario}>
            {asociaciones.length > 1 && (
              <label style={estilos.etiqueta}>
                Asociación
                <select
                  className="sg-input"
                  value={form.asociacion_id}
                  onChange={(e) => actualizar('asociacion_id', e.target.value)}
                  required
                >
                  <option value="" disabled>Elige una…</option>
                  {asociaciones.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </label>
            )}
            <label style={estilos.etiqueta}>
              Nombre completo
              <input className="sg-input" value={form.nombre} onChange={(e) => actualizar('nombre', e.target.value)} required />
            </label>
            <label style={estilos.etiqueta}>
              Correo electrónico
              <input type="email" className="sg-input" value={form.correo} onChange={(e) => actualizar('correo', e.target.value)} required />
            </label>
            <label style={estilos.etiqueta}>
              Teléfono (opcional)
              <input className="sg-input" value={form.telefono} onChange={(e) => actualizar('telefono', e.target.value)} />
            </label>
            <label style={estilos.etiqueta}>
              Cuéntanos un poco de ti (opcional)
              <textarea
                className="sg-input"
                rows={4}
                value={form.mensaje}
                onChange={(e) => actualizar('mensaje', e.target.value)}
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
            </label>

            <AvisoSimplificado asociacionId={form.asociacion_id} />

            <label style={{ ...estilos.etiqueta, flexDirection: 'row', alignItems: 'flex-start', gap: 8, fontWeight: 400 }}>
              <input
                type="checkbox"
                checked={form.acepta_aviso_privacidad}
                onChange={(e) => actualizar('acepta_aviso_privacidad', e.target.checked)}
                required
                style={{ marginTop: 3 }}
              />
              <span>
                He leído y acepto el{' '}
                <Link to={`/aviso-privacidad${form.asociacion_id ? `?asociacion=${form.asociacion_id}` : ''}`} target="_blank" rel="noopener noreferrer">aviso de privacidad integral</Link>.
              </span>
            </label>

            {error && <div style={estilos.error}>{error}</div>}

            <button type="submit" className="sg-button-primary" disabled={enviando || !form.asociacion_id || !form.acepta_aviso_privacidad}>
              {enviando ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const estilos = {
  pagina: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--sg-bg)', padding: 24,
  },
  tarjeta: {
    background: 'var(--sg-surface)', borderRadius: 16, padding: 36, width: '100%', maxWidth: 440,
    boxShadow: 'var(--sg-shadow)',
  },
  logo: { width: 90, display: 'block', margin: '0 auto 16px' },
  enlaceRegreso: {
    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600,
    color: 'var(--sg-ink-soft)', textDecoration: 'none', marginBottom: 16,
  },
  titulo: { fontSize: 24, textAlign: 'center', marginBottom: 6 },
  texto: { fontSize: 14, color: 'var(--sg-ink-soft)', textAlign: 'center', marginBottom: 22, lineHeight: 1.5 },
  formulario: { display: 'flex', flexDirection: 'column', gap: 14 },
  etiqueta: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13.5, fontWeight: 600, color: 'var(--sg-ink-soft)' },
  error: {
    background: 'rgba(196, 69, 61, 0.1)', color: 'var(--sg-danger)',
    padding: '10px 12px', borderRadius: 8, fontSize: 13,
  },
};
