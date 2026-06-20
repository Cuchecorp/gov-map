# Conventions

Reglas mínimas del proyecto. Fuente de verdad; se sincroniza a `CLAUDE.md` (sección Conventions).

## Ingesta y Cron (regla arquitectónica — LOCKED)

1. **Ingesta en DOS ETAPAS, siempre separadas y re-ejecutables de forma independiente:**
   - **Etapa 1 — Fuentes → R2 (crudo):** todo lo descargado de una fuente (Cámara, Senado, BCN/LeyChile, leylobby, probidad, etc.) se persiste PRIMERO como **crudo inmutable en R2**, content-addressed: clave `fuente/recurso/fecha/sha256.ext`, PUT con `If-None-Match: *` (412 = ya existía = éxito idempotente).
   - **Etapa 2 — R2 → Supabase:** la carga/parseo a Supabase lee del **crudo en R2**, NUNCA de la fuente. Cualquier re-ingesta a Supabase (por error, cambio de schema, re-embed) se hace SIEMPRE desde R2.
   - **Por qué:** si Supabase falla o hay que reprocesar, NO se vuelve a molestar al servidor de la fuente. R2 es la verdad cruda versionada; Supabase es derivado y reconstruible desde R2.

2. **Hash-check ANTES de descargar (respeto al servidor):** verificar si el contenido ya está en R2 (clave content-addressed por sha256) y/o usar `ETag`/`If-None-Match`/`If-Modified-Since`. Si no cambió → NO re-descargar. Abortar temprano cuando no hay novedades.

3. **Respeto al servidor (reafirma PROJECT.md):** rate-limit 2–3s entre requests al mismo host, User-Agent identificatorio, respetar robots.txt, caché diaria. Nunca ráfagas.

4. **Backfill masivo = LOCAL** (corrida manual en la máquina del operador), NO GitHub Actions — minimiza minutos/costo de Actions. Idempotente y reanudable.

5. **Cron de novedades = diario, lunes a viernes**, minimizando minutos de cron: lotes acotados incrementales, solo novedades, hash-check primero para salir temprano cuando no hay cambios. Frecuencia/hora exactas: TBD (definir después). MONEY/SERVEL fuera del cron mientras estén gated.
