import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);
  const token = new URLSearchParams(window.location.search).get('token');

  async function manejarSubmit(evento) {
    evento.preventDefault();
    setError('');
    if (!token) {
      setError('El enlace de recuperación no es válido.');
      return;
    }
    if (nuevaPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (nuevaPassword !== confirmacion) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setCargando(true);
    try {
      const { data } = await api.post('/auth/reset-password', {
        token,
        nueva_password: nuevaPassword,
      });
      setMensaje(data.mensaje);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo actualizar la contraseña.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={styles.pagina}>
      <form onSubmit={manejarSubmit} style={styles.formulario}>
        <h1 style={styles.titulo}>Nueva contraseña</h1>
        <p style={styles.descripcion}>Crea una contraseña de al menos 8 caracteres para tu cuenta SIGEVAC.</p>
        {mensaje ? (
          <>
            <div style={styles.exito}>{mensaje}</div>
            <button type="button" className="sg-button-primary" onClick={() => navigate('/login')}>
              Ir a iniciar sesión
            </button>
          </>
        ) : (
          <>
            <label style={styles.etiqueta}>
              Nueva contraseña
              <input
                type="password"
                className="sg-input"
                value={nuevaPassword}
                onChange={(evento) => setNuevaPassword(evento.target.value)}
                minLength={8}
                required
                autoFocus
              />
            </label>
            <label style={styles.etiqueta}>
              Confirmar contraseña
              <input
                type="password"
                className="sg-input"
                value={confirmacion}
                onChange={(evento) => setConfirmacion(evento.target.value)}
                minLength={8}
                required
              />
            </label>
            {error && <div style={styles.error}>{error}</div>}
            <button type="submit" className="sg-button-primary" disabled={cargando}>
              {cargando ? 'Actualizando…' : 'Actualizar contraseña'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}

const styles = {
  pagina: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    background: 'var(--sg-bg)',
  },
  formulario: {
    width: '100%',
    maxWidth: 420,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: 32,
    background: 'var(--sg-surface)',
    border: '1px solid var(--sg-border)',
    borderRadius: 'var(--sg-radius)',
    boxShadow: 'var(--sg-shadow)',
  },
  titulo: { fontSize: 28 },
  descripcion: { color: 'var(--sg-ink-soft)', fontSize: 14, lineHeight: 1.5, margin: 0 },
  etiqueta: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13.5, fontWeight: 600, color: 'var(--sg-ink-soft)' },
  error: { background: 'rgba(196, 69, 61, 0.1)', color: 'var(--sg-danger)', padding: '10px 12px', borderRadius: 8, fontSize: 13.5 },
  exito: { background: 'rgba(47, 158, 110, 0.12)', color: 'var(--sg-success)', padding: '10px 12px', borderRadius: 8, fontSize: 13.5, lineHeight: 1.5 },
};
