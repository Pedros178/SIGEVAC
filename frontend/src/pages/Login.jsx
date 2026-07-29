import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function manejarSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await login(correo, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo iniciar sesión. Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={styles.pagina}>
      <div style={styles.panelIzquierdo}>
        <div style={styles.marca}>
          <div style={styles.qrDecorativo} aria-hidden="true">
            {Array.from({ length: 49 }).map((_, i) => (
              <span key={i} style={{ background: pseudoRandomOn(i) ? 'var(--sg-accent)' : 'transparent' }} />
            ))}
          </div>
          <h1 style={styles.tituloMarca}>SIGEVAC</h1>
          <p style={styles.subtituloMarca}>
            Sistema Integral para la Gestión de Expedientes y Voluntariado
          </p>
          <p style={styles.asociacion}>Asociación Juvenil "Sueños de Comedia", A.C.</p>
        </div>
      </div>

      <div style={styles.panelDerecho}>
        <form onSubmit={manejarSubmit} style={styles.formulario}>
          <h2 style={styles.tituloForm}>Inicia sesión</h2>
          <p style={styles.descripcionForm}>Accede con tu cuenta institucional para administrar voluntarios y expedientes.</p>

          <label style={styles.etiqueta}>
            Correo electrónico
            <input
              type="email"
              className="sg-input"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="tu.correo@suenosdecomedia.org"
              required
              autoFocus
            />
          </label>

          <label style={styles.etiqueta}>
            Contraseña
            <input
              type="password"
              className="sg-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" className="sg-button-primary" disabled={cargando} style={{ marginTop: 8 }}>
            {cargando ? 'Verificando…' : 'Entrar'}
          </button>

          <a href="#" style={styles.enlaceOlvido} onClick={(e) => e.preventDefault()}>
            ¿Olvidaste tu contraseña?
          </a>
        </form>
      </div>
    </div>
  );
}

function pseudoRandomOn(i) {
  // Patrón determinístico para el mosaico decorativo (simula un QR sin serlo).
  return (i * 7 + 3) % 5 === 0 || (i * 3) % 11 === 0;
}

const styles = {
  pagina: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    minHeight: '100vh',
  },
  panelIzquierdo: {
    background: 'linear-gradient(160deg, var(--sg-primary) 0%, var(--sg-primary-dark) 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  marca: {
    color: 'white',
    maxWidth: 380,
    textAlign: 'center',
  },
  qrDecorativo: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 10px)',
    gridTemplateRows: 'repeat(7, 10px)',
    gap: 3,
    justifyContent: 'center',
    margin: '0 auto 28px',
  },
  tituloMarca: {
    fontSize: 42,
    letterSpacing: '0.02em',
    marginBottom: 10,
  },
  subtituloMarca: {
    fontFamily: 'var(--sg-font-body)',
    fontSize: 15,
    lineHeight: 1.5,
    opacity: 0.88,
    marginBottom: 18,
  },
  asociacion: {
    fontFamily: 'var(--sg-font-body)',
    fontSize: 13,
    fontWeight: 600,
    opacity: 0.75,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  panelDerecho: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  formulario: {
    width: '100%',
    maxWidth: 360,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  tituloForm: {
    fontSize: 26,
  },
  descripcionForm: {
    fontFamily: 'var(--sg-font-body)',
    color: 'var(--sg-ink-soft)',
    fontSize: 14.5,
    lineHeight: 1.5,
    marginTop: -6,
  },
  etiqueta: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 13.5,
    fontWeight: 600,
    color: 'var(--sg-ink-soft)',
  },
  error: {
    background: 'rgba(196, 69, 61, 0.1)',
    color: 'var(--sg-danger)',
    padding: '10px 12px',
    borderRadius: 8,
    fontSize: 13.5,
  },
  enlaceOlvido: {
    fontSize: 13.5,
    textAlign: 'center',
    color: 'var(--sg-ink-soft)',
    textDecoration: 'none',
  },
};
