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
    ('auditoria.consultar',   'auditoria',    'Ver bitácora y auditoría'),
    ('actividades.crear',      'actividades',  'Crear y editar actividades'),
    ('actividades.consultar',  'actividades',  'Ver actividades y sus participantes'),
    ('participaciones.gestionar', 'participaciones', 'Inscribir voluntarios y registrar asistencia/horas'),
    ('credenciales.generar',   'credenciales', 'Generar o regenerar credencial digital y QR'),
    ('configuracion.consultar','configuracion','Ver configuración del sistema'),
    ('respaldos.gestionar',    'respaldos',    'Generar, listar y descargar respaldos de la base de datos'),
    ('inventario.consultar',   'inventario',   'Ver artículos, categorías, préstamos y mantenimientos del inventario'),
    ('inventario.gestionar',   'inventario',   'Crear/editar artículos, categorías, movimientos, préstamos y mantenimientos del inventario'),
    ('galeria.consultar',      'galeria',      'Ver las fotos de la galería pública, incluidas las ocultas'),
    ('galeria.gestionar',      'galeria',      'Subir, editar, ocultar y eliminar fotos de la galería pública')
ON CONFLICT (clave) DO NOTHING;

-- Asignación de permisos a roles: super_admin recibe todos
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p WHERE r.nombre = 'super_admin'
ON CONFLICT DO NOTHING;

-- presidente: todo menos configuración/usuarios eliminar
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'presidente'
  AND p.clave NOT IN ('configuracion.editar', 'usuarios.eliminar', 'respaldos.gestionar')
ON CONFLICT DO NOTHING;

-- coordinador: gestión operativa de voluntarios/expedientes/actividades
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'coordinador'
  AND p.clave IN ('voluntarios.crear','voluntarios.editar','voluntarios.consultar',
                   'expedientes.aprobar','expedientes.consultar','reportes.consultar',
                   'asociacion.consultar','actividades.crear','actividades.consultar',
                   'participaciones.gestionar','credenciales.generar',
                   'inventario.consultar','inventario.gestionar',
                   'galeria.consultar','galeria.gestionar')
ON CONFLICT DO NOTHING;

-- capturista: captura sin aprobar
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'capturista'
  AND p.clave IN ('voluntarios.crear','voluntarios.editar','voluntarios.consultar',
                   'expedientes.consultar','actividades.consultar','participaciones.gestionar',
                   'inventario.consultar')
ON CONFLICT DO NOTHING;

-- supervisor
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'supervisor'
  AND p.clave IN ('voluntarios.consultar','expedientes.consultar','reportes.consultar',
                   'actividades.consultar','participaciones.gestionar','inventario.consultar',
                   'galeria.consultar')
ON CONFLICT DO NOTHING;

-- consulta: solo lectura
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'consulta'
  AND p.clave LIKE '%.consultar'
  AND p.clave <> 'auditoria.consultar'
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

-- Inventario organizado por ÁREAS: las 30 áreas de labor oficiales de la
-- asociación más "Control de Voluntariado". Las subáreas son opcionales; aquí
-- solo se precargan unas pocas como punto de partida. Todo es editable desde la
-- UI. (Ver también la migración 021, que hace lo mismo sobre bases existentes.)
DO $$
DECLARE
    v_asociacion_id UUID;
    v_area_id UUID;
    v_area TEXT;
    v_areas TEXT[] := ARRAY[
        'Administrativa', 'Administración Estratégica', 'Apoyo al Comercio y Emprendimiento',
        'Arte y Cultura', 'Asesoría Jurídica', 'Asuntos Lingüísticos', 'Bibliotecas',
        'Centros de Desarrollo Integral Comunitarios HUITZILIN', 'Ciencia y Tecnología',
        'Comunicación', 'Control de Voluntariado', 'Deporte', 'Derechos Humanos',
        'Desarrollo Rural', 'Difusión Gastronómica', 'Diseño de Moda e Imagen Integral',
        'Diversidad Sexual', 'Educación', 'Inclusión y Participación Cívica',
        'Programación de Servicio Social y Prácticas Profesionales', 'Promoción',
        'Pueblos y Barrios Originarios', 'Recreación', 'Recursos Naturales y Medio Ambiente',
        'Relaciones Públicas', 'Salud', 'Seguridad, Prevención y Protección Civil', 'Sistemas',
        'Trabajo Social', 'Vinculación y Empleabilidad'
    ];
BEGIN
    SELECT id INTO v_asociacion_id FROM asociaciones
    WHERE nombre = 'Asociación Juvenil "Sueños de Comedia", A.C.' LIMIT 1;

    IF v_asociacion_id IS NOT NULL THEN
        FOREACH v_area IN ARRAY v_areas LOOP
            INSERT INTO inventario_categorias (asociacion_id, nombre)
            SELECT v_asociacion_id, v_area
            WHERE NOT EXISTS (
                SELECT 1 FROM inventario_categorias
                WHERE asociacion_id = v_asociacion_id AND categoria_padre_id IS NULL AND nombre = v_area
            );
        END LOOP;

        -- Subáreas de ejemplo: vestuario y escenografía (Arte y Cultura)
        SELECT id INTO v_area_id FROM inventario_categorias
        WHERE asociacion_id = v_asociacion_id AND categoria_padre_id IS NULL AND nombre = 'Arte y Cultura';
        INSERT INTO inventario_categorias (asociacion_id, nombre, categoria_padre_id) VALUES
            (v_asociacion_id, 'Sombreros', v_area_id),
            (v_asociacion_id, 'Vestidos y trajes', v_area_id),
            (v_asociacion_id, 'Calzado', v_area_id),
            (v_asociacion_id, 'Accesorios', v_area_id),
            (v_asociacion_id, 'Escenografía', v_area_id),
            (v_asociacion_id, 'Utilería de teatro', v_area_id),
            (v_asociacion_id, 'Instrumentos musicales', v_area_id),
            (v_asociacion_id, 'Iluminación y sonido', v_area_id)
        ON CONFLICT (asociacion_id, categoria_padre_id, nombre) DO NOTHING;

        -- Subáreas de ejemplo: equipo general (Administrativa)
        SELECT id INTO v_area_id FROM inventario_categorias
        WHERE asociacion_id = v_asociacion_id AND categoria_padre_id IS NULL AND nombre = 'Administrativa';
        INSERT INTO inventario_categorias (asociacion_id, nombre, categoria_padre_id) VALUES
            (v_asociacion_id, 'Mobiliario', v_area_id),
            (v_asociacion_id, 'Equipo de oficina', v_area_id),
            (v_asociacion_id, 'Limpieza', v_area_id)
        ON CONFLICT (asociacion_id, categoria_padre_id, nombre) DO NOTHING;
    END IF;
END $$;

-- Usuario super_admin inicial
-- Contraseña temporal: Sigevac#2026  (se debe cambiar en el primer login)
-- El hash se genera en tiempo de seed real vía script Node (ver seeds/run.js);
-- este INSERT se deja documentado como referencia y NO se ejecuta con hash fijo en producción.
