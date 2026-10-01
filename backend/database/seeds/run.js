/**
 * Ejecuta los seeds SQL base y luego crea el usuario super_admin inicial
 * con una contraseña correctamente hasheada con bcrypt.
 * Uso: npm run db:seed
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { validarFortalezaPassword } = require('../../src/utils/password');

function generarPasswordSegura() {
  // 3 bloques aleatorios + símbolo y número fijos para cumplir la política de fortaleza
  return `${crypto.randomBytes(6).toString('base64url')}-${crypto.randomBytes(6).toString('base64url')}#${crypto.randomInt(10, 99)}Aa`;
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();
  try {
    const seedSql = fs.readFileSync(path.join(__dirname, '001_seed_base.sql'), 'utf8');
    console.log('Aplicando datos semilla base (roles, permisos, catálogos, asociación)...');
    await client.query(seedSql);
    console.log('✅ Datos semilla base aplicados.');

    const correoAdmin = process.env.SEED_ADMIN_EMAIL || 'admin@suenosdecomedia.org';
    // Sin contraseña por defecto conocida: si no se define SEED_ADMIN_PASSWORD
    // se genera una aleatoria y se muestra UNA sola vez en esta ejecución.
    const passwordGenerada = !process.env.SEED_ADMIN_PASSWORD;
    const passwordAdmin = process.env.SEED_ADMIN_PASSWORD || generarPasswordSegura();
    if (process.env.SEED_ADMIN_PASSWORD === 'Sigevac#2026' && process.env.NODE_ENV === 'production') {
      throw new Error('SEED_ADMIN_PASSWORD conserva el valor público de ejemplo; define una contraseña propia.');
    }
    const errorFortaleza = validarFortalezaPassword(passwordAdmin);
    if (errorFortaleza) throw new Error(`SEED_ADMIN_PASSWORD no cumple la política: ${errorFortaleza}`);

    const { rows: existentes } = await client.query('SELECT id FROM usuarios WHERE correo = $1', [correoAdmin]);
    if (existentes.length > 0) {
      console.log(`ℹ️  El usuario ${correoAdmin} ya existe. No se vuelve a crear.`);
    } else {
      const { rows: asociacionRows } = await client.query(
        `SELECT id FROM asociaciones WHERE nombre ILIKE '%Sueños de Comedia%' LIMIT 1`
      );
      const asociacionId = asociacionRows[0]?.id || null;

      const passwordHash = await bcrypt.hash(passwordAdmin, 12);
      const { rows: nuevoUsuario } = await client.query(
        `INSERT INTO usuarios (nombre, correo, password_hash, asociacion_id)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        ['Administrador SIGEVAC', correoAdmin, passwordHash, asociacionId]
      );

      if (asociacionId) {
        await client.query(
          `INSERT INTO usuario_asociaciones (usuario_id, asociacion_id, es_predeterminada)
           VALUES ($1, $2, true)
           ON CONFLICT (usuario_id, asociacion_id) DO NOTHING`,
          [nuevoUsuario[0].id, asociacionId]
        );
      }

      const { rows: rolRows } = await client.query(`SELECT id FROM roles WHERE nombre = 'super_admin'`);
      await client.query(
        `INSERT INTO usuarios_roles (usuario_id, rol_id) VALUES ($1, $2)`,
        [nuevoUsuario[0].id, rolRows[0].id]
      );

      console.log(`✅ Usuario super_admin creado: ${correoAdmin}`);
      if (passwordGenerada) {
        console.log(`🔑 Contraseña inicial GENERADA (no se volverá a mostrar): ${passwordAdmin}`);
      }
      console.log('⚠️  Cambia esta contraseña después del primer inicio de sesión (POST /api/auth/change-password).');
    }
  } catch (err) {
    console.error('❌ Error aplicando seeds:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
