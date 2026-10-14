-- ============================================================
-- Migración 021 — Inventario organizado por ÁREAS de la asociación.
--
-- Hasta ahora el inventario se organizaba por categorías libres
-- (Vestuario, Equipo y mobiliario, ...). Ahora el nivel principal son las
-- áreas reales de la asociación: las 30 áreas de labor oficiales más
-- "Control de Voluntariado". Las subáreas (antes "subcategorías") siguen
-- existiendo y son opcionales.
--
-- Qué hace, para CADA asociación:
--   1) Crea las 31 áreas que falten (no toca las que ya existen).
--   2) Reubica las dos categorías que traía el seed original:
--        Vestuario           -> subáreas de "Arte y Cultura"
--        Equipo y mobiliario -> subáreas de "Administrativa"
--      Los artículos que estaban en ellas pasan al área nueva sin perder su
--      subárea (Sombreros, Mobiliario, ...). Luego se elimina la categoría vacía.
--   3) Cualquier otra categoría creada a mano se deja intacta.
--
-- Es idempotente: se puede ejecutar más de una vez sin efectos extra.
-- Nota: UNIQUE (asociacion_id, categoria_padre_id, nombre) no detecta
-- duplicados cuando categoria_padre_id es NULL, por eso se usa NOT EXISTS.
-- ============================================================

DO $$
DECLARE
    areas TEXT[] := ARRAY[
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
    legadas  TEXT[] := ARRAY['Vestuario', 'Equipo y mobiliario'];
    destinos TEXT[] := ARRAY['Arte y Cultura', 'Administrativa'];
    asoc RECORD;
    area TEXT;
    i INT;
    v_vieja UUID;
    v_destino UUID;
BEGIN
    FOR asoc IN SELECT id FROM asociaciones LOOP
        -- 1) Áreas
        FOREACH area IN ARRAY areas LOOP
            INSERT INTO inventario_categorias (asociacion_id, nombre)
            SELECT asoc.id, area
            WHERE NOT EXISTS (
                SELECT 1 FROM inventario_categorias
                WHERE asociacion_id = asoc.id AND categoria_padre_id IS NULL AND nombre = area
            );
        END LOOP;

        -- 2) Reubicar las categorías legadas del seed original
        FOR i IN 1..array_length(legadas, 1) LOOP
            SELECT id INTO v_vieja FROM inventario_categorias
            WHERE asociacion_id = asoc.id AND categoria_padre_id IS NULL AND nombre = legadas[i];
            CONTINUE WHEN v_vieja IS NULL;

            SELECT id INTO v_destino FROM inventario_categorias
            WHERE asociacion_id = asoc.id AND categoria_padre_id IS NULL AND nombre = destinos[i];

            -- Sus subcategorías pasan a ser subáreas del área destino (si no chocan por nombre)
            UPDATE inventario_categorias c SET categoria_padre_id = v_destino
            WHERE c.categoria_padre_id = v_vieja
              AND NOT EXISTS (
                  SELECT 1 FROM inventario_categorias h
                  WHERE h.asociacion_id = asoc.id AND h.categoria_padre_id = v_destino AND h.nombre = c.nombre
              );

            -- Si alguna subcategoría chocó por nombre, sus artículos pasan a la subárea equivalente
            UPDATE inventario_articulos art SET subcategoria_id = h.id
            FROM inventario_categorias c, inventario_categorias h
            WHERE art.subcategoria_id = c.id AND c.categoria_padre_id = v_vieja
              AND h.categoria_padre_id = v_destino AND h.nombre = c.nombre;

            -- Los artículos de la categoría vieja pasan al área
            UPDATE inventario_articulos SET categoria_id = v_destino WHERE categoria_id = v_vieja;

            -- Ya vacía: se elimina (lo que no se pudo mover cae en cascada)
            DELETE FROM inventario_categorias WHERE id = v_vieja;
        END LOOP;
    END LOOP;
END $$;
