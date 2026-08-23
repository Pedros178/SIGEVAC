import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function RutaProtegida({ children }) {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--sg-ink-soft)' }}>
        Cargando SIGEVAC…
      </div>
    );
  }

  if (!usuario) return <Navigate to="/login" replace />;

  return children;
}
