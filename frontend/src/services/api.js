import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const api = axios.create({ baseURL: API_URL, withCredentials: true });

/**
 * Revisión de seguridad: el access token ya NO se guarda en localStorage.
 * localStorage es legible por cualquier script que corra en la página —
 * incluido uno inyectado por XSS (una dependencia de npm comprometida,
 * una librería de terceros vulnerable) — así que un token ahí es un
 * token robable. Ahora vive solo en esta variable de módulo, en memoria:
 * desaparece si se recarga la página o se cierra la pestaña, que es
 * exactamente el comportamiento que queremos.
 *
 * El refresh token (vigente 7 días, mucho más sensible) nunca llega al
 * JavaScript del navegador: viaja como cookie httpOnly puesta por el
 * backend (ver backend/src/utils/cookies.js) y el navegador la adjunta
 * solo a peticiones hacia /api/auth/*.
 *
 * Como el access token vive en memoria, al recargar la página se pierde;
 * por eso AuthContext hace un refresh "silencioso" contra /auth/refresh
 * al montar la app (la cookie httpOnly viaja sola) para recuperar un
 * access token nuevo sin pedirle credenciales otra vez al usuario.
 */
let accessTokenEnMemoria = null;

export function getAccessToken() {
  return accessTokenEnMemoria;
}

export function guardarAccessToken(token) {
  accessTokenEnMemoria = token || null;
}

export function limpiarAccessToken() {
  accessTokenEnMemoria = null;
}

api.interceptors.request.use((config) => {
  if (accessTokenEnMemoria) config.headers.Authorization = `Bearer ${accessTokenEnMemoria}`;
  return config;
});

// Si el access token expira, intenta refrescarlo una vez (la cookie
// httpOnly viaja sola gracias a withCredentials) y reintenta la petición.
let refrescando = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const esTokenExpirado = error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED';

    if (esTokenExpirado && !original._retry) {
      original._retry = true;
      try {
        if (!refrescando) {
          refrescando = axios
            .post(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
            .finally(() => { refrescando = null; });
        }
        const { data } = await refrescando;
        guardarAccessToken(data.access_token);
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch (refreshError) {
        limpiarAccessToken();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
