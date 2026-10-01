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

-- Categorías y subcategorías por defecto del inventario, según las áreas
-- reales de la asociación (danza y arte/cultura). Quedan editables desde
-- la propia UI: esto solo precarga un punto de partida razonable.
DO $$
DECLARE
    v_asociacion_id UUID;
    v_categoria_id UUID;
BEGIN
    SELECT id INTO v_asociacion_id FROM asociaciones
    WHERE nombre = 'Asociación Juvenil "Sueños de Comedia", A.C.' LIMIT 1;

    IF v_asociacion_id IS NOT NULL THEN
        -- Vestuario (danza)
        INSERT INTO inventario_categorias (asociacion_id, nombre)
        VALUES (v_asociacion_id, 'Vestuario')
        ON CONFLICT (asociacion_id, categoria_padre_id, nombre) DO NOTHING
        RETURNING id INTO v_categoria_id;
        IF v_categoria_id IS NULL THEN
            SELECT id INTO v_categoria_id FROM inventario_categorias
            WHERE asociacion_id = v_asociacion_id AND categoria_padre_id IS NULL AND nombre = 'Vestuario';
        END IF;
        INSERT INTO inventario_categorias (asociacion_id, nombre, categoria_padre_id) VALUES
            (v_asociacion_id, 'Sombreros', v_categoria_id),
            (v_asociacion_id, 'Vestidos y trajes', v_categoria_id),
            (v_asociacion_id, 'Calzado', v_categoria_id),
            (v_asociacion_id, 'Accesorios', v_categoria_id)
        ON CONFLICT (asociacion_id, categoria_padre_id, nombre) DO NOTHING;

        -- Arte y Cultura (teatro/escenografía)
        INSERT INTO inventario_categorias (asociacion_id, nombre)
        VALUES (v_asociacion_id, 'Arte y Cultura')
        ON CONFLICT (asociacion_id, categoria_padre_id, nombre) DO NOTHING
        RETURNING id INTO v_categoria_id;
        IF v_categoria_id IS NULL THEN
            SELECT id INTO v_categoria_id FROM inventario_categorias
            WHERE asociacion_id = v_asociacion_id AND categoria_padre_id IS NULL AND nombre = 'Arte y Cultura';
        END IF;
        INSERT INTO inventario_categorias (asociacion_id, nombre, categoria_padre_id) VALUES
            (v_asociacion_id, 'Escenografía', v_categoria_id),
            (v_asociacion_id, 'Utilería de teatro', v_categoria_id),
            (v_asociacion_id, 'Instrumentos musicales', v_categoria_id),
            (v_asociacion_id, 'Iluminación y sonido', v_categoria_id)
        ON CONFLICT (asociacion_id, categoria_padre_id, nombre) DO NOTHING;

        -- Equipo y mobiliario general
        INSERT INTO inventario_categorias (asociacion_id, nombre)
        VALUES (v_asociacion_id, 'Equipo y mobiliario')
        ON CONFLICT (asociacion_id, categoria_padre_id, nombre) DO NOTHING
        RETURNING id INTO v_categoria_id;
        IF v_categoria_id IS NULL THEN
            SELECT id INTO v_categoria_id FROM inventario_categorias
            WHERE asociacion_id = v_asociacion_id AND categoria_padre_id IS NULL AND nombre = 'Equipo y mobiliario';
        END IF;
        INSERT INTO inventario_categorias (asociacion_id, nombre, categoria_padre_id) VALUES
            (v_asociacion_id, 'Mobiliario', v_categoria_id),
            (v_asociacion_id, 'Equipo de oficina', v_categoria_id),
            (v_asociacion_id, 'Limpieza', v_categoria_id)
        ON CONFLICT (asociacion_id, categoria_padre_id, nombre) DO NOTHING;
    END IF;
END $$;

-- Usuario super_admin inicial
-- Contraseña temporal: Sigevac#2026  (se debe cambiar en el primer login)
-- El hash se genera en tiempo de seed real vía script Node (ver seeds/run.js);
-- este INSERT se deja documentado como referencia y NO se ejecuta con hash fijo en producción.
