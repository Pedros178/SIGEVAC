const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const { TEST_DATABASE_URL } = require('./testDbConfig');

const NOMBRE_BD = TEST_DATABASE_URL.split('/').pop();
const URL_MANTENIMIENTO = TEST_DATABASE_URL.replace(/\/[^/]+$/, '/postgres');

module.exports = async function globalSetup() {
  // 1. Recrear la base de datos de pruebas desde cero (aislada de dev/producción)
  const admin = new Client({ connectionString: URL_MANTENIMIENTO });
  await admin.connect();
  await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${NOMBRE_BD}' AND pid <> pg_backend_pid()`);
  await admin.query(`DROP DATABASE IF EXISTS ${NOMBRE_BD}`);
  await admin.query(`CREATE DATABASE ${NOMBRE_BD}`);
  await admin.end();

  // 2. Aplicar el esquema completo
  const cliente = new Client({ connectionString: TEST_DATABASE_URL });
  await cliente.connect();
  const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  await cliente.query(schemaSql);

  const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');
  const migrations = fs.readdirSync(migrationsDir).filter((archivo) => archivo.endsWith('.sql')).sort();
  for (const migracion of migrations) {
    await cliente.query(fs.readFileSync(path.join(migrationsDir, migracion), 'utf8'));
  }

  // 3. Aplicar los datos semilla (roles, permisos, catálogos, asociación)
  const seedSql = fs.readFileSync(path.join(__dirname, '..', 'database', 'seeds', '001_seed_base.sql'), 'utf8');
  await cliente.query(seedSql);

  // 4. Crear un usuario super_admin de pruebas con contraseña conocida por los tests
  const passwordHash = await bcrypt.hash('TestPass#123', 12);
  const { rows: asociacionRows } = await cliente.query(`SELECT id FROM asociaciones LIMIT 1`);
  const { rows: usuarioRows } = await cliente.query(
    `INSERT INTO usuarios (nombre, correo, password_hash, asociacion_id)
     VALUES ('Admin de Pruebas', 'admin.test@sigevac.local', $1, $2) RETURNING id`,
    [passwordHash, asociacionRows[0].id]
  );
  const { rows: rolRows } = await cliente.query(`SELECT id FROM roles WHERE nombre = 'super_admin'`);
  await cliente.query(`INSERT INTO usuarios_roles (usuario_id, rol_id) VALUES ($1, $2)`, [usuarioRows[0].id, rolRows[0].id]);

  // Multi-asociación (N:M): sin esta fila, `usuario.asociaciones` quedaría
  // vacío en las respuestas de auth durante las pruebas, aunque el usuario
  // sí tenga una asociación asignada por la columna heredada `asociacion_id`.
  await cliente.query(
    `INSERT INTO usuario_asociaciones (usuario_id, asociacion_id, es_predeterminada) VALUES ($1, $2, true)`,
    [usuarioRows[0].id, asociacionRows[0].id]
  );

  await cliente.end();

  console.log(`\n[globalSetup] Base de datos de pruebas "${NOMBRE_BD}" lista con esquema, seeds y super_admin de pruebas.`);
};
