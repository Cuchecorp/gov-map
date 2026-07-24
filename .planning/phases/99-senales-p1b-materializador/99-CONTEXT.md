# Phase 99: SEÑALES P1b — Materializador `actualidad_senal` + RPCs bounded + cron intradía - Context

**Gathered:** 2026-07-24
**Status:** Ready for planning
**Mode:** Autonomous (backend/migration — decisions locked by 98-SPIKE-FINDINGS)

<domain>
## Phase Boundary

Precomputar offline (SQL puro + clustering TS) las señales HONESTAS validadas en el SPIKE (Phase 98) y servirlas a la landing como filas listas en `actualidad_senal`, vía RPCs bounded PII-safe allowlisted — cero agregación cara on-read en la página más visitada. Incluye: migración aditiva (tabla + proc full-rebuild espejo `cruce_senal`/0039 + `materializar_cruces()`), RPCs bounded (aguja completa >0044: cero-grant + security-definer + PUBLIC_RPC_ALLOWLIST + LIMIT + statement_timeout), clustering k-means determinista seed-fija sobre embeddings 768d (label = `materia` oficial + capa secundaria, JAMÁS LLM), y el scheduler intradía L-V (SQL → pg_cron; lógica TS → CLI en GH Actions nuevo, clona leyes-weekly SIN R2, NO toca fuentes → sin rate-limit), + pgTAP.

NO construye frontend (Phase 100). NO ingiere leyes publicadas (SEN-06 diferido). NO enciende flags de régimen.

</domain>

<decisions>
## Implementation Decisions

### Señales a materializar (del 98-SPIKE-FINDINGS §1 — LOCKED, contrato)
Materializar SOLO las HONESTAS, cada una con su guarda de supresión:
- **velocity** (HONESTA): "N trámites en 7 días", nunca "top/los más".
- **nuevos ingresos** (HONESTA-CONDICIONAL): vía primer-evento por boletín, EXCLUIR primer-evento pre-2022, declarar cobertura "2022-2026"; JAMÁS derivar de `fecha_captura`.
- **urgencias vivas** (HONESTA): evento de urgencia FECHADO ("urgencia calificada el DD/MM"), nunca "urgencia vigente" ni juicio.
- **agenda próxima** (HONESTA): `citacion` filas futuras reales; `sesion_sala` sin futuras → SUPRIMIR ("sin sesiones agendadas en las fuentes consultadas"). Reusar lógica tz Chile de `/agenda` (date-only UTC = día chileno — gotcha LOCKED, jamás convertir tz).
- **archivados/retirados** (HONESTA-CON-CAVEAT): filtrar por `descripcion` fechada, NO por `proyecto.estado`; distinguir "Desarchivo"/"retira y hace presente" (invierten sentido); "movimiento de archivo/retiro" fechado, no "proyectos archivados".
- **agrupación por materia** (SEN-05): `proyecto.materia` (text, taxonomía oficial) = label PRIMARIO; k-means seed-fija sobre embeddings = capa SECUNDARIA. Labels JAMÁS LLM.

### Defectos de datos LOCKED (98-SPIKE-FINDINGS §2 — aplicar en TODA agregación)
1. Filtrar `fecha <= current_date` en TODO max(fecha)/ventana (mata 2 filas `fecha='2626-05-25'`).
2. Normalizar `camara` por regex `regexp_replace(camara,'\s+','','g')` antes de agrupar (dos grafías: `C.Diputados` / `C. Diputados`).
3. `camara IS NULL` (2.261 filas) → "(sin cámara)" o excluido de cortes por cámara; NUNCA repartido.

### Regla del reloj + supresión (98-SPIKE-FINDINGS §3/§4 — LOCKED)
- Toda señal temporal ancla a `tramitacion_evento.fecha` (reloj real), NUNCA `fecha_captura` (solo frescura + hash-check).
- Supresión por frescura: si `max(fecha)` de una fuente supera umbral stale → "sin datos frescos de esta fuente", JAMÁS "sin movimiento". Ausencia ≠ hecho.
- Sesgo de cobertura por cámara declarado por señal; PROHIBIDO ranking cross-cámara por conteo (T-52-13).

### Arquitectura (LOCKED)
- `actualidad_senal` = TABLA precomputada (NO materialized view — evita lock de REFRESH no-concurrente en la superficie más visitada). Proc full-rebuild transaccional espejo `materializar_cruces()`/0039.
- Cómputo SQL puro (velocity, urgencias, agenda, archivados, materia-label) → pg_cron. Clustering k-means (lógica TS sobre embeddings existentes) → CLI en workspace `@obs/*` corrido por GH Actions nuevo intradía L-V (clona el YAML de leyes-weekly SIN R2; NO toca fuentes → sin rate-limit). El cron refresca la AGREGACIÓN interna, no re-scrapea.
- RPCs bounded = AGUJA COMPLETA: migración >0064, cero-grant por default, SECURITY DEFINER PII-safe, alta en `PUBLIC_RPC_ALLOWLIST`, `LIMIT` explícito + `statement_timeout` (5s), `.order().range()` si pagina. Espeja patrón 0064.
- Migraciones por `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f` (NUNCA `db push`). pgTAP en `supabase/tests/00XX_actualidad_senal.test.sql` espejo `0039_cruce_senal.test.sql`: verifica ninguna fila `fecha>current_date` alimenta señal, `camara` normalizada, supresión por frescura dispara.

### Claude's Discretion
Nº de migración exacto, esquema fino de columnas de `actualidad_senal` (tipo de señal, ventana, conteo, cobertura, cámara, materia, cluster_id, freshness, fecha_max, supresión_causa), k de k-means (research recomienda 8-15), nombre del CLI/YAML, forma exacta de las RPCs. Preferir espejar 0039/0064 al pie de la letra.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `cruce_senal` (tabla) + `materializar_cruces()` (proc full-rebuild transaccional) / migración 0039 = patrón espejo directo.
- RPCs bounded allowlisted patrón 0064 (9 RPCs bounded, PUBLIC_RPC_ALLOWLIST, statement_timeout) — copiar la forma.
- Embeddings 768d de v6.1 YA existen (columna vector en proyecto/idea). k-means seed-fija sobre ellos.
- pg_cron + GH Actions YA configurados (leyes-weekly.yml, agenda-weekly.yml = plantillas de cron; run-tramitacion-prod-cli = patrón CLI de refresh).
- lockdown-guard: PUBLIC_RPC_ALLOWLIST + Direction-B + crossLinkReader — la RPC nueva DEBE entrar al allowlist o el guard muerde.
- Lógica tz Chile de `/agenda` (citacion.fecha date-only UTC = día chileno).
- 98-SPIKE-FINDINGS.md + skill spike-findings-98 (on-disk) = el gate; consumirlos.

### Established Patterns
- Migración: `supabase/migrations/00XX_*.sql`, aplicar por psql --single-transaction, pgTAP con filtro pg_depend extension.
- Suite: app 1252 + packages + tsc --noEmit + pnpm audit 0 verdes al cierre.
- CLI workspace `@obs/*` con pipeline por argumentos explícitos; PostgREST cap 1k (paginar).

### Integration Points
- `actualidad_senal` la lee Phase 100 (panel) vía las RPCs bounded de esta fase.
- El proc/CLI corre en pg_cron (SQL) + GH Actions (TS clustering); no toca fuentes gov.

</code_context>

<specifics>
## Specific Ideas

- Los 4 success criteria del ROADMAP son el contrato; cada señal materializada trae su columna de cobertura/frescura para que Phase 100 pueda declarar/suprimir.
- Requisitos: SEN-02 (materializador+RPCs), SEN-03 (señales factuales), SEN-04 (supresión+sesgo declarado), SEN-05 (agrupación por materia+cluster no-LLM).
- k-means determinista: seed fija, k en [8,15], sobre embeddings existentes; el label del cluster = moda de `materia`/comisión (SQL `mode()`), no texto generado.

</specifics>

<deferred>
## Deferred Ideas

- Landing panel / BentoGrid / benchmark BrowserOS → Phase 100.
- Ingesta leyes publicadas (conector Cámara dos-etapas) → fase futura SEN-06.
- Similitud de voto → Phase 102.

</deferred>
