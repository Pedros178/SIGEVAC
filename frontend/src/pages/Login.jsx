import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { guardarAccessToken } from '../services/api';

export default function Login() {
  const location = useLocation();
  const destinoTrasLogin = location.state?.from || '/dashboard';
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [desafio2FA, setDesafio2FA] = useState('');
  const [codigo2FA, setCodigo2FA] = useState('');
  const [error, setError] = useState('');
  const [modoRecuperacion, setModoRecuperacion] = useState(false);
  const [recuperacionEnviada, setRecuperacionEnviada] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function manejarSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      if (modoRecuperacion) {
        await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ correo }),
        }).then(async (respuesta) => {
          const data = await respuesta.json();
          if (!respuesta.ok) throw new Error(data.error || 'No se pudo solicitar la recuperación.');
        });
        setRecuperacionEnviada(true);
        return;
      }
      if (desafio2FA) {
        const respuesta = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/auth/login-2fa`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ desafio_2fa: desafio2FA, codigo: codigo2FA }),
        });
        const data = await respuesta.json();
        if (!respuesta.ok) throw new Error(data.error || 'No se pudo validar el código 2FA.');
        await loginCompletado(data);
        return;
      }
      const respuesta = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ correo, password }),
      });
      const data = await respuesta.json();
      if (!respuesta.ok) throw new Error(data.error || 'No se pudo iniciar sesión.');
      if (data.requiere_2fa) {
        setDesafio2FA(data.desafio_2fa);
        return;
      }
      await loginCompletado(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudo iniciar sesión. Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  async function loginCompletado(data) {
    guardarAccessToken(data.access_token);
    window.location.assign(destinoTrasLogin);
  }

  return (
    <div className="sg-login-page" style={styles.pagina}>
      <div style={styles.panelIzquierdo}>
        <div style={styles.marca}>
          <img src="/logo-sigevac.png" alt="Sueños de Comedia A.C." style={styles.logo} />
          <h1 style={styles.tituloMarca}>SIGEVAC</h1>
          <p style={styles.subtituloMarca}>
            Sistema Integral para la Gestión de Expedientes y Voluntariado
          </p>
          <p style={styles.asociacion}>Asociación Juvenil "Sueños de Comedia", A.C.</p>
        </div>
      </div>

      <div style={styles.panelDerecho}>
        <form onSubmit={manejarSubmit} style={styles.formulario}>
          <Link to="/" style={styles.enlaceRegreso}>
            <span aria-hidden="true">←</span> Volver al sitio
          </Link>
          <h2 style={styles.tituloForm}>{modoRecuperacion ? 'Recupera tu contraseña' : 'Inicia sesión'}</h2>
          <p style={styles.descripcionForm}>
            {desafio2FA
              ? 'Escribe el código de seis dígitos de tu aplicación de autenticación.'
              : modoRecuperacion
              ? 'Te enviaremos un enlace para crear una contraseña nueva.'
              : 'Accede con tu cuenta institucional para administrar voluntarios y expedientes.'}
          </p>

          {desafio2FA ? (
            <label style={styles.etiqueta}>
              Código de autenticación
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                className="sg-input"
                value={codigo2FA}
                onChange={(e) => setCodigo2FA(e.target.value.replace(/\D/g, ''))}
                required
                autoFocus
              />
            </label>
          ) : recuperacionEnviada ? (
            <div style={styles.mensajeExito}>
              Si el correo está registrado, recibirás instrucciones para recuperar tu contraseña.
            </div>
          ) : (
            <>
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

              {!modoRecuperacion && (
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
              )}
            </>
          )}

          {error && !recuperacionEnviada && <div style={styles.error}>{error}</div>}

          {!recuperacionEnviada && (
            <button type="submit" className="sg-button-primary" disabled={cargando} style={{ marginTop: 8 }}>
              {cargando ? 'Verificando…' : desafio2FA ? 'Validar código' : modoRecuperacion ? 'Enviar instrucciones' : 'Entrar'}
            </button>
          )}

          <button
            type="button"
            style={styles.enlaceOlvido}
            onClick={() => {
              setDesafio2FA('');
              setCodigo2FA('');
              setModoRecuperacion((actual) => !actual);
              setRecuperacionEnviada(false);
              setError('');
            }}
          >
            {modoRecuperacion ? 'Volver a iniciar sesión' : '¿Olvidaste tu contraseña?'}
          </button>

          {!modoRecuperacion && !desafio2FA && (
            <a href="/solicitud" style={{ ...styles.enlaceOlvido, textDecoration: 'none' }}>
              ¿Quieres ser voluntario? Solicita tu registro aquí
            </a>
          )}
        </form>
      </div>
    </div>
  );
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
  logo: {
    width: 150,
    height: 'auto',
    margin: '0 auto 20px',
    display: 'block',
    filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.25))',
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
  enlaceRegreso: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13.5,
    fontWeight: 600,
    color: 'var(--sg-ink-soft)',
    textDecoration: 'none',
    marginBottom: 4,
    width: 'fit-content',
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
  mensajeExito: {
    background: 'rgba(47, 158, 110, 0.12)',
    color: 'var(--sg-success)',
    padding: '10px 12px',
    borderRadius: 8,
    fontSize: 13.5,
    lineHeight: 1.5,
  },
  enlaceOlvido: {
    border: 'none',
    background: 'transparent',
    fontSize: 13.5,
    textAlign: 'center',
    color: 'var(--sg-ink-soft)',
    textDecoration: 'underline',
  },
};
