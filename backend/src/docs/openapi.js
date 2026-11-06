/**
 * Especificación OpenAPI 3.0 de SIGEVAC. Se mantiene como objeto JS (no YAML)
 * para poder documentar cada fase del proyecto según se va implementando,
 * sin depender de un archivo separado que se desincronice del código.
 */
const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'SIGEVAC API',
    version: '0.4.0',
    description:
      'Sistema Integral para la Gestión de Expedientes y Voluntariado para Asociaciones Civiles. ' +
      'Documentación de la API REST — Fases 1 a 4 (Módulos 1 a 17).',
  },
  servers: [{ url: '/api', description: 'Servidor actual' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },
      Usuario: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          nombre: { type: 'string' },
          correo: { type: 'string', format: 'email' },
          roles: { type: 'array', items: { type: 'object' } },
        },
      },
      Voluntario: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          numero_voluntario: { type: 'string', example: 'SC-2026-0001' },
          nombre: { type: 'string' },
          apellido_paterno: { type: 'string' },
          apellido_materno: { type: 'string' },
          fecha_nacimiento: { type: 'string', format: 'date' },
          es_menor_edad: { type: 'boolean' },
          correo: { type: 'string' },
          telefono: { type: 'string' },
        },
      },
      Expediente: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          estado: { type: 'string', enum: ['completo', 'en_revision', 'incompleto'] },
          porcentaje_avance: { type: 'integer' },
          documentos: { type: 'array', items: { type: 'object' } },
        },
      },
      Actividad: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          nombre: { type: 'string' },
          fecha: { type: 'string', format: 'date' },
          lugar: { type: 'string' },
          cupo: { type: 'integer' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/privacidad/voluntarios/{id}/datos-personales': {
      get: { tags: ['Privacidad'], summary: 'Derecho de acceso: exporta todos los datos personales del voluntario (JSON)', security: [{ bearerAuth: [] }], description: 'Requiere el permiso privacidad.gestionar. ?descargar=1 fuerza la descarga como archivo.', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Datos personales' }, 403: { description: 'Sin permiso' }, 404: { description: 'No existe o es de otra asociación' } } },
    },
    '/privacidad/voluntarios/{id}/anonimizar': {
      post: { tags: ['Privacidad'], summary: 'Derecho de cancelación: elimina/anonimiza los datos personales (irreversible)', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['confirmar', 'motivo'], properties: { confirmar: { type: 'boolean', enum: [true] }, motivo: { type: 'string', maxLength: 500 } } } } } }, responses: { 200: { description: 'Anonimizado' }, 400: { description: 'Falta confirmación o motivo' }, 409: { description: 'Ya anonimizado' } } },
    },
    '/privacidad/voluntarios/{id}/consentimientos': {
      get: { tags: ['Privacidad'], summary: 'Lista los consentimientos registrados', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Lista' } } },
      post: { tags: ['Privacidad'], summary: 'Registra la aceptación del aviso de privacidad', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['versionAviso'], properties: { versionAviso: { type: 'string' }, finalidadesSecundarias: { type: 'boolean' }, medio: { type: 'string', enum: ['presencial', 'portal', 'documento_firmado', 'otro'] } } } } } }, responses: { 201: { description: 'Registrado' } } },
    },
    '/privacidad/arco': {
      get: { tags: ['Privacidad'], summary: 'Lista solicitudes ARCO (con alerta de vencimiento)', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Lista' } } },
      post: { tags: ['Privacidad'], summary: 'Registra una solicitud ARCO', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Creada' } } },
    },
    '/privacidad/retencion/candidatos': {
      get: { tags: ['Privacidad'], summary: 'Bajas antiguas que aún conservan datos personales (?anios=5)', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Candidatos' } } },
    },
    '/auth/login': {
      post: {
        tags: ['Autenticación'], summary: 'Inicia sesión', security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { correo: { type: 'string' }, password: { type: 'string' } }, required: ['correo', 'password'] } } },
        },
        responses: {
          200: {
            description: 'Login exitoso. El refresh token se entrega como cookie httpOnly (Set-Cookie: sigevac_refresh), nunca en el cuerpo de la respuesta.',
            content: { 'application/json': { schema: { type: 'object', properties: { usuario: { $ref: '#/components/schemas/Usuario' }, access_token: { type: 'string' } } } } },
          },
          401: { description: 'Credenciales inválidas', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Autenticación'],
        summary: 'Renueva el access token',
        description: 'Lee el refresh token de la cookie httpOnly `sigevac_refresh` (no requiere cuerpo). El cliente debe enviar la petición con credenciales (cookies) incluidas.',
        security: [],
        responses: { 200: { description: 'Nuevo access token' }, 401: { description: 'No hay sesión activa o el refresh token es inválido/expiró' } },
      },
    },
    '/auth/me': {
      get: { tags: ['Autenticación'], summary: 'Usuario autenticado actual', responses: { 200: { description: 'Datos del usuario' } } },
    },
    '/voluntarios': {
      get: {
        tags: ['Voluntarios'], summary: 'Lista voluntarios',
        parameters: [
          { name: 'busqueda', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'Listado', content: { 'application/json': { schema: { type: 'object', properties: { voluntarios: { type: 'array', items: { $ref: '#/components/schemas/Voluntario' } } } } } } } },
      },
      post: {
        tags: ['Voluntarios'], summary: 'Registra un voluntario y su expediente automáticamente',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 201: { description: 'Voluntario creado' }, 400: { description: 'Datos inválidos', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } },
      },
    },
    '/voluntarios/{id}': {
      get: { tags: ['Voluntarios'], summary: 'Detalle de un voluntario', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Voluntario' }, 404: { description: 'No encontrado' } } },
    },
    '/voluntarios/{id}/expediente': {
      get: {
        tags: ['Expedientes'], summary: 'Expediente digital con semáforo y documentos',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Expediente', content: { 'application/json': { schema: { type: 'object', properties: { expediente: { $ref: '#/components/schemas/Expediente' } } } } } } },
      },
    },
    '/documentos/{id}/aprobar': {
      post: { tags: ['Expedientes'], summary: 'Aprueba un documento cargado', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Documento aprobado' } } },
    },
    '/documentos/{id}/rechazar': {
      post: {
        tags: ['Expedientes'], summary: 'Rechaza un documento (requiere motivo)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { observaciones: { type: 'string' } }, required: ['observaciones'] } } } },
        responses: { 200: { description: 'Documento rechazado' } },
      },
    },
    '/documentos/{documentoId}/archivos': {
      post: {
        tags: ['Expedientes'], summary: 'Sube una nueva versión de archivo (multipart/form-data, campo "archivo")',
        parameters: [{ name: 'documentoId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'multipart/form-data': { schema: { type: 'object', properties: { archivo: { type: 'string', format: 'binary' } } } } } },
        responses: { 201: { description: 'Archivo cargado' } },
      },
    },
    '/actividades': {
      get: { tags: ['Actividades'], summary: 'Lista actividades', responses: { 200: { description: 'Listado', content: { 'application/json': { schema: { type: 'object', properties: { actividades: { type: 'array', items: { $ref: '#/components/schemas/Actividad' } } } } } } } } },
      post: { tags: ['Actividades'], summary: 'Crea una actividad', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Actividad' } } } }, responses: { 201: { description: 'Actividad creada' } } },
    },
    '/actividades/{id}/participaciones': {
      post: {
        tags: ['Actividades'], summary: 'Inscribe un voluntario a la actividad',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { voluntarioId: { type: 'string' } } } } } },
        responses: { 201: { description: 'Inscrito' } },
      },
    },
    '/participaciones/{id}/entrada': {
      post: { tags: ['Actividades'], summary: 'Registra la hora de entrada', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Entrada registrada' } } },
    },
    '/participaciones/{id}/salida': {
      post: { tags: ['Actividades'], summary: 'Registra la hora de salida y calcula horas realizadas', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Salida registrada' } } },
    },
    '/voluntarios/{id}/credencial': {
      get: { tags: ['Credencial'], summary: 'Obtiene la credencial digital vigente', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Credencial' }, 404: { description: 'Sin credencial' } } },
      post: { tags: ['Credencial'], summary: 'Genera o renueva la credencial digital y su código QR', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 201: { description: 'Credencial generada' } } },
    },
    '/qr/{codigo}': {
      get: { tags: ['Credencial'], summary: 'Valida la identidad de un voluntario escaneando su código QR', parameters: [{ name: 'codigo', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Voluntario identificado' }, 404: { description: 'Código no válido' } } },
    },
    '/publico/certificados/{codigo}': {
      get: { tags: ['Credencial'], summary: 'Consulta públicamente un certificado de horas usando el código QR', parameters: [{ name: 'codigo', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Certificado verificable' }, 404: { description: 'Código no válido o voluntario inactivo' } } },
    },
    '/publico/certificados/{codigo}.pdf': {
      get: { tags: ['Credencial'], summary: 'Descarga el certificado público de horas en PDF', parameters: [{ name: 'codigo', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'PDF del certificado', content: { 'application/pdf': {} } } } },
    },
    '/dashboard': {
      get: { tags: ['Dashboard y Reportes'], summary: 'Indicadores generales de la asociación', responses: { 200: { description: 'Indicadores' } } },
    },
    '/reportes/tipos': {
      get: { tags: ['Dashboard y Reportes'], summary: 'Catálogo de reportes disponibles', responses: { 200: { description: 'Lista de tipos' } } },
    },
    '/reportes/{tipo}': {
      get: {
        tags: ['Dashboard y Reportes'], summary: 'Genera un reporte en el formato solicitado',
        parameters: [
          { name: 'tipo', in: 'path', required: true, schema: { type: 'string' }, example: 'voluntarios-activos' },
          { name: 'formato', in: 'query', schema: { type: 'string', enum: ['json', 'csv', 'xlsx', 'pdf'] } },
        ],
        responses: { 200: { description: 'Reporte generado (JSON o archivo descargable según el formato)' } },
      },
    },
    '/notificaciones': {
      get: { tags: ['Notificaciones'], summary: 'Notificaciones del usuario autenticado', responses: { 200: { description: 'Listado' } } },
    },
    '/notificaciones/{id}/leida': {
      patch: { tags: ['Notificaciones'], summary: 'Marca una notificación como leída', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Notificación actualizada' } } },
    },
    '/auditoria': {
      get: { tags: ['Auditoría y Bitácora'], summary: 'Historial de acciones que modificaron datos', responses: { 200: { description: 'Listado de auditoría' } } },
    },
    '/auditoria/bitacora': {
      get: { tags: ['Auditoría y Bitácora'], summary: 'Historial completo de actividad del sistema', responses: { 200: { description: 'Listado de bitácora' } } },
    },
    '/configuracion': {
      get: { tags: ['Configuración'], summary: 'Configuración general de la asociación', responses: { 200: { description: 'Listado de claves/valores' } } },
    },
    '/configuracion/{clave}': {
      put: {
        tags: ['Configuración'], summary: 'Establece un valor de configuración',
        parameters: [{ name: 'clave', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { valor: {} } } } } },
        responses: { 200: { description: 'Configuración actualizada' } },
      },
    },
    '/configuracion/documentos-requeridos': {
      get: { tags: ['Configuración'], summary: 'Tipos de documento con su valor efectivo (obligatorio / a quién aplica) para la asociación', responses: { 200: { description: 'Listado' } } },
    },
    '/configuracion/documentos-requeridos/{tipoDocumentoId}': {
      put: {
        tags: ['Configuración'], summary: 'Personaliza si un documento es obligatorio y a quién aplica (afecta expedientes nuevos)',
        parameters: [{ name: 'tipoDocumentoId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { obligatorio: { type: 'boolean' }, aplica_a: { type: 'string', enum: ['mayor', 'menor', 'ambos'] } } } } } },
        responses: { 200: { description: 'Configuración guardada' }, 400: { description: 'Datos inválidos' } },
      },
      delete: {
        tags: ['Configuración'], summary: 'Restablece el valor predeterminado del tipo de documento',
        parameters: [{ name: 'tipoDocumentoId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Restablecido' } },
      },
    },
    '/catalogos/{tipo}': {
      get: {
        tags: ['Catálogos'], summary: 'Opciones de un catálogo (tipo_sangre, parentesco, ...). Público, solo lectura',
        parameters: [{ name: 'tipo', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Opciones ordenadas' }, 400: { description: 'Tipo inválido' } },
      },
    },
    '/catalogos': {
      get: { tags: ['Catálogos'], summary: 'Todos los catálogos para administrarlos (requiere configuracion.consultar)', responses: { 200: { description: 'Listado' } } },
      post: {
        tags: ['Catálogos'], summary: 'Agrega una opción a un catálogo (requiere configuracion.editar)',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['tipo', 'clave', 'etiqueta'], properties: { tipo: { type: 'string' }, clave: { type: 'string' }, etiqueta: { type: 'string' }, orden: { type: 'integer' } } } } } },
        responses: { 201: { description: 'Opción creada' }, 409: { description: 'Ya existe ese tipo y clave' } },
      },
    },
    '/catalogos/{id}': {
      put: {
        tags: ['Catálogos'], summary: 'Edita etiqueta u orden de una opción (requiere configuracion.editar)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { etiqueta: { type: 'string' }, orden: { type: 'integer' } } } } } },
        responses: { 200: { description: 'Opción actualizada' } },
      },
      delete: {
        tags: ['Catálogos'], summary: 'Elimina una opción (requiere configuracion.editar)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Opción eliminada' } },
      },
    },
    '/respaldos': {
      get: { tags: ['Respaldos'], summary: 'Lista los respaldos generados (solo super_admin)', responses: { 200: { description: 'Listado' } } },
      post: { tags: ['Respaldos'], summary: 'Genera un nuevo respaldo completo de la base de datos (solo super_admin)', responses: { 201: { description: 'Respaldo generado' } } },
    },
    '/respaldos/{id}/descargar': {
      get: { tags: ['Respaldos'], summary: 'Descarga un respaldo previamente generado', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Archivo .sql' } } },
    },
  },
};

module.exports = openapiSpec;
