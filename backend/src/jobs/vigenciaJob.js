const AsociacionModel = require('../models/asociacionModel');
const ConfiguracionModel = require('../models/configuracionModel');
const { DocumentoModel } = require('../models/expedienteModel');
const { notificarDocumentoPorVencer } = require('../services/notificacionService');

const DIAS_POR_DEFECTO = parseInt(process.env.DIAS_ALERTA_VIGENCIA || '30', 10);

/**
 * Módulo 17 (diferenciador — control de vigencia de documentos).
 *
 * Revisa, por cada asociación activa, los documentos aprobados con
 * vigencia próxima a vencer (o ya vencida) que todavía no han recibido
 * alerta, y dispara la notificación correspondiente (correo al
 * voluntario + aviso interno a los usuarios de la asociación).
 *
 * Es idempotente por diseño: una vez notificado, `documentos.alerta_vigencia_enviada_en`
 * queda con fecha y el documento no vuelve a aparecer en la consulta,
 * a menos que se le asigne una nueva vigencia_hasta (ver expedienteModel.actualizarEstado).
 *
 * Se puede ejecutar por cron (ver server.js) o manualmente desde
 * POST /api/configuracion/vigencias/revisar.
 */
async function revisarDocumentosPorVencer() {
  const resumen = { asociaciones_revisadas: 0, documentos_revisados: 0, notificados: 0, errores: 0 };

  const asociaciones = await AsociacionModel.listar();

  for (const asociacion of asociaciones) {
    if (asociacion.activo === false) continue;
    resumen.asociaciones_revisadas += 1;

    let dias = DIAS_POR_DEFECTO;
    try {
      const config = await ConfiguracionModel.obtener(asociacion.id, 'dias_alerta_vigencia');
      if (config?.valor && !Number.isNaN(Number(config.valor))) {
        dias = Number(config.valor);
      }
    } catch {
      // si no hay configuración personalizada, se usa el valor por defecto
    }

    const documentos = await DocumentoModel.listarProximosAVencer({ dias, asociacionId: asociacion.id });
    resumen.documentos_revisados += documentos.length;

    for (const documento of documentos) {
      try {
        await notificarDocumentoPorVencer({
          voluntario: {
            id: documento.voluntario_id,
            nombre: documento.voluntario_nombre,
            correo: documento.voluntario_correo,
          },
          documento,
        });
        await DocumentoModel.marcarAlertaVigenciaEnviada(documento.id);
        resumen.notificados += 1;
      } catch (err) {
        resumen.errores += 1;
        console.error(`[vigenciaJob] Error notificando documento ${documento.id}:`, err.message);
      }
    }
  }

  return resumen;
}

/**
 * Registra la ejecución diaria (08:00, hora del servidor). Se omite en
 * pruebas automatizadas y se puede desactivar con DESACTIVAR_CRON_VIGENCIA=true
 * (útil para entornos donde no se quiere enviar correos automáticamente).
 */
function programarRevisionDiaria() {
  if (process.env.NODE_ENV === 'test' || process.env.DESACTIVAR_CRON_VIGENCIA === 'true') {
    return null;
  }

  // Import perezoso: evita que el paquete sea obligatorio en entornos de
  // prueba que no lo tengan instalado.
  const cron = require('node-cron');

  return cron.schedule('0 8 * * *', async () => {
    console.log('[vigenciaJob] Iniciando revisión diaria de vigencias...');
    try {
      const resumen = await revisarDocumentosPorVencer();
      console.log('[vigenciaJob] Revisión completada:', resumen);
    } catch (err) {
      console.error('[vigenciaJob] Error en la revisión programada:', err.message);
    }
  });
}

module.exports = { revisarDocumentosPorVencer, programarRevisionDiaria };
