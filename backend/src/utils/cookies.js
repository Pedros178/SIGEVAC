/**
 * Manejo centralizado de la cookie del refresh token.
 *
 * ANTES (revisión de seguridad): el refresh token (vigente 7 días) viajaba
 * en el cuerpo JSON de /auth/login y el frontend lo guardaba en
 * localStorage junto al access token. Cualquier XSS en el frontend —una
 * dependencia de npm comprometida, una librería de terceros con un bug—
 * podría robar ese token y mantener una sesión válida durante toda su
 * vigencia sin que el usuario lo note.
 *
 * AHORA: el refresh token se entrega únicamente como cookie `httpOnly`
 * (inaccesible desde JavaScript en el navegador, incluso con XSS) y nunca
 * aparece en el cuerpo de la respuesta. El access token de corta duración
 * (15 min) se sigue devolviendo en el JSON, como antes, para que el
 * frontend lo guarde en memoria (no en localStorage — ver services/api.js).
 *
 * `sameSite: 'none'` es necesario porque en el despliegue de referencia
 * (ver DEPLOY.md) el backend y el frontend viven en subdominios distintos
 * de onrender.com, que el navegador trata como sitios distintos: sin
 * `SameSite=None; Secure` la cookie no viajaría entre ellos. En desarrollo
 * local (mismo "site", puertos distintos) se usa `lax` + `secure: false`
 * porque `Secure` exige HTTPS real.
 */

const NOMBRE_COOKIE_REFRESH = 'sigevac_refresh';
const REFRESH_DIAS = 7;

function opcionesCookie() {
  const esProduccion = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: esProduccion,
    sameSite: esProduccion ? 'none' : 'lax',
    path: '/api/auth',
    maxAge: REFRESH_DIAS * 24 * 60 * 60 * 1000,
  };
}

function establecerCookieRefresh(res, refreshToken) {
  res.cookie(NOMBRE_COOKIE_REFRESH, refreshToken, opcionesCookie());
}

function limpiarCookieRefresh(res) {
  const { maxAge: _maxAge, ...opcionesLimpieza } = opcionesCookie();
  res.clearCookie(NOMBRE_COOKIE_REFRESH, opcionesLimpieza);
}

function obtenerRefreshDeCookie(req) {
  return req.cookies?.[NOMBRE_COOKIE_REFRESH] || null;
}

module.exports = {
  NOMBRE_COOKIE_REFRESH,
  REFRESH_DIAS,
  establecerCookieRefresh,
  limpiarCookieRefresh,
  obtenerRefreshDeCookie,
};
