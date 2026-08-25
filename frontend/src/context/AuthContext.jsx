import React, { createContext, useContext, useEffect, useState } from 'react';
import api, { guardarTokens, limpiarTokens, getRefreshToken } from '../services/api';

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
    const refreshToken = getRefreshToken();
    try {
      await api.post('/auth/logout', { refresh_token: refreshToken });
    } catch {
      // Si falla la petición, igual limpiamos la sesión local.
    }
    limpiarTokens();
    setUsuario(null);
  }

  /**
   * Multi-asociación (diferenciador): cambia la asociación activa de la
   * sesión sin volver a iniciar sesión. Actualiza los tokens guardados
   * y el usuario en memoria (incluidos sus permisos, que pueden variar
   * si la asociación tiene distinta configuración de roles).
   */
  async function cambiarAsociacion(asociacionId) {
    const { data } = await api.post('/auth/asociacion-activa', {
      asociacion_id: asociacionId,
      refresh_token: getRefreshToken(),
    });
    guardarTokens(data);
    setUsuario(data.usuario);
    return data.usuario;
  }

  // --- Helpers de autorización para la UI ---
  // Se basan en `usuario.permisos`, que el backend calcula a partir de los
  // roles reales del usuario (misma fuente de verdad que valida cada
  // endpoint con requierePermiso/requiereRol), para que lo que se muestra
  // en pantalla sea consistente con lo que el backend realmente autoriza.
  function tienePermiso(clave) {
    return !!usuario?.permisos?.includes(clave);
  }

  function tieneAlgunPermiso(claves = []) {
    return claves.some((clave) => tienePermiso(clave));
  }

  function tieneRol(...nombresRol) {
    return !!usuario?.roles?.some((r) => nombresRol.includes(r.nombre));
  }

  return (
    <AuthContext.Provider
      value={{ usuario, cargando, login, logout, cambiarAsociacion, tienePermiso, tieneAlgunPermiso, tieneRol }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
