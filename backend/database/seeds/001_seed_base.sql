-- ============================================================
-- SIGEVAC - Datos semilla iniciales
-- ============================================================

-- Roles (Módulo 2)
INSERT INTO roles (nombre, descripcion) VALUES
    ('super_admin',   'Acceso total al sistema, incluida configuración y respaldos'),
    ('presidente',    'Visión general de la asociación, aprueba expedientes y reportes'),
    ('coordinador',   'Administra voluntarios, expedientes y actividades'),
    ('capturista',    'Captura y carga información de voluntarios y documentos'),
    ('supervisor',    'Supervisa actividades y participación, sin edición de configuración'),
    ('consulta',      'Solo lectura de reportes e indicadores')
ON CONFLICT (nombre) DO NOTHING;

-- Permisos base por módulo (se puede ampliar conforme se implementen módulos)
INSERT INTO permisos (clave, modulo, descripcion) VALUES
    ('usuarios.crear',        'usuarios',     'Crear usuarios del sistema'),
    ('usuarios.editar',       'usuarios',     'Editar usuarios del sistema'),
    ('usuarios.eliminar',     'usuarios',     'Eliminar/desactivar usuarios'),
    ('usuarios.consultar',    'usuarios',     'Ver listado de usuarios'),
    ('asociacion.editar',     'asociacion',   'Editar datos de la asociación'),
    ('asociacion.consultar',  'asociacion',   'Ver datos de la asociación'),
    ('voluntarios.crear',     'voluntarios',  'Registrar voluntarios'),
    ('voluntarios.editar',    'voluntarios',  'Editar voluntarios'),
    ('voluntarios.eliminar',  'voluntarios',  'Eliminar/desactivar voluntarios'),
    ('voluntarios.consultar', 'voluntarios',  'Ver listado de voluntarios'),
    ('expedientes.aprobar',   'expedientes',  'Aprobar/rechazar documentos de expediente'),
    ('expedientes.consultar', 'expedientes',  'Ver expedientes'),
    ('reportes.consultar',    'reportes',     'Ver y exportar reportes'),
    ('configuracion.editar',  'configuracion','Editar configuración del sistema'),
    ('auditoria.consultar',   'auditoria',    'Ver bitácora y auditoría')
ON CONFLICT (clave) DO NOTHING;

-- Asignación de permisos a roles: super_admin recibe todos
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p WHERE r.nombre = 'super_admin'
ON CONFLICT DO NOTHING;

-- presidente: todo menos configuración/usuarios eliminar
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'presidente'
  AND p.clave NOT IN ('configuracion.editar', 'usuarios.eliminar')
ON CONFLICT DO NOTHING;

-- coordinador: gestión operativa de voluntarios/expedientes/actividades
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'coordinador'
  AND p.clave IN ('voluntarios.crear','voluntarios.editar','voluntarios.consultar',
                   'expedientes.aprobar','expedientes.consultar','reportes.consultar',
                   'asociacion.consultar')
ON CONFLICT DO NOTHING;

-- capturista: captura sin aprobar
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'capturista'
  AND p.clave IN ('voluntarios.crear','voluntarios.editar','voluntarios.consultar',
                   'expedientes.consultar')
ON CONFLICT DO NOTHING;

-- supervisor
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'supervisor'
  AND p.clave IN ('voluntarios.consultar','expedientes.consultar','reportes.consultar')
ON CONFLICT DO NOTHING;

-- consulta: solo lectura
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'consulta'
  AND p.clave LIKE '%.consultar'
ON CONFLICT DO NOTHING;

-- Tipos de voluntario (Módulo 5)
INSERT INTO tipos_voluntario (clave, etiqueta) VALUES
    ('mayor_edad',      'Mayor de edad'),
    ('menor_edad',      'Menor de edad'),
    ('servicio_social', 'Servicio Social'),
    ('residencia',      'Residencia Profesional'),
    ('temporal',        'Voluntario Temporal'),
    ('permanente',      'Voluntario Permanente'),
    ('coordinador',     'Coordinador'),
    ('instructor',      'Instructor')
ON CONFLICT (clave) DO NOTHING;

-- Tipos de documento (Módulo 7)
INSERT INTO tipos_documento (clave, etiqueta, aplica_a, tiene_vigencia) VALUES
    ('curp',                 'CURP',                                'ambos', false),
    ('ine',                  'INE',                                 'mayor', true),
    ('comprobante_domicilio','Comprobante de domicilio',            'ambos', true),
    ('seguro',               'Seguro',                              'ambos', true),
    ('ficha_voluntariado',   'Ficha de voluntariado',                'mayor', false),
    ('carta_responsiva',     'Carta responsiva',                    'mayor', false),
    ('aviso_privacidad',     'Aviso de privacidad',                 'ambos', false),
    ('reglamento_interno',   'Reglamento interno',                  'ambos', false),
    ('uso_imagen',           'Uso de imagen',                       'ambos', false),
    ('ine_tutor',            'INE del tutor',                       'menor', true),
    ('carta_autorizacion',   'Carta de autorización del tutor',     'menor', false)
ON CONFLICT (clave) DO NOTHING;

-- Catálogo: tipo de sangre y parentesco
INSERT INTO catalogos (tipo, clave, etiqueta, orden) VALUES
    ('tipo_sangre', 'o_positivo',  'O+',  1),
    ('tipo_sangre', 'o_negativo',  'O-',  2),
    ('tipo_sangre', 'a_positivo',  'A+',  3),
    ('tipo_sangre', 'a_negativo',  'A-',  4),
    ('tipo_sangre', 'b_positivo',  'B+',  5),
    ('tipo_sangre', 'b_negativo',  'B-',  6),
    ('tipo_sangre', 'ab_positivo', 'AB+', 7),
    ('tipo_sangre', 'ab_negativo', 'AB-', 8),
    ('parentesco', 'madre',   'Madre', 1),
    ('parentesco', 'padre',   'Padre', 2),
    ('parentesco', 'tutor',   'Tutor legal', 3),
    ('parentesco', 'abuelo',  'Abuelo/a', 4),
    ('parentesco', 'hermano', 'Hermano/a mayor de edad', 5)
ON CONFLICT (tipo, clave) DO NOTHING;

-- Estado y municipio base (Puebla, para Tehuacán / Sueños de Comedia)
INSERT INTO estados_mx (nombre) VALUES ('Puebla') ON CONFLICT (nombre) DO NOTHING;
INSERT INTO municipios (estado_id, nombre)
SELECT id, 'Tehuacán' FROM estados_mx WHERE nombre = 'Puebla'
ON CONFLICT DO NOTHING;

-- Asociación: Sueños de Comedia A.C.
INSERT INTO asociaciones (nombre, municipio, estado, correo)
VALUES ('Asociación Juvenil "Sueños de Comedia", A.C.', 'Tehuacán', 'Puebla', 'contacto@suenosdecomedia.org')
ON CONFLICT DO NOTHING;

-- Usuario super_admin inicial
-- Contraseña temporal: Sigevac#2026  (se debe cambiar en el primer login)
-- El hash se genera en tiempo de seed real vía script Node (ver seeds/run.js);
-- este INSERT se deja documentado como referencia y NO se ejecuta con hash fijo en producción.
