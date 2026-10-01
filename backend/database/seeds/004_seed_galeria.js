/**
 * SIGEVAC — Carga inicial de la galería pública.
 *
 * Antes de esta migración, la sección "Galería" del Home mostraba un
 * arreglo de fotos fijo en el código del frontend (frontend/src/pages/
 * Home.jsx). Este script toma esas mismas fotos — que ya viven en
 * frontend/public/galeria/ — y las registra en la tabla galeria_publica
 * (copiándolas a backend/uploads/, o subiéndolas a Supabase Storage si
 * SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY están configuradas), para que
 * a partir de ahora se administren desde el panel en vez de necesitar
 * un cambio de código.
 *
 * Es re-ejecutable de forma segura: si una foto con la misma leyenda ya
 * existe para la asociación, no la vuelve a insertar.
 *
 * Requiere haber corrido antes: npm run db:setup && npm run db:seed
 * Uso: npm run db:seed:galeria
 */
require('dotenv').config();
// Estos datos son de DEMOSTRACIÓN (contraseña pública conocida, personas ficticias):
// nunca deben cargarse en una base de producción por accidente.
if (process.env.NODE_ENV === 'production' && process.env.PERMITIR_SEED_DEMO !== 'true') {
  console.error('❌ Seed de demostración bloqueado: NODE_ENV=production. Si de verdad lo necesitas, define PERMITIR_SEED_DEMO=true.');
  process.exit(1);
}

const path = require('path');
const fs = require('fs');

const { pool, query } = require(path.join(__dirname, '../../src/config/database'));
const GaleriaModel = require(path.join(__dirname, '../../src/models/galeriaModel'));
const { guardarArchivo, almacenamientoRemoto } = require(path.join(__dirname, '../../src/config/storage'));

// Misma carpeta y mismos archivos que usa el Home público
// (frontend/src/pages/Home.jsx, arreglo GALERIA) — se mantienen en un
// solo lugar de origen para no tener dos copias que se puedan desincronizar.
const CARPETA_ORIGEN = path.join(__dirname, '../../../frontend/public/galeria');

const FOTOS = [
  { archivo: 'danza-folklorica-kiosco.jpg', alt: 'Grupo de danza folklórica de la asociación bailando frente a un kiosco, con vestuario tradicional blanco y detalles rojos', leyenda: 'Danza folklórica en la plaza' },
  { archivo: 'danza-folklorica-patio-blanco.jpg', alt: 'Bailarines con trajes blancos y sombreros presentándose en el patio de un edificio histórico de cantera', leyenda: 'Presentación en recinto histórico' },
  { archivo: 'danza-folklorica-patio-rojo.jpg', alt: 'Bailarinas con faldas rojas y amarillas bailando en el patio de un edificio colonial', leyenda: 'Danza folklórica — faldas rojas' },
  { archivo: 'taller-reposteria.jpg', alt: 'Voluntarios preparando repostería en un taller comunitario', leyenda: 'Taller de repostería' },
  { archivo: 'evento-sentimientos-cubicos.jpg', alt: 'Grupo de danza de la asociación en un escenario, en el décimo aniversario de Sentimientos Cúbicos México', leyenda: '10.º aniversario Sentimientos Cúbicos México' },
  { archivo: 'flyer-voluntariado-verano-2026.jpg', alt: 'Cartel del Programa de Voluntariado de Verano 2026, del 25 de julio al 23 de agosto', leyenda: 'Voluntariado de Verano 2026' },
  { archivo: 'flyer-convocatoria-nacional-2026.jpg', alt: 'Cartel de la Convocatoria Nacional para Líderes Estatales 2026', leyenda: 'Convocatoria de Líderes Estatales' },
  { archivo: 'flyer-areas-labor.jpg', alt: 'Infografía con las áreas de labor de la asociación y sus datos de contacto', leyenda: 'Nuestras áreas de labor' },
];

async function main() {
  console.log('Cargando fotos iniciales de la galería pública...\n');

  const { rows } = await query(`SELECT * FROM asociaciones ORDER BY creado_en ASC LIMIT 1`);
  const asociacion = rows[0];
  if (!asociacion) throw new Error('No se encontró ninguna asociación. Corre primero npm run db:seed.');

  const existentes = await GaleriaModel.listar(asociacion.id);
  const leyendasExistentes = new Set(existentes.map((f) => f.leyenda));

  let orden = existentes.length;
  let agregadas = 0;
  for (const foto of FOTOS) {
    if (leyendasExistentes.has(foto.leyenda)) {
      console.log(`↷  Ya existe: "${foto.leyenda}" — se omite.`);
      continue;
    }

    const rutaOrigen = path.join(CARPETA_ORIGEN, foto.archivo);
    if (!fs.existsSync(rutaOrigen)) {
      console.warn(`⚠️  No se encontró ${rutaOrigen}, se omite "${foto.leyenda}".`);
      continue;
    }

    const nombreUnico = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}${path.extname(foto.archivo)}`;

    // guardarArchivo() con `rutaLocal` asume que el archivo ya está DENTRO
    // de UPLOADS_DIR con ese nombre (así es como lo deja multer en una
    // subida real vía HTTP). Aquí el origen está en otra carpeta del repo
    // (frontend/public/galeria), así que copiamos/subimos nosotros mismos
    // en vez de usar esa rama de la función.
    let referencia;
    if (almacenamientoRemoto) {
      referencia = await guardarArchivo({
        buffer: fs.readFileSync(rutaOrigen),
        ruta: `galeria/${asociacion.id}/${nombreUnico}`,
        contentType: 'image/jpeg',
      });
    } else {
      const { UPLOADS_DIR } = require(path.join(__dirname, '../../src/config/uploads'));
      fs.copyFileSync(rutaOrigen, path.join(UPLOADS_DIR, nombreUnico));
      referencia = `/uploads/${nombreUnico}`;
    }

    await GaleriaModel.crear({
      asociacionId: asociacion.id,
      url: referencia,
      mimeType: 'image/jpeg',
      textoAlternativo: foto.alt,
      leyenda: foto.leyenda,
      orden: orden++,
    });
    agregadas++;
    console.log(`✅ Agregada: "${foto.leyenda}"`);
  }

  console.log(`\n${agregadas} foto(s) nueva(s) agregada(s) a la galería de "${asociacion.nombre}".`);
  console.log('Ya se pueden ver/editar/ocultar desde Administración → Galería, y en el Home público.\n');
}

main()
  .catch((err) => {
    console.error('❌ Error cargando la galería pública:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
