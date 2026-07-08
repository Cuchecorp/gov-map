---
phase: 49-acomp-comparativo-de-ausencias-vs-c-mara
plan: 03
subsystem: deploy-checkpoint-operador
tags: [deploy, cloudflare, smoke, degrade-honesto, screenshots, checkpoint-operador, ddl-gated, viz-03]
requires:
  - "RPC tasa_ausencia_comparada(text) + pgTAP 0050 — ESCRITAS (Plan 01, no aplicadas)"
  - "AusenciasContexto sub-bloque + fetch/degrade/montaje cableado (Plan 02, commits 1861a3c/9288cef/1b6dfcb)"
  - "RPC cruces_de_proyecto(text) + pgTAP 0049 — ESCRITAS (F38 Plan 01, no aplicadas)"
provides:
  - "PROD redeployado (versión cb853486) con el sub-bloque 'Ausencias en contexto' degradando honesto pre-apply"
  - "Evidencia pre-apply: Temp/ausencias-contexto-49-evidencia.png (D1012, detalle Votaciones expandido, comparativo ausente)"
  - "Checkpoint operador CONSOLIDADO: comando exacto de apply 0049 + 0050 + schema_migrations + ambos pgTAP + veredicto visual de ambas superficies"
affects:
  - "Operador: aplicar 0049 + 0050 a PROD → la sección de cruces (F38) y el comparativo (F49) pasan de degrade→null a montados con datos"
tech-stack:
  added: []
  patterns:
    - "Deploy patrón caliente: docker-cf-build.sh (OpenNext Linux) → docker cp → wrangler deploy (OAuth host, MSYS_NO_PATHCONV UNSET para wrangler)"
    - "Screenshot iframe SAME-ORIGIN + click del trigger Radix 'Ver detalle (N)' in-process para rasterizar el detalle colapsado de Votaciones (reshot-votos.mjs de 47-02)"
    - "Degrade honesto verificado por AUSENCIA del heading 'Ausencias en contexto' + del caveat, con 'Cómo votó' (capa-1) y 'Cuándo votó' (F47) presentes, sin 500"
key-files:
  created:
    - Temp/ausencias-contexto-49-evidencia.png
  modified: []
decisions:
  - "El degrade honesto pre-apply se prueba por la AUSENCIA del heading 'Ausencias en contexto' (count 0) + del caveat 'Sobre las votaciones ingestadas' (count 0), con 'Cómo votó' (count 1) y 'Cuándo votó' F47 (count 1) presentes: el comparativo se omite (PGRST202) sin romper capa-1 ni el resto del detalle"
  - "El agente JAMÁS aplicó DDL (T-49-09): apply de 0049+0050 = checkpoint:human-verify BLOCKING consolidado; la única prueba válida del DDL es el pgTAP post-apply contra el schema aplicado"
  - "Gate verde (719/719 + tsc exit 0) ANTES del deploy (T-49-10): no se desplegó sobre rojo (floor 712 superado por +7 de los RTL de 49-02)"
  - "Deploy caliente en Docker Linux (Windows worker roto 500ea) — versión cb853486 al 100%"
metrics:
  duration_min: 18
  tasks: 2
  files: 1
  completed: "2026-07-08T04:00:00Z"
---

# Phase 49 Plan 03: Deploy + smoke + checkpoint operador CONSOLIDADO Summary

Gate completo verde (719/719 + tsc exit 0), redeploy del frontend a PROD con el patrón
caliente (docker-cf-build.sh + wrangler, versión `cb853486`), smoke que confirma el
**degrade honesto pre-apply** (el sub-bloque "Ausencias en contexto" se omite sin 500
porque la RPC 0050 aún no existe, capa-1 + el chart F47 intactos), evidencia visual
capturada con helper same-origin, y el **único checkpoint operador CONSOLIDADO** que
entrega el comando EXACTO de apply de AMBAS migraciones (0049 cruces-de-proyecto +
0050 tasa-ausencia-comparada), ambos pgTAP contra el schema aplicado, y el veredicto
visual de ambas superficies. El agente NUNCA aplicó DDL.

## What Was Built

### Task 1 — Gate completo + redeploy + smoke + evidencia (auto, commit b093227)

- **Gate verde ANTES del deploy:** `npx vitest run` desde `app/` → **719/719 verde**
  (68 files; lockdown-guard 8/8 con `tasa_ausencia_comparada` en allowlist y el
  banned-vocab extendido `top/más ausente/peor/mejor asistencia/récord` incluidos en la
  suite). Baseline 712 superado por +7 de los RTL de 49-02, nunca menos. `npx tsc
  --noEmit` desde `app/` → **exit 0** (limpio). No se tocó el deploy hasta ambos verdes
  (T-49-10 mitigado: cero deploy sobre rojo).
- **Deploy (patrón caliente 47-02/38-03):** build OpenNext en Docker Linux vía
  `docker-cf-build.sh` (contenedor `obs-cf-build`, `docker rm -f` previo → `docker run
  node:22-bookworm`, `MSYS_NO_PATHCONV=1` para el mount `/host`), `rm -rf app/.open-next`
  → `docker cp` de `.open-next` al host → `npx wrangler deploy` desde `app/`
  (`MSYS_NO_PATHCONV` UNSET para wrangler; OAuth host vivo, `wrangler whoami` OK).
  **Versión desplegada: `cb853486-4593-4a35-a2d7-3b6312464aba` al 100%** (creada
  2026-07-08T03:52:00Z, confirmada con `wrangler deployments status`).
- **Smoke (curl PROD `https://observatorio-congreso.thevalis.workers.dev`):** `/`,
  `/parlamentarios`, `/parlamentario/D1012`, `/proyecto/14309-04`, `/agenda` → **todos
  200**, sin `internal server error`/`application error`.
- **Degrade honesto verificado en PROD (`/parlamentario/D1012`):** heading
  `Ausencias en contexto` **AUSENTE** (grep count 0), caveat `Sobre las votaciones
  ingestadas` **AUSENTE** (count 0), `Mediana de su cámara` **AUSENTE** (count 0) — el
  comparativo se omite por PGRST202 (RPC 0050 inexistente pre-apply). `Cómo votó`
  **presente** (count 1, capa-1 intacta) y `Cuándo votó` F47 **presente** (count 1). El
  documento cierra limpio (`</html>`); cero 500. Capa-1 byte-identical, degrade contenido
  dentro del detalle colapsado.
- **Evidencia visual:** helper same-origin `Temp/reshot-votos.mjs` (47-02) — harness
  navegado a la página PROD de D1012, iframe same-origin al `#votos`, click del trigger
  `Ver detalle (141)` in-process (`expand: CLICKED:Ver detalle (141)`), Recharts
  rasterizado (`recharts:yes`, contentH 5683). **`Temp/ausencias-contexto-49-evidencia.png`**
  (822 KB) — ficha `Boris Barrera Moreno` (D1012) con el detalle de Votaciones EXPANDIDO:
  chart "Cuándo votó" (F47) + "Cómo votó" + lista de votos íntegra, y el sub-bloque
  "Ausencias en contexto" **ausente** (evidencia visual del degrade honesto pre-apply).

## Números PROD del comparativo (para el veredicto visual post-apply)

De 49-01-SUMMARY (verificado por psql READ-ONLY contra PROD, simulación inline del cuerpo
de la RPC):

| Hecho (D1012) | Valor |
|---------------|-------|
| N (ausencias confirmadas) | **1** |
| M (votaciones confirmadas) | **141** |
| tasa_propia (N/M) | **0.007092** → **0,7%** (es-CL, 1 decimal) |
| mediana de la cámara (diputados) | **0.007353** → **0,7%** |
| K (diputados con ≥1 voto confirmado) | **155** |

Post-apply el sub-bloque debe leer: **"Ausente en 1 de 141 votaciones (0,7%). · Mediana
de su cámara: 0,7% (155 parlamentarios). · Sobre las votaciones ingestadas por este
observatorio, no la historia completa."** Cero adjetivo/color-veredicto (el % nunca
coloreado, LOCKED).

## Verification

- `npx vitest run` → 719/719 verde; `npx tsc --noEmit` → exit 0 (ANTES del deploy).
- `wrangler deployments status` → `cb853486` al 100% (2026-07-08T03:52:00Z).
- curl smoke 5 rutas → 200; heading `Ausencias en contexto` count 0, caveat count 0,
  `Mediana de su cámara` count 0; `Cómo votó` count 1, `Cuándo votó` count 1; sin 500;
  HTML cierra limpio.
- `Temp/ausencias-contexto-49-evidencia.png` existe (822 KB); inspección visual confirma
  ficha D1012 íntegra + detalle expandido + comparativo ausente (degrade honesto).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `save_screenshot` escribe al perfil BrowserOS, no al repo**
- **Found during:** Task 1 (captura de evidencia).
- **Issue:** `save_screenshot` con `path: "Temp/…"` reportó `SHOT_OK` pero escribió el PNG
  bajo `C:\Users\Carlo\AppData\Local\Chromium\User Data\.browseros\Temp\`, no en el repo
  (mismo gotcha documentado en 47-02).
- **Fix:** copiar el PNG desde el directorio del perfil BrowserOS a
  `Temp/ausencias-contexto-49-evidencia.png` del repo tras el shot.
- **Files modified:** Temp/ausencias-contexto-49-evidencia.png (copiado al repo).
- **Verification:** `ls -la` → 822 KB; `git check-ignore` → NOT_IGNORED; commiteado en b093227.

---

**Total deviations:** 1 auto-fixed (blocking de tooling/entorno, cero cambio de producto).
**Impact on plan:** cero scope creep — solo la mecánica de captura de evidencia; el gate,
el deploy y el smoke salieron según lo escrito.

## Threat Flags

None — cero superficie nueva. El agente no aplicó DDL (T-49-09 mitigado: apply =
checkpoint blocking consolidado). Gate verde antes del deploy (T-49-10 mitigado). Cero
dependencia nueva (T-49-SC accept). El falso positivo conocido (tsc/vitest verdes ≠
Postgres ejecutó el DDL) se resuelve con los pgTAP post-apply del operador (0049 + 0050).
Camino A intacto: anon a cero grants, cubierto por los asserts anon-no-execute de ambos pgTAP.

## Known Stubs

Ninguno. El sub-bloque es funcional-completo y degrada honesto; su apply (0050) y el de
la RPC de cruces (0049) son checkpoints de operador, no stubs.

## Operator Debt (checkpoint Task 2 — BLOCKING, CONSOLIDADO, pendiente)

**El código está EN VIVO degradando honesto; faltan SOLO los applies de las RPC 0049 (F38)
y 0050 (F49), acción EXCLUSIVA de operador.** Este es el ÚNICO checkpoint consolidado: se
aplican AMBAS migraciones y se verifican AMBAS superficies.

Entorno: `source ~/obs_env.sh` (carga `$SUPABASE_DB_URL`, BOM-safe); `PGCLIENTENCODING=UTF8`
en Windows; NUNCA `supabase db push` (drift de schema_migrations); `--single-transaction`.

1. **Aplicar AMBAS migraciones a PROD por psql:**
   ```
   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -v ON_ERROR_STOP=1 -f supabase/migrations/0049_cruces_de_proyecto.sql
   psql "$SUPABASE_DB_URL" -c "insert into supabase_migrations.schema_migrations (version, name) values ('0049','cruces_de_proyecto') on conflict do nothing;"
   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -v ON_ERROR_STOP=1 -f supabase/migrations/0050_tasa_ausencia_comparada.sql
   psql "$SUPABASE_DB_URL" -c "insert into supabase_migrations.schema_migrations (version, name) values ('0050','tasa_ausencia_comparada') on conflict do nothing;"
   ```
2. **Correr AMBOS pgTAP** contra el schema APLICADO (única prueba válida del DDL; el pgTAP
   de 0049 fue parcheado post-38 con el fixture `fuente_voter_id`, commit 1dc6216 — ya listo):
   ```
   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0049_cruces_de_proyecto.test.sql   # espera 10/10 ok
   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0050_tasa_ausencia_comparada.test.sql  # espera 10/10 ok
   ```
3. **Veredicto visual** en PROD (`https://observatorio-congreso.thevalis.workers.dev`):
   - **Comparativo (F49):** `/parlamentario/D1012` → expandir el detalle de Votaciones →
     tras "Cómo votó" aparece "Ausencias en contexto": **"Ausente en 1 de 141 votaciones
     (0,7%). · Mediana de su cámara: 0,7% (155 parlamentarios). · Sobre las votaciones
     ingestadas por este observatorio, no la historia completa."** Cero adjetivo/color-veredicto.
   - **Cruces (F38):** `/proyecto/14309-04` → "Cruces con el sector del proyecto" con
     ~47 parlamentarios (emilia schneider, gonzalo winter, diego schalper…), líneas
     voto/reunión SEPARADAS, caveat anti-causal 1×, ProvenanceBadge por evidencia.
   - **Empty honesto (F38):** `/proyecto/14782-13` → "Aún no se registran parlamentarios
     con cruces…" — esperado (sin sector), NO bug.
4. **Camino A intacto:** anon sigue denegado — lo cubren los pgTAP anon-no-execute verdes.

Tras el apply + ambos pgTAP verdes + veredicto OK, el operador escribe "aprobado" (con la
versión + resultado de los pgTAP) y la fase 49 cierra. Ambas superficies se montan con
datos sin re-deploy (el código ya está en vivo; solo faltaba el dato que las RPC proveen).

## Self-Check: PASSED (salvo checkpoint operador pendiente)

- Files: 2/2 FOUND (Temp/ausencias-contexto-49-evidencia.png, 49-03-SUMMARY.md).
- Commits: 1/1 FOUND (b093227).
- Deploy: cb853486 al 100% confirmado.
