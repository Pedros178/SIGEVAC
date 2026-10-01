/**
 * Validación de variables de entorno para producción. Devuelve la lista de
 * problemas (vacía = configuración aceptable); app.js lanza error si hay alguno.
 *
 * Antes solo se comprobaba que las variables EXISTIERAN: el `.env.example`
 * (con secretos JWT públicos en el repositorio) copiado tal cual a producción
 * pasaba la validación, permitiendo a cualquiera firmar tokens válidos.
 */
const FRAGMENTOS_SECRETO_INSEGURO = ['desarrollo', 'no-usar', 'cambiar', 'changeme', 'secret123', 'super_secreto', 'example', 'ejemplo'];
const LONGITUD_MINIMA_SECRETO = 32;

function validarEntornoProduccion(env = process.env) {
  const problemas = [];
  const requeridas = [
    'DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'FRONTEND_URL',
    'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_STORAGE_BUCKET',
  ];
  const faltantes = requeridas.filter((nombre) => !env[nombre]);
  if (faltantes.length) problemas.push(`Faltan variables de producción: ${faltantes.join(', ')}`);

  for (const nombre of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    const valor = env[nombre];
    if (!valor) continue;
    if (valor.length < LONGITUD_MINIMA_SECRETO) {
      problemas.push(`${nombre} es demasiado corto (mínimo ${LONGITUD_MINIMA_SECRETO} caracteres). Genera uno con: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`);
    }
    if (FRAGMENTOS_SECRETO_INSEGURO.some((f) => valor.toLowerCase().includes(f))) {
      problemas.push(`${nombre} parece un valor de ejemplo/desarrollo. Genera un secreto aleatorio propio.`);
    }
  }
  if (env.JWT_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    problemas.push('JWT_SECRET y JWT_REFRESH_SECRET deben ser distintos.');
  }
  if (env.DATABASE_URL && /:(admin123|postgres|password|123456)@/i.test(env.DATABASE_URL)) {
    problemas.push('DATABASE_URL usa una contraseña de base de datos trivial/de ejemplo.');
  }
  if (env.SEED_ADMIN_PASSWORD === 'Sigevac#2026') {
    problemas.push('SEED_ADMIN_PASSWORD conserva el valor público de ejemplo.');
  }
  return problemas;
}

module.exports = { validarEntornoProduccion };
