const UsuarioModel = require('../models/usuarioModel');
const SesionModel = require('../models/sesionModel');
const TokenRecuperacionModel = require('../models/tokenRecuperacionModel');
const { hashPassword, compararPassword, generarTokenSeguro, hashSha256, validarFortalezaPassword } = require('../utils/password');
const { esUuid } = require('../utils/identificadores');
const { esCorreoValido } = require('../utils/validadores');
const { enviarCorreo } = require('../utils/email');
const bcrypt = require('bcryptjs');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const {
  generarAccessToken,
  generarRefreshToken,
  verificarRefreshToken,
  generarToken2FA,
  verificarToken2FA,
} = require('../utils/jwt');
const {
  REFRESH_DIAS,
  establecerCookieRefresh,
  limpiarCookieRefresh,
  obtenerRefreshDeCookie,
} = require('../utils/cookies');

const MAX_INTENTOS = parseInt(process.env.MAX_INTENTOS_FALLIDOS || '5', 10);
const MINUTOS_BLOQUEO = parseInt(process.env.BLOQUEO_MINUTOS || '15', 10);
const MAX_LONGITUD_PASSWORD = 128;
const GRACIA_ROTACION_MS = 10_000; // ventana en la que un refresh recién rotado aún se tolera (pestañas simultáneas)
const PASO_TOTP_SEGUNDOS = 30;

// Hash ficticio con el mismo costo que uno real: se compara cuando el correo
// no existe para que login tarde lo mismo exista o no la cuenta (evita
// enumerar usuarios midiendo tiempos de respuesta).
const HASH_FICTICIO = bcrypt.hashSync('contraseña-ficticia-no-valida', 12);
const MENSAJE_CREDENCIALES = 'Credenciales inválidas o cuenta bloqueada temporalmente.';

/**
 * Verifica un código TOTP con protección anti-replay: devuelve true solo si
 * el código es válido Y su ventana de 30 s no se había usado antes (un código
 * espiado o interceptado no se puede reutilizar). Los fallos suman al
 * contador de intentos de la cuenta, con el mismo bloqueo que el login.
 */
async function verificarCodigoTotp(usuario, codigo, { consumir = true } = {}) {
  if (!usuario?.two_factor_secret || !/^\d{6}$/.test(String(codigo || ''))) return false;
  const delta = authenticator.checkDelta(String(codigo), usuario.two_factor_secret);
  if (delta === null || delta === undefined) return false;
  if (!consumir) return true;
  const paso = Math.floor(Date.now() / 1000 / PASO_TOTP_SEGUNDOS) + delta;
  return UsuarioModel.consumirPasoTotp(usuario.id, paso);
}

function cuentaBloqueada(usuario) {
  return usuario?.bloqueado_hasta && new Date(usuario.bloqueado_hasta) > new Date();
}

/**
 * Arma el objeto "usuario" que viaja en las respuestas de auth y en el
 * payload del JWT. Incluye:
 *  - roles y permisos (para que el frontend pueda mostrar/ocultar UI
 *    de forma consistente con lo que el backend realmente autoriza)
 *  - asociaciones: todas las asociaciones a las que pertenece (multi-asociación)
 *  - asociacion_id: la asociación ACTIVA de esta sesión (una de las anteriores)
 *
 * `asociacionActivaId`, si se indica, fuerza cuál usar como activa (se
 * valida antes en el llamador); si no se indica, se usa la predeterminada
 * del usuario.
 */
async function registrarUsuarioBase(usuario, asociacionActivaId = null) {
  const [roles, permisos, asociaciones] = await Promise.all([
    UsuarioModel.obtenerRoles(usuario.id),
    UsuarioModel.obtenerPermisos(usuario.id),
    UsuarioModel.obtenerAsociaciones(usuario.id),
  ]);

  let asociacionActiva = asociacionActivaId
    ? asociaciones.find((a) => a.id === asociacionActivaId)
    : asociaciones.find((a) => a.es_predeterminada) || asociaciones[0];

  if (!asociacionActiva) {
    // Respaldo para datos previos a multi-asociación (sin filas en usuario_asociaciones)
    const predeterminada = await UsuarioModel.obtenerAsociacionPredeterminada(usuario.id);
    asociacionActiva = predeterminada ? { id: predeterminada.id, nombre: predeterminada.nombre } : null;
  }

  return {
    id: usuario.id,
    nombre: usuario.nombre,
    correo: usuario.correo,
    asociacion_id: asociacionActiva?.id || null,
    asociacion_nombre: asociacionActiva?.nombre || null,
    asociaciones,
    roles,
    permisos,
    two_factor_activo: !!usuario.two_factor_activo,
  };
}

/**
 * Emite una sesión nueva: guarda el refresh token (hasheado) en BD, lo
 * entrega como cookie httpOnly en `res`, y devuelve solo el access token
 * en el cuerpo de la respuesta — el refresh token nunca toca el JSON ni
 * queda expuesto a JavaScript en el navegador.
 */
async function iniciarSesionRefresh(usuarioConRoles, req, res) {
  const refreshToken = generarRefreshToken(usuarioConRoles);
  await SesionModel.crear({
    usuarioId: usuarioConRoles.id,
    refreshTokenHash: hashSha256(refreshToken),
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
    expiraEn: new Date(Date.now() + REFRESH_DIAS * 24 * 60 * 60 * 1000),
  });
  establecerCookieRefresh(res, refreshToken);
}

async function emitirSesion(usuario, req, res) {
  await UsuarioModel.registrarLoginExitoso(usuario.id);
  const usuarioConRoles = await registrarUsuarioBase(usuario);
  const accessToken = generarAccessToken(usuarioConRoles);
  await iniciarSesionRefresh(usuarioConRoles, req, res);
  return { usuario: usuarioConRoles, access_token: accessToken };
}

const AuthController = {
  /**
   * POST /api/auth/login
   */
  async login(req, res, next) {
    try {
      const { correo, password } = req.body || {};
      if (typeof correo !== 'string' || typeof password !== 'string' || !correo || !password) {
        return res.status(400).json({ error: 'Correo y contraseña son obligatorios.' });
      }
      if (password.length > MAX_LONGITUD_PASSWORD || correo.length > 254) {
        return res.status(401).json({ error: MENSAJE_CREDENCIALES });
      }

      const usuario = await UsuarioModel.buscarPorCorreo(correo.toLowerCase().trim());
      // Siempre se hace UNA comparación bcrypt, exista o no la cuenta, esté o
      // no bloqueada: mismo tiempo y misma respuesta en todos los casos.
      const passwordValido = await compararPassword(password, usuario?.password_hash || HASH_FICTICIO);

      if (!usuario || !passwordValido) {
        if (usuario && !cuentaBloqueada(usuario)) {
          await UsuarioModel.registrarIntentoFallido(usuario.id, MAX_INTENTOS, MINUTOS_BLOQUEO);
        }
        return res.status(401).json({ error: MENSAJE_CREDENCIALES });
      }
      // Con la contraseña correcta: una cuenta bloqueada no revela nada nuevo
      if (cuentaBloqueada(usuario)) {
        return res.status(401).json({ error: MENSAJE_CREDENCIALES });
      }
      // El estado "desactivada" solo se revela a quien demostró conocer la contraseña
      if (!usuario.activo) {
        return res.status(403).json({ error: 'Tu cuenta está desactivada. Contacta al administrador.' });
      }

      if (usuario.two_factor_activo) {
        return res.json({ requiere_2fa: true, desafio_2fa: generarToken2FA(usuario.id) });
      }

      return res.json(await emitirSesion(usuario, req, res));
    } catch (err) {
      return next(err);
    }
  },

  async completarLogin2FA(req, res, next) {
    try {
      const { desafio_2fa: desafio, codigo } = req.body || {};
      if (typeof desafio !== 'string' || !desafio || !/^\d{6}$/.test(String(codigo))) {
        return res.status(400).json({ error: 'Desafío y código 2FA de seis dígitos son obligatorios.' });
      }
      const payload = verificarToken2FA(desafio);
      const usuario = await UsuarioModel.buscarSeguridadPorId(payload.usuarioId);
      if (!usuario?.activo || !usuario.two_factor_activo || !usuario.two_factor_secret) {
        return res.status(401).json({ error: 'No se pudo validar el segundo factor.' });
      }
      // Los intentos de código también cuentan para el bloqueo de la cuenta:
      // un código de 6 dígitos se podría adivinar si solo hubiera rate limit por IP.
      if (cuentaBloqueada(usuario)) {
        return res.status(401).json({ error: 'Código 2FA inválido o expirado.' });
      }
      if (!(await verificarCodigoTotp(usuario, codigo))) {
        await UsuarioModel.registrarIntentoFallido(usuario.id, MAX_INTENTOS, MINUTOS_BLOQUEO);
        return res.status(401).json({ error: 'Código 2FA inválido o expirado.' });
      }
      return res.json(await emitirSesion(usuario, req, res));
    } catch (err) {
      if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'El desafío 2FA expiró. Inicia sesión nuevamente.' });
      }
      return next(err);
    }
  },

  /**
   * POST /api/auth/2fa/setup
   * Exige la contraseña actual (re-autenticación): con solo un access token
   * robado no se puede registrar un segundo factor ajeno. Si el 2FA ya está
   * activo se rechaza: hay que desactivarlo primero con un código válido.
   */
  async preparar2FA(req, res, next) {
    try {
      const usuario = await UsuarioModel.buscarSeguridadPorId(req.usuario.id);
      if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });
      const { password } = req.body || {};
      if (typeof password !== 'string' || !password || password.length > MAX_LONGITUD_PASSWORD
        || !(await compararPassword(password, usuario.password_hash))) {
        return res.status(401).json({ error: 'Confirma tu contraseña actual para configurar 2FA.' });
      }
      if (usuario.two_factor_activo) {
        return res.status(409).json({ error: 'El 2FA ya está activo. Desactívalo con un código válido antes de configurarlo de nuevo.' });
      }
      const secreto = authenticator.generateSecret();
      await UsuarioModel.guardarConfiguracion2FA(usuario.id, secreto, false);
      const uri = authenticator.keyuri(usuario.correo, 'SIGEVAC', secreto);
      return res.json({ secreto, qr: await QRCode.toDataURL(uri) });
    } catch (err) { return next(err); }
  },

  async activar2FA(req, res, next) {
    try {
      const usuario = await UsuarioModel.buscarSeguridadPorId(req.usuario.id);
      if (!usuario?.two_factor_secret) return res.status(400).json({ error: 'Primero solicita la configuración 2FA.' });
      if (usuario.two_factor_activo) return res.status(409).json({ error: 'El 2FA ya está activo.' });
      // Al activar no se consume el paso: el secreto acaba de generarse y no hay nada que reproducir
      if (!(await verificarCodigoTotp(usuario, req.body?.codigo, { consumir: false }))) return res.status(400).json({ error: 'Código 2FA inválido.' });
      await UsuarioModel.guardarConfiguracion2FA(usuario.id, usuario.two_factor_secret, true);
      return res.json({ mensaje: 'Autenticación de dos factores activada.' });
    } catch (err) { return next(err); }
  },

  async desactivar2FA(req, res, next) {
    try {
      const usuario = await UsuarioModel.buscarSeguridadPorId(req.usuario.id);
      if (!usuario?.two_factor_activo) return res.status(400).json({ error: 'El 2FA no está activo.' });
      if (cuentaBloqueada(usuario)) return res.status(400).json({ error: 'Código 2FA inválido.' });
      if (!(await verificarCodigoTotp(usuario, req.body?.codigo))) {
        await UsuarioModel.registrarIntentoFallido(usuario.id, MAX_INTENTOS, MINUTOS_BLOQUEO);
        return res.status(400).json({ error: 'Código 2FA inválido.' });
      }
      await UsuarioModel.guardarConfiguracion2FA(req.usuario.id, null, false);
      return res.json({ mensaje: 'Autenticación de dos factores desactivada.' });
    } catch (err) { return next(err); }
  },

  /**
   * POST /api/auth/refresh
   * El refresh token viaja únicamente como cookie httpOnly (nunca en el
   * cuerpo de la petición) — ver utils/cookies.js.
   */
  async refresh(req, res, next) {
    try {
      const refreshToken = obtenerRefreshDeCookie(req);
      if (!refreshToken) {
        return res.status(401).json({ error: 'No hay una sesión activa que renovar.' });
      }

      let payload;
      try {
        payload = verificarRefreshToken(refreshToken);
      } catch {
        return res.status(401).json({ error: 'Refresh token inválido o expirado.' });
      }

      const sesion = await SesionModel.buscarCualquieraPorHash(hashSha256(refreshToken));
      if (!sesion) {
        return res.status(401).json({ error: 'Sesión no encontrada o revocada.' });
      }

      let rotarCookie = true;
      if (sesion.revocado) {
        const reciente = sesion.rotado_en && (Date.now() - new Date(sesion.rotado_en).getTime()) < GRACIA_ROTACION_MS;
        if (!reciente) {
          // Un refresh token ya rotado (o revocado) se está reutilizando fuera
          // de la ventana de gracia: posible robo. Se cierran todas las sesiones.
          if (sesion.rotado_en) await SesionModel.revocarTodasDeUsuario(sesion.usuario_id);
          return res.status(401).json({ error: 'Sesión no encontrada o revocada.' });
        }
        rotarCookie = false; // pestaña simultánea: ya hay una cookie nueva en camino
      }

      const usuario = await UsuarioModel.buscarPorId(payload.sub);
      if (!usuario || !usuario.activo) {
        return res.status(401).json({ error: 'Usuario no válido.' });
      }

      const usuarioConRoles = await registrarUsuarioBase(usuario, payload.asociacion_id || null);
      const nuevoAccessToken = generarAccessToken(usuarioConRoles);

      if (rotarCookie) {
        // Rotación: el refresh usado se invalida y se entrega uno nuevo. Si
        // otra petición ganó la rotación, esta responde solo con access token.
        if (await SesionModel.rotar(sesion.id)) await iniciarSesionRefresh(usuarioConRoles, req, res);
      }

      return res.json({ usuario: usuarioConRoles, access_token: nuevoAccessToken });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * POST /api/auth/logout
   */
  async logout(req, res, next) {
    try {
      const refreshToken = obtenerRefreshDeCookie(req);
      if (refreshToken) {
        const sesion = await SesionModel.buscarPorHash(hashSha256(refreshToken));
        if (sesion) await SesionModel.revocar(sesion.id);
      }
      limpiarCookieRefresh(res);
      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  },

  /**
   * POST /api/auth/forgot-password
   */
  async forgotPassword(req, res, next) {
    try {
      const { correo } = req.body || {};
      if (typeof correo !== 'string' || !correo) return res.status(400).json({ error: 'El correo es obligatorio.' });
      if (!esCorreoValido(correo)) return res.status(400).json({ error: 'El correo no tiene un formato válido.' });

      const usuario = await UsuarioModel.buscarPorCorreo(correo.toLowerCase().trim());
      // Por seguridad, siempre respondemos igual exista o no el usuario.
      if (usuario) {
        const { tokenPlano, tokenHash } = generarTokenSeguro();
        const expiraEn = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
        await TokenRecuperacionModel.crear({ usuarioId: usuario.id, tokenHash, expiraEn });

        const enlace = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${encodeURIComponent(tokenPlano)}`;
        const resultado = await enviarCorreo({
          to: correo,
          subject: 'SIGEVAC — Recuperación de contraseña',
          html: `<p>Hola,</p><p>Solicitaste cambiar tu contraseña de SIGEVAC. Usa este enlace, válido por una hora:</p><p><a href="${enlace}">${enlace}</a></p><p>Si no solicitaste este cambio, puedes ignorar este mensaje.</p>`,
        });
        if (process.env.NODE_ENV === 'development' && !resultado.enviado) {
          console.log(`[DEV] Token de recuperación para ${correo}: ${tokenPlano}`);
        }
      }

      return res.json({ mensaje: 'Si el correo existe en el sistema, se enviaron instrucciones de recuperación.' });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * POST /api/auth/reset-password
   */
  async resetPassword(req, res, next) {
    try {
      const { token, nueva_password: nuevaPassword } = req.body || {};
      if (typeof token !== 'string' || typeof nuevaPassword !== 'string' || !token || !nuevaPassword) {
        return res.status(400).json({ error: 'Token y nueva contraseña son obligatorios.' });
      }
      const errorFortaleza = validarFortalezaPassword(nuevaPassword);
      if (errorFortaleza) {
        return res.status(400).json({ error: errorFortaleza });
      }

      // Consumo atómico: si dos peticiones llegan a la vez con el mismo token,
      // solo una lo obtiene (antes ambas podían cambiar la contraseña).
      const registro = await TokenRecuperacionModel.consumirValido(hashSha256(token));
      if (!registro) {
        return res.status(400).json({ error: 'Token inválido o expirado.' });
      }

      const passwordHash = await hashPassword(nuevaPassword);
      await UsuarioModel.actualizarPassword(registro.usuario_id, passwordHash);
      await SesionModel.revocarTodasDeUsuario(registro.usuario_id);

      return res.json({ mensaje: 'Contraseña actualizada correctamente. Inicia sesión de nuevo.' });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * GET /api/auth/me
   */
  async me(req, res, next) {
    try {
      const usuario = await UsuarioModel.buscarPorId(req.usuario.id);
      if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });
      const usuarioConRoles = await registrarUsuarioBase(usuario, req.usuario.asociacionId);
      return res.json({ usuario: usuarioConRoles });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * POST /api/auth/asociacion-activa
   * Multi-asociación (diferenciador): permite a un usuario que pertenece a
   * más de una asociación civil cambiar cuál está usando en la sesión
   * actual, sin tener que volver a iniciar sesión. Emite un access token
   * y un refresh token nuevos con la asociación elegida (y revoca la
   * sesión anterior), para que la asociación activa se mantenga incluso
   * después de que el access token expire y el frontend haga /refresh.
   */
  async cambiarAsociacionActiva(req, res, next) {
    try {
      const { asociacion_id: asociacionId } = req.body || {};
      if (!asociacionId) {
        return res.status(400).json({ error: 'Falta asociacion_id.' });
      }
      if (!esUuid(asociacionId)) {
        return res.status(400).json({ error: 'asociacion_id no es un identificador válido.' });
      }

      const pertenece = await UsuarioModel.perteneceAAsociacion(req.usuario.id, asociacionId);
      if (!pertenece) {
        return res.status(403).json({ error: 'No perteneces a esa asociación.' });
      }

      const usuario = await UsuarioModel.buscarPorId(req.usuario.id);
      if (!usuario || !usuario.activo) {
        return res.status(401).json({ error: 'Usuario no válido.' });
      }

      const usuarioConRoles = await registrarUsuarioBase(usuario, asociacionId);
      const accessToken = generarAccessToken(usuarioConRoles);

      const refreshTokenActual = obtenerRefreshDeCookie(req);
      if (refreshTokenActual) {
        const sesionActual = await SesionModel.buscarPorHash(hashSha256(refreshTokenActual));
        if (sesionActual) await SesionModel.revocar(sesionActual.id);
      }
      await iniciarSesionRefresh(usuarioConRoles, req, res);

      return res.json({ usuario: usuarioConRoles, access_token: accessToken });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * POST /api/auth/change-password
   * Cambio de contraseña del usuario autenticado. Exige la contraseña actual,
   * aplica la política de fortaleza, cierra TODAS las demás sesiones y deja
   * abierta una nueva para el dispositivo desde el que se hizo el cambio.
   */
  async cambiarPassword(req, res, next) {
    try {
      const { password_actual: actual, nueva_password: nueva } = req.body || {};
      if (typeof actual !== 'string' || typeof nueva !== 'string' || !actual || !nueva) {
        return res.status(400).json({ error: 'password_actual y nueva_password son obligatorios.' });
      }
      const errorFortaleza = validarFortalezaPassword(nueva);
      if (errorFortaleza) return res.status(400).json({ error: errorFortaleza });
      if (nueva === actual) return res.status(400).json({ error: 'La nueva contraseña debe ser distinta de la actual.' });

      const usuario = await UsuarioModel.buscarSeguridadPorId(req.usuario.id);
      if (!usuario || actual.length > MAX_LONGITUD_PASSWORD || !(await compararPassword(actual, usuario.password_hash))) {
        return res.status(401).json({ error: 'La contraseña actual no es correcta.' });
      }

      await UsuarioModel.actualizarPassword(usuario.id, await hashPassword(nueva));
      await SesionModel.revocarTodasDeUsuario(usuario.id);
      const sesion = await emitirSesion(usuario, req, res);
      return res.json({ mensaje: 'Contraseña actualizada correctamente.', ...sesion });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = AuthController;