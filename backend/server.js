const app = require('./app');
const { programarRevisionDiaria } = require('./src/jobs/vigenciaJob');

const PORT = process.env.PORT || 4000;

const servidor = app.listen(PORT, () => {
  console.log(`SIGEVAC API corriendo en http://localhost:${PORT}`);
  console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
  programarRevisionDiaria(); // Módulo 17 (diferenciador): alertas de vigencia, todos los días 08:00
});

async function apagar(signal) {
  console.log(`Recibida señal ${signal}. Cerrando SIGEVAC...`);
  servidor.close(() => process.exit(0));
}

process.once('SIGTERM', () => apagar('SIGTERM'));
process.once('SIGINT', () => apagar('SIGINT'));
