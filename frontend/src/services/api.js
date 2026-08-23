import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const api = axios.create({ baseURL: API_URL });

function getAccessToken() {
  return localStorage.getItem('sigevac_access_token');
}

export function getRefreshToken() {
  return localStorage.getItem('sigevac_refresh_token');
}

export function guardarTokens({ access_token, refresh_token }) {
  if (access_token) localStorage.setItem('sigevac_access_token', access_token);
  if (refresh_token) localStorage.setItem('sigevac_refresh_token', refresh_token);
}

export function limpiarTokens() {
  localStorage.removeItem('sigevac_access_token');
  localStorage.removeItem('sigevac_refresh_token');
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Si el access token expira, intenta refrescarlo una vez y reintenta la petición original.
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
            .post(`${API_URL}/auth/refresh`, { refresh_token: getRefreshToken() })
            .finally(() => { refrescando = null; });
        }
        const { data } = await refrescando;
        guardarTokens({ access_token: data.access_token });
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch (refreshError) {
        limpiarTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
