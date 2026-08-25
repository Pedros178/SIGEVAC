const { TEST_DATABASE_URL } = require('./testDbConfig');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.DB_SSL = 'false';
process.env.JWT_SECRET = 'clave-de-prueba-jwt-no-usar-en-produccion';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_SECRET = 'clave-de-prueba-refresh-no-usar-en-produccion';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.MAX_INTENTOS_FALLIDOS = '3';
process.env.BLOQUEO_MINUTOS = '15';
process.env.FRONTEND_URL = 'http://localhost:5173';
// Sin SMTP_HOST a propósito: las pruebas verifican el modo "solo registro" del servicio de correo.
