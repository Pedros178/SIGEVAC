-- Módulo de gamificación: insignias por horas de servicio, actividades
-- completadas, antigüedad y constancia (rachas mensuales). Pensado para
-- reforzar la retención de voluntarios dando reconocimiento visible por
-- su trayectoria dentro de la asociación.

CREATE TABLE IF NOT EXISTS insignias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clave VARCHAR(60) NOT NULL UNIQUE,
    nombre VARCHAR(120) NOT NULL,
    descripcion VARCHAR(300) NOT NULL,
    icono VARCHAR(10) NOT NULL DEFAULT '🏅',
    -- horas_totales | actividades_completadas | antiguedad_meses | racha_meses
    criterio_tipo VARCHAR(30) NOT NULL,
    criterio_valor NUMERIC(8,2) NOT NULL,
    orden SMALLINT NOT NULL DEFAULT 0,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS voluntario_insignias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voluntario_id UUID NOT NULL REFERENCES voluntarios(id) ON DELETE CASCADE,
    insignia_id UUID NOT NULL REFERENCES insignias(id) ON DELETE CASCADE,
    obtenida_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (voluntario_id, insignia_id)
);

CREATE INDEX IF NOT EXISTS idx_voluntario_insignias_voluntario ON voluntario_insignias(voluntario_id);

INSERT INTO insignias (clave, nombre, descripcion, icono, criterio_tipo, criterio_valor, orden) VALUES
    ('primeros_pasos',   'Primeros pasos',          'Completó su primera actividad de voluntariado.',           '🎯', 'actividades_completadas', 1,   1),
    ('comprometido_10h', 'Comprometido',            'Acumuló 10 horas de servicio.',                             '🕐', 'horas_totales',           10,  2),
    ('activo_5act',      'Voluntario activo',       'Completó 5 actividades.',                                   '🌟', 'actividades_completadas', 5,   3),
    ('veterano_50h',     'Veterano',                'Acumuló 50 horas de servicio.',                             '🥈', 'horas_totales',           50,  4),
    ('pilar_10act',      'Pilar de la asociación',  'Completó 10 actividades.',                                  '💪', 'actividades_completadas', 10,  5),
    ('racha_3m',         'Racha de 3 meses',        'Participó en al menos una actividad durante 3 meses seguidos.', '🔥', 'racha_meses',         3,   6),
    ('un_anio',          'Un año contigo',          'Cumplió un año como voluntario de la asociación.',          '🎂', 'antiguedad_meses',       12,  7),
    ('leyenda_100h',     'Leyenda del servicio',    'Acumuló 100 horas de servicio.',                            '🏆', 'horas_totales',           100, 8)
ON CONFLICT (clave) DO NOTHING;
