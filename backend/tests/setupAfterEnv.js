afterAll(async () => {
  const { pool } = require('../src/config/database');
  await pool.end();
});
