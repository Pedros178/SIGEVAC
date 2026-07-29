import React, { createContext, useContext, useEffect, useState } from 'react';
import api, { guardarTokens, limpiarTokens } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('sigevac_access_token');
    if (!token) {
      setCargando(false);
      return;
    }
    api
      .get('/auth/me')
      .then(({ data }) => setUsuario(data.usuario))
      .catch(() => limpiarTokens())
      .finally(() => setCargando(false));
  }, []);

  async function login(correo, password) {
    const { data } = await api.post('/auth/login', { correo, password });
    guardarTokens(data);
    setUsuario(data.usuario);
    return data.usuario;
  }

  async function logout() {
    const refreshToken = localStorage.getItem('sigevac_refresh_token');
    try {
      await api.post('/auth/logout', { refresh_token: refreshToken });
    } catch {
      // Si falla la petición, igual limpiamos la sesión local.
    }
    limpiarTokens();
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
