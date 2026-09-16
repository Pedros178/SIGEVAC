-- ============================================================
-- Migración 017 — Vigencia automática opcional para fotos/carteles
-- de la galería pública.
--
-- Antes, ocultar una foto de temporada (p. ej. un cartel de convocatoria
-- con fecha de cierre) era 100% manual: alguien tenía que acordarse de
-- entrar a Administración → Galería y "Ocultar" el día que ya no aplicaba.
-- Con `vigente_hasta`, un cartel puede llevar una fecha de cierre y el
-- Home público deja de mostrarlo solo, automáticamente, sin que nadie
-- tenga que hacer nada. Es opcional: una foto sin `vigente_hasta` se
-- comporta exactamente igual que antes (solo depende de `publicada`).
--
-- Uso: solo necesaria si ya tienes una base de datos SIGEVAC creada
-- ANTES de este cambio. Si vas a correr `npm run db:setup` sobre una
-- base de datos nueva, este archivo NO es necesario: schema.sql ya
-- incluye estos cambios desde el inicio.
--
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- ============================================================

ALTER TABLE galeria_publica ADD COLUMN IF NOT EXISTS vigente_hasta DATE;

-- Acelera el filtro `vigente_hasta IS NULL OR vigente_hasta >= CURRENT_DATE`
-- que corre en cada carga del Home público (galeriaModel.listarPublica).
CREATE INDEX IF NOT EXISTS idx_galeria_vigente_hasta ON galeria_publica(vigente_hasta)
    WHERE vigente_hasta IS NOT NULL;
