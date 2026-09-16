const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.test') });

// Base de datos AISLADA, exclusiva para la suite de pruebas automatizadas.
// Nunca debe apuntar a la base de datos de desarrollo ni de producción.
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
  || 'postgresql://postgres:postgres@localhost:5432/sigevac_jest';

module.exports = { TEST_DATABASE_URL };
