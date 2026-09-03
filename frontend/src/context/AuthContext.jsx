import { createContext, useContext, useEffect, useState } from 'react';
import api, { guardarAccessToken, limpiarAccessToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  // El access token vive solo en memoria (ver services/api.js), así que se
  // pierde en cada recarga de página. Para restaurar la sesión sin pedirle
  // credenciales otra vez al usuario, intentamos un refresh "silencioso":
  // si existe una cookie httpOnly de refresh todavía válida, el backend
  // nos devuelve un access token nuevo; si no, simplemente no hay sesión.
  useEffect(() => {
    api
      .post('/auth/refresh', {})
      .then(async ({ data }) => {
        guardarAccessToken(data.access_token);
        const { data: dataMe } = await api.get('/auth/me');
        setUsuario(dataMe.usuario);
      })
      .catch(() => limpiarAccessToken())
      .finally(() => setCargando(false));
  }, []);

  async function login(correo, password) {
    const { data } = await api.post('/auth/login', { correo, password });
    guardarAccessToken(data.access_token);
    setUsuario(data.usuario);
    return data.usuario;
  }

  async function logout() {
    try {
      await api.post('/auth/logout', {});
    } catch {
      // Si falla la petición, igual limpiamos la sesión local.
    }
    limpiarAccessToken();
    setUsuario(null);
  }

  /**
   * Multi-asociación (diferenciador): cambia la asociación activa de la
   * sesión sin volver a iniciar sesión. El backend emite un access token
   * nuevo (devuelto aquí) y rota la cookie httpOnly del refresh token;
   * el frontend solo necesita actualizar el access token en memoria y el
   * usuario (incluidos sus permisos, que pueden variar según la
   * asociación).
   */
  async function cambiarAsociacion(asociacionId) {
    const { data } = await api.post('/auth/asociacion-activa', { asociacion_id: asociacionId });
    guardarAccessToken(data.access_token);
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
