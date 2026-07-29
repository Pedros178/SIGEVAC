const UsuarioModel = require('../models/usuarioModel');
const SesionModel = require('../models/sesionModel');
const TokenRecuperacionModel = require('../models/tokenRecuperacionModel');
const { hashPassword, compararPassword, generarTokenSeguro, hashSha256 } = require('../utils/password');
const {
  generarAccessToken,
  generarRefreshToken,
  verificarRefreshToken,
} = require('../utils/jwt');

const MAX_INTENTOS = parseInt(process.env.MAX_INTENTOS_FALLIDOS || '5', 10);
const MINUTOS_BLOQUEO = parseInt(process.env.BLOQUEO_MINUTOS || '15', 10);
const REFRESH_DIAS = 7;

async function registrarUsuarioBase(usuario) {
  const roles = await UsuarioModel.obtenerRoles(usuario.id);
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    correo: usuario.correo,
    asociacion_id: usuario.asociacion_id,
    roles,
  };
}

const AuthController = {
  /**
   * POST /api/auth/login
   */
  async login(req, res, next) {
    try {
      const { correo, password } = req.body;
      if (!correo || !password) {
        return res.status(400).json({ error: 'Correo y contraseña son obligatorios.' });
      }

      const usuario = await UsuarioModel.buscarPorCorreo(correo.toLowerCase().trim());
      if (!usuario) {
        return res.status(401).json({ error: 'Credenciales inválidas.' });
      }

      if (!usuario.activo) {
        return res.status(403).json({ error: 'Tu cuenta está desactivada. Contacta al administrador.' });
      }

      if (usuario.bloqueado_hasta && new Date(usuario.bloqueado_hasta) > new Date()) {
        return res.status(423).json({
          error: `Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intenta después de ${new Date(usuario.bloqueado_hasta).toLocaleTimeString('es-MX')}.`,
        });
      }

      const passwordValido = await compararPassword(password, usuario.password_hash);
      if (!passwordValido) {
        const resultado = await UsuarioModel.registrarIntentoFallido(usuario.id, MAX_INTENTOS, MINUTOS_BLOQUEO);
        return res.status(401).json({
          error: 'Credenciales inválidas.',
          intentos_restantes: Math.max(0, MAX_INTENTOS - resultado.intentos_fallidos),
        });
      }

      await UsuarioModel.registrarLoginExitoso(usuario.id);

      const usuarioConRoles = await registrarUsuarioBase(usuario);
      const accessToken = generarAccessToken(usuarioConRoles);
      const refreshToken = generarRefreshToken(usuarioConRoles);

      const expiraEn = new Date(Date.now() + REFRESH_DIAS * 24 * 60 * 60 * 1000);
      await SesionModel.crear({
        usuarioId: usuario.id,
        refreshTokenHash: hashSha256(refreshToken),
        ip: req.ip,
        userAgent: req.headers['user-agent'] || null,
        expiraEn,
      });

      return res.json({
        usuario: usuarioConRoles,
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * POST /api/auth/refresh
   */
  async refresh(req, res, next) {
    try {
      const { refresh_token: refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({ error: 'Falta el refresh_token.' });
      }

      let payload;
      try {
        payload = verificarRefreshToken(refreshToken);
      } catch {
        return res.status(401).json({ error: 'Refresh token inválido o expirado.' });
      }

      const sesion = await SesionModel.buscarPorHash(hashSha256(refreshToken));
      if (!sesion) {
        return res.status(401).json({ error: 'Sesión no encontrada o revocada.' });
      }

      const usuario = await UsuarioModel.buscarPorId(payload.sub);
      if (!usuario || !usuario.activo) {
        return res.status(401).json({ error: 'Usuario no válido.' });
      }

      const usuarioConRoles = await registrarUsuarioBase(usuario);
      const nuevoAccessToken = generarAccessToken(usuarioConRoles);

      return res.json({ access_token: nuevoAccessToken });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * POST /api/auth/logout
   */
  async logout(req, res, next) {
    try {
      const { refresh_token: refreshToken } = req.body;
      if (refreshToken) {
        const sesion = await SesionModel.buscarPorHash(hashSha256(refreshToken));
        if (sesion) await SesionModel.revocar(sesion.id);
      }
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
      const { correo } = req.body;
      if (!correo) return res.status(400).json({ error: 'El correo es obligatorio.' });

      const usuario = await UsuarioModel.buscarPorCorreo(correo.toLowerCase().trim());
      // Por seguridad, siempre respondemos igual exista o no el usuario.
      if (usuario) {
        const { tokenPlano, tokenHash } = generarTokenSeguro();
        const expiraEn = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
        await TokenRecuperacionModel.crear({ usuarioId: usuario.id, tokenHash, expiraEn });

        // TODO (Módulo 17 - Notificaciones): enviar correo real con el enlace,
        // por ejemplo: `${process.env.FRONTEND_URL}/reset-password?token=${tokenPlano}`
        if (process.env.NODE_ENV === 'development') {
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
      const { token, nueva_password: nuevaPassword } = req.body;
      if (!token || !nuevaPassword) {
        return res.status(400).json({ error: 'Token y nueva contraseña son obligatorios.' });
      }
      if (nuevaPassword.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
      }

      const tokenHash = hashSha256(token);
      const registro = await TokenRecuperacionModel.buscarValido(tokenHash);
      if (!registro) {
        return res.status(400).json({ error: 'Token inválido o expirado.' });
      }

      const passwordHash = await hashPassword(nuevaPassword);
      await UsuarioModel.actualizarPassword(registro.usuario_id, passwordHash);
      await TokenRecuperacionModel.marcarUsado(registro.id);
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
      const usuarioConRoles = await registrarUsuarioBase(usuario);
      return res.json({ usuario: usuarioConRoles });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = AuthController;
