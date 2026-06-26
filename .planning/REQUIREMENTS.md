# Requirements — Milestone v4.0 De datos a cruces verificables

**Defined:** 2026-06-24
**Core Value:** La ciudadanía puede responder, sobre cualquier proyecto o parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato con fuente, fecha y enlace, sin afirmar nunca intención ni causalidad.

**Diseño LOCKED:** El roadmap completo (Fases 0–5, WHAT/WHY/REPO TARGETS/ACCEPTANCE/AUTONOMY por sub-fase, correcciones de validadores Opus aplicadas) vive en `.planning/MILESTONE-v4-cruces.md` y es la fuente de verdad. Este documento extrae los requisitos verificables; el ROADMAP los mapea a numeración continua (Phases 33+). Requisitos de v3.0 archivados en `.planning/milestones/v3.0-REQUIREMENTS.md`.

**Premisa (LOCKED):** El shell de producto y los datos por carril ya existen (v1.0–v3.0). v4 construye los **cimientos de datos e identidad de terceros**, luego la **capa derivada de cruces** (parlamentario↔sector), luego las **superficies de ficha** — todo **deny-by-default**. Nada sensible se enciende sin firma humana (F13 MONEY, F17 NET, sign-off de cruces). ChileCompra/SERVEL/MONEY están bloqueados por la brecha RUT-01 (RUT ausente en la maestra) y se difieren explícitamente.

**Data posture (LOCKED):** minimización + trazabilidad estricta. RUT NUNCA cruza al LLM (`assertNoRutInLlmInput`); personas jurídicas se identifican SOLO por RUT exacto (sin LLM, fail-closed); terceros deny-by-default; RPCs públicos jamás proyectan rut/partido/email/donante_id. Las señales de cruce son conteos factuales, nunca scores de correlación; linter de texto prohíbe vocabulario causal/insinuante. Convención de ingesta de dos etapas (Fuente→R2 crudo→Supabase), rate-limit 2–3s, degradación honesta (nunca fabricar). DDL por `psql --db-url --single-transaction` + fila en `schema_migrations` (NUNCA `db push`); pgTAP es la única prueba válida.

---

## v4.0 Requirements

### INFRA — Desbloqueo de CI (Fase 0, transversal)

> Blocker que mata cualquier workflow programado antes de tocar la red. Barato, desbloquea toda la Fase 1.

- [x] **INFRA-01**: Los CLIs estrella de ingesta (`run-camara-lobby-cli`, `run-probidad-todos-cli`) cargan credenciales con fallback a `process.env` (no solo `.env` en disco) → corren en GitHub Actions sin `.env`. ✅ Ejecutado (quick task 260623-rtl, commits 1844b2f/399e3e2).

### INGEST — Ingesta lobby + probidad programada (Fase 1.1)

> Los pipelines ETL existen completos (writers reales, reconciliación de identidad) pero nunca fueron programados. Lobby ya tiene R2; probidad no. ChileCompra/SERVEL NO se programan aquí (RUT-01).

- [ ] **INGEST-01**: El workflow `lobby-camara-weekly` corre en dispatch manual, pasa el WAF de camara.cl vía `curl` (fail si respuesta < 10 KB) con `--html-file`, loguea `audiencias=N>0` y escribe `lobby_audiencia` con `estado_vinculo='confirmado'` para los matches deterministas.
- [ ] **INGEST-02**: El workflow `lobby-leylobby-weekly` (instituciones del ejecutivo; Cámara/Senado NO publican en leylobby.gob.cl) loguea `audiencias=N>0` o degrada honesto con `LeylobbyBloqueadaError`.
- [ ] **INGEST-03**: El workflow `probidad-weekly` corre las ~155–200 consultas SPARQL (rate-limit 3s, dentro de límites GH), loguea `declaraciones/bienes/confirmados>0` y escribe filas `declaracion` con `parlamentario_id` no nulo.
- [ ] **INGEST-04**: La provenance run-level de cada corrida se persiste vía la tabla `source_snapshot` existente + `SnapshotWriter` (NO un `crudo_r2_key` paralelo sobre tablas per-parlamentario): tras un run LIVE, `source_snapshot` tiene una fila por run con `r2_path` poblado. Incluye el paso R2 crudo faltante en `run-probidad-todos.ts` (espejo de `run-camara-lobby.ts`, best-effort try/catch).

### ENT — Resolución de identidades de terceros (Fase 1.2)

> Hoy `lobby_contraparte.contraparte_id` y `contratista` quedan NULL por diseño (no hay maestra de terceros). Prerrequisito de la corrección de los cruces.

- [ ] **ENT-01**: Existe la maestra `entidad_tercero` (+ `entidad_tercero_alias`, sequence `entidad_id_seq`, trigger anti-demotion espejo de 0007/0012, RLS deny-by-default) y las tablas `vinculo_entidad` + `revision_entidad` (espejo de `revision_identidad`), aplicadas por `psql --db-url` con pgTAP verde.
- [x] **ENT-02**: El matcher determinista `matchDeterministaEntidad` confirma por RUT-único o nombre-único-por-tipo; toda ambigüedad → `no_confirmado` (fail-closed). Personas jurídicas: SOLO por RUT exacto, nombre-sin-RUT → siempre `no_confirmado` (nunca LLM). Persona natural usa LLM solo ante homónimos, con `assertNoRutInLlmInput` sobre el prompt (≥10 tests; el test falla si un RUT se cuela al prompt).
- [x] **ENT-03**: Los reconciliadores existentes escriben el FK resuelto: `reconciliar-sujeto.ts` puebla `lobby_contraparte.contraparte_id` confirmado (antes siempre null); `reconciliar-contrato.ts` puebla `contratista.entidad_id`. RPC transaccional `resolver_entidad` (espejo de 0015).
- [x] **ENT-04**: Los matches dudosos van a la cola `revision_entidad` (estado `pendiente`); ningún match dudoso se promueve a `confirmado` sin revisor humano vía RPC `resolver_entidad`. UI admin protegida `revisar-entidades`.
- [ ] **ENT-05**: El backfill de entidades es LOCAL (operador), idempotente/reanudable: una 2ª corrida produce 0 entidades/vínculos nuevos. La maestra se exporta a JSON fuera de Supabase (custodia, espejo de `backup.ts`). _(BLOQUEADO por CR-01: `writer-entidad-supabase` hace upsert `onConflict (tipo_entidad, nombre_normalizado)` pero 0034 no crea ese índice único → 42P10 contra DB real; la idempotencia "2ª corrida = 0 nuevos" no es ejercitable. Custodia JSON sí verificada. Ver 35-VERIFICATION.md / 35-REVIEW.md.)_

### CRUCE — Capa de cruces parlamentario↔sector (Fase 2.1)

> El valor diferenciador y el dato de mayor impacto reputacional. Construible deny-by-default; NO publicable sin gate legal (Fase 4).

- [x] **CRUCE-01**: Existe el catálogo `sector` (public-read) + `sector_id` en `proyecto_ficha`, `lobby_contraparte` y `donante`; la tabla `cruce_senal` (deny-by-default, fila única parlamentario+sector+evidencia jsonb — NO espejo de `arista`); el materializador `materializar_cruces()` (security definer, `search_path=''`, pg_cron con offset); y el RPC `cruces_de_parlamentario` SIN grant a anon hasta firma. Migraciones por `psql --db-url`, pgTAP: `sector` public-read, `cruce_senal` deny-by-default, el cuerpo del materializador no referencia partido ni RUT.
- [x] **CRUCE-02**: El etiquetado de sector usa un schema/pipeline/golden SEPARADO del flujo de extracción literal (clasificar a taxonomía cerrada es imputación, no extracción literal — rompería SEM-02). La clasificación corre en un CLI batch de `@obs/cruces` (etapa derivada), NUNCA por fila dentro del writer. Sensibilidad LLM correcta para contrapartes (no `sensitivity:'public'`, Ley 21.719 / FND-06). CLI `--dry-run` sobre 10 proyectos: ≥7 con `sector_id` no nulo medido contra su propio golden.
- [x] **CRUCE-03**: Tras materializar con los datos de lobby actuales, `cruce_senal` tiene ≥1 fila `lobby_sector_aporte` para ≥5 parlamentarios. Las señales derivadas de voto (`lobby_sector_voto`/`aporte_sector_voto`) arrancan OFF (chocan con 17-LEGAL-DOSSIER §2) hasta sign-off explícito. Wording factual obligatorio ("N reuniones con gestores del sector X", sin verbo causal); el RPC nunca proyecta rut/partido/email/donante_id (pgTAP).

### SURF — Superficies de cruces en ficha (Fase 3)

> Consumen `cruce_senal`. Construibles tras la capa de cruces; visibles solo tras gate.

- [x] **SURF-01**: `CrucesSection` (Server Component) en la ficha de parlamentario renderiza las señales factuales con provenance inline, sibling de `#lobby`/`#patrimonio` (nunca anidado — anti-insinuación §9.1), detrás de `crucesPublicEnabled()` (default OFF, espejo de `money-gate.ts`/`net-gate.ts`). Con gate ON renderiza sin error de hidratación; con gate OFF la sección no monta; empty honesto si cero cruces; sin verbo causal (linter); cada evidencia trazable al enlace original (FND-08).
- [ ] **SURF-02**: `cruces_de_proyecto(boletin)` + `CrucesSection` en la ficha de proyecto (parlamentarios que votaron a favor con cruces en el sector del proyecto), PII-safe (proyección vía `parlamentario_publico`, nunca rut/partido), mismo gate. Hereda la advertencia anti-insinuación de las señales de voto → **se difiere si las señales de voto quedan OFF**.

### CRUCEN — Habilitación de cruces (Fase 3.5, deuda de Phase 37, prep para encender `crucesPublicEnabled`)

> Las tres deudas que destapó el code-review de Phase 37, necesarias ANTES de poder firmar/encender la superficie de cruces. CERO flip de flag aquí.

- [x] **CRUCEN-01**: Fix WR-02 (frescura honesta). Nueva migración `create or replace public.cruces_de_parlamentario` que PROYECTA `cruce_senal.fecha_captura` en la fila de retorno (sin tocar el grant — el RPC sigue deny-by-default), y `CrucesSection`/`CrucesView` la usan como `capturedAt` del `ProvenanceBadge` (frescura REAL del materializado, no la fecha de la reunión) → elimina el stale-amber falso y el "Actualizado hace …" sobre una fecha de evento. Tipos + tests actualizados. ✅ 41-01: 0041 drop+recreate (fecha_captura) + pgTAP proargnames + componente + RTL (ff2dd63/807f08b); APLICADA a PROD en el encendido 2026-06-24 (pgTAP 0041 4/4 + 0040 regresión 4/4).
- [x] **CRUCEN-02**: Grant gated del RPC. Nueva migración que concede `execute on function public.cruces_de_parlamentario(text) to anon` (espejo de `subgrafo_red`/`lobby_de_parlamentario`), **ESCRITA pero NO aplicada** — su aplicación es checkpoint humano que ocurre SOLO DESPUÉS del sign-off legal de cruces (deny-by-default hasta la firma, espejo del patrón F17/NET). pgTAP que verifica el grant para cuando se aplique. Un agente NUNCA la aplica ni enciende el flag. ✅ 41-02: 0042_cruces_grant_anon.sql ESCRITA+commiteada (a5e410a) con precondición fail-loud do$$ + cabecera LOUD NO-APLICAR; pgTAP de encendido en supabase/tests/post-apply/ (0ad6f1c) fuera del glob; 0042 INERTE (NO aplicada / NO en schema_migrations).
- [x] **CRUCEN-03**: Dossier legal de cruces. `docs/legal/XX-LEGAL-DOSSIER-CRUCES.md` (espejo de `17-LEGAL-DOSSIER-NET.md`), material de PREPARACIÓN para asesoría legal (`signoff: pending`), que estructura la superficie de riesgo de las señales de cruce parlamentario↔sector (composición de hechos públicos lobby↔sector, riesgo de insinuación, minimización Ley 21.719, atribución por dataset) con checklist de sign-off §9. La firma es **acción humana** (como F17). Encender cruces = firmar dossier (humano) → aplicar grant CRUCEN-02 (operador) → flip `crucesPublicEnabled` (operador).

### LOCKDOWN — Cierre de la API pública de Supabase (Phase 42, rol `web_reader`)

> Raíz: tras el encendido de cruces, el operador no quiere que la API pública de Supabase (rol `anon`) se use indiscriminadamente; todo debe servirse solo a través de la página. Decisión LOCKED del operador: rol dedicado `web_reader` de mínimo privilegio (NO service_role — preserva RLS/PII). Auditado: todas las lecturas ya son server-only. ORDEN DE CUTOVER load-bearing (ver 42-CONTEXT gate 1).

- [ ] **LOCKDOWN-01**: Crear rol `web_reader` (NOLOGIN) + `grant web_reader to authenticator`; migración que concede a `web_reader` EXACTAMENTE el set vivo de `anon` (execute en RPCs + select en tablas public-read + recrear las policies `for select to anon using(true)` como `to web_reader`), enumerado desde PROD (information_schema/pg_policies), NO desde los .sql. Idempotente. NO revoca nada de anon todavía. pgTAP: web_reader ejecuta un RPC y lee una tabla public-read; PII sigue denegado. Aplicable a PROD = checkpoint operador.
- [ ] **LOCKDOWN-02**: Revocar TODO de `anon` y `authenticated` (execute en cada RPC + select en cada tabla + drop de las policies `to anon`). Mata la API pública. Se aplica ÚLTIMA, DESPUÉS de que el server `web_reader` esté vivo en prod (gate de cutover). pgTAP: anon/authenticated SIN execute/select en todo el inventario; web_reader intacto. Un agente NUNCA la aplica antes del deploy del server.
- [ ] **LOCKDOWN-03**: `createServerSupabase` (`app/lib/supabase.ts`) deja de usar la anon key como token y se autentica como `web_reader` (JWT `role: web_reader` firmado con el JWT secret del proyecto; apikey=anon solo para pasar Kong). Mantiene `import "server-only"`. Tests del cliente (forma del token, server-only, ningún `NEXT_PUBLIC_`). Deploy a Cloudflare ANTES del revoke (LOCKDOWN-02).
- [ ] **LOCKDOWN-04**: Verificación end-to-end + guard. Probe live (operador): la anon key contra cada RPC/tabla → `permission denied`/401/42501; el sitio (server como web_reader) renderiza TODAS las superficies (votaciones, lobby, patrimonio, dinero, NET, cruces, búsqueda, agenda, parlamentarios, proyecto). Guard CI anti-regresión: falla si reaparece un `grant ... to anon` o si el server hace `select` de columna PII conocida. Runbook de cutover ordenado + rollback (re-grant anon) documentado.

### LEGAL — Gate legal transversal (Fase 4, #10)

> No es una fase tardía sino el gate que controla la exposición de todo lo sensible. Un agente autónomo NUNCA flipea estos flags.

- [ ] **LEGAL-01**: Revisión legal humana (Ley 21.719) que habilita los flags `MONEY_PUBLIC_ENABLED` (aportes/contratos), `netPublicEnabled` (datos de red) y `crucesPublicEnabled` (señales de cruce). Requiere firmas F13 (MONEY, `docs/legal/13-LEGAL-DOSSIER.md`) y F17 (NET, `17-LEGAL-DOSSIER.md`) + sign-off de cruces registrados; flags encendidos por el operador en Cloudflare Pages; despliegue verificado. MONEY también depende de RUT-01; NET es doble-candado (RLS + flag). **Acción exclusivamente humana.**

### RUTM — RUT-01 + ChileCompra/SERVEL (Fase 5, diferido)

> Bloqueado por RUT-01 (prerrequisito duro no resuelto por estos diseños) + F13. Se difiere explícitamente en lugar de fingir que el CLI demo es un pipeline.

- [ ] **RUTM-01**: Cosecha de RUT a la maestra (`backfill-rut.ts`), DV-válido + provenance, NUNCA fabricar un RUT. Acción de operador (needs-human-checkpoint).
- [ ] **RUTM-02**: Wire real de ChileCompra (hoy CLI demo: maestra vacía, RUT hardcodeado, falta `MERCADOPUBLICO_TICKET`): `run-dinero-prod-cli.ts` (carga maestra + `TareaRut[]` de la semana) + workflow `dinero-chilecompra-weekly` + bloque R2/`SnapshotWriter` en `ingest-run.ts`. Degrada a dry-run sin ticket → assert post-run `if [ $CONTRATOS -eq 0 ]; exit 1`. Con ticket y RUTs reales: `contratos=N>0`, cruce por RUT confirmado.
- [ ] **RUTM-03**: Workflow `dinero-servel-manual` (`workflow_dispatch` only, URL Azure Blob por elección provista por el operador): con datos reales, `aportes=N>0`. Exposición pública requiere LEGAL-01.

## v5.0 Requirements — Legibilidad + análisis

> Milestone v5 (Phases 44+). Diseño LOCKED en `.planning/phases/44-legibilidad-auditoria-plan/UI-SPEC.md` (decisión A+B: legibilidad ya + ingesta paralela). Estos son los requisitos verificables de la pista de **legibilidad** (F45 navegación). Los requisitos de charts (VIZ-*) se definen al planear F46+ según la cobertura real de datos (ver `44-DATA-INVENTORY.md`).

### LEG — Navegación de la ficha de parlamentario (Phase 45)

> La ficha es hoy 1 columna apilada (~900 KB) sin resumen ni navegación. Hacerla navegable SIN romper la frontera de carril anti-insinuación (DESIGN-SYSTEM §3/§8, LOCKED) ni el guard de lockdown (Camino A).

- [x] **LEG-01**: Cada carril de dominio (`#votos`, `#lobby`, `#patrimonio`, `#cruces`, y los MONEY gated) se renderiza como un **acordeón independiente** (uno por dominio, JAMÁS dos dominios en una unidad): el `<h2>` vive en un header **siempre visible** (no colapsable, preserva `h1→h2→h3`), el cuerpo es colapsable, y la frontera de carril `mt-12` entre acordeones **nunca se colapsa** (ni con un carril vacío). Componente: `@radix-ui/react-accordion` (coherente con el stack Radix instalado), SSR-friendly, server-component + thin client wrapper para el toggle.
- [ ] **LEG-02**: Arriba del pliegue (después de la cabecera, antes del primer carril) se renderiza un **resumen + índice** con un chip por carril que (a) muestra el **conteo/estado honesto** del carril respetando los 3 estados (dato / vacío-honesto / no-ingerido; nunca inventa densidad) y (b) **ancla** (salto interno) al carril correspondiente.
- [x] **LEG-03**: El rediseño es **comportamiento-preservante de datos y seguridad**: no toca el contenido de las secciones (cada dato conserva fuente+fecha+enlace), no introduce `.from('parlamentario')` ni RPCs fuera del `PUBLIC_RPC_ALLOWLIST` (guard `lockdown-guard.test.ts` verde), no rompe el SSR (la ficha sigue server-rendered; solo el toggle del acordeón es cliente), y el default de apertura colapsa carriles vacíos/ralos. Suite `app/` verde + `tsc -b` limpio; build validado en Docker Linux (no build Windows).

### VIZ — Chart de patrimonio (Phase 46)

> Único gráfico con cobertura densa hoy (135 parlamentarios con ≥2 años de declaraciones, 2016-2026). Solo CONTEO de ítems, NO montos (son URIs `datos.cplt.cl/.../moneda_*` → gap de ingesta). Ver `44-DATA-INVENTORY.md`. Vive DENTRO del acordeón de patrimonio creado en F45.

- [ ] **VIZ-01**: La sección de patrimonio muestra un **gráfico de evolución = serie temporal del CONTEO de ítems** (bienes / pasivos / inmuebles, etc.) por `declaracion.fecha_presentacion`, rotulando el **tipo de declaración** (periódica vs rectificación vs cese — no mezclar peras con manzanas). Usa SOLO los RPCs ya allowlisted (`declaraciones_de_parlamentario`, `bienes_de_parlamentario`); **NO grafica montos** (caveat honesto visible: "montos no disponibles como cifra"). Degrada a "datos insuficientes para una tendencia" cuando hay <2 declaraciones.
- [ ] **VIZ-02**: **Recharts** instalado en `app/` (única dep de charts; visx reservado para timeline a medida fuera de v5). El chart es una **isla cliente** (`"use client"`); el resto de la ficha sigue SSR. El build OpenNext/Cloudflare **no se rompe** (validado en Docker Linux, no build Windows). `pnpm test` + `tsc -b` verdes.
- [ ] **VIZ-03**: El gráfico es **descriptivo, nunca causal**: ejes/leyendas neutros ("N.º de bienes declarados por año"), sin verbo causal (negative-match del vocabulario prohibido verde), con **fuente + fecha + enlace** (CC BY 4.0 CPLT) al pie igual que las tablas. NO introduce RPC nueva ni `.from('parlamentario')`; guard `lockdown-guard.test.ts` verde.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Encender cualquier flag `*_PUBLIC_ENABLED` por un agente autónomo | LOCKED: gate humano. El "flip por quality floor" del diseño #1 está eliminado. |
| Señales de cruce derivadas de voto (`co_votacion`, `*_sector_voto`) en el MVP | 17-LEGAL-DOSSIER §2 (anti-insinuación); arrancan OFF, requieren re-justificación legal. |
| Lobby del Senado | No hay portal equivalente confirmado (leylobby = solo ejecutivo). |
| Scores de correlación / afirmación de causalidad | Regla rectora; las señales son conteos factuales con wording sin verbo causal. |
| Exposición pública de RUT / donante_id / partido / email | Minimización (Ley 21.719); RPCs públicos jamás los proyectan; RUT nunca al LLM. |
| ChileCompra/SERVEL a escala sin RUT-01 | Sin RUT, ChileCompra cruza cero parlamentarios; se difiere a Fase 5 en vez de fingir cobertura. |

## Traceability

Mapeo a fases del ROADMAP (numeración continúa desde v3.0 — Phase 32 fue la última; v4.0 arranca en Phase 33). El detalle de diseño por sub-fase vive en `.planning/MILESTONE-v4-cruces.md`.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 33 | Complete |
| INGEST-01 | Phase 34 | Pending |
| INGEST-02 | Phase 34 | Pending |
| INGEST-03 | Phase 34 | Pending |
| INGEST-04 | Phase 34 | Pending |
| ENT-01 | Phase 35 | Pending |
| ENT-02 | Phase 35 | Complete |
| ENT-03 | Phase 35 | Complete |
| ENT-04 | Phase 35 | Complete |
| ENT-05 | Phase 35 | Pending (blocked: CR-01) |
| CRUCE-01 | Phase 36 | Complete |
| CRUCE-02 | Phase 36 | Complete |
| CRUCE-03 | Phase 36 | Complete |
| SURF-01 | Phase 37 | Complete |
| SURF-02 | Phase 38 | Pending |
| CRUCEN-01 | Phase 41 | Complete (0041 aplicada a PROD en el encendido 2026-06-24) |
| CRUCEN-02 | Phase 41 | Complete (0042 aplicada a PROD en el encendido 2026-06-24, post-firma) |
| CRUCEN-03 | Phase 41 | Complete |
| LEGAL-01 | Phase 39 | Pending |
| RUTM-01 | Phase 40 | Pending |
| RUTM-02 | Phase 40 | Pending |
| RUTM-03 | Phase 40 | Pending |
| LOCKDOWN-01 | Phase 42 | Write-complete (apply=operador) |
| LOCKDOWN-02 | Phase 42 | Write-complete (apply ÚLTIMO=operador) |
| LOCKDOWN-03 | Phase 42 | Write-complete (deploy=operador) |
| LOCKDOWN-04 | Phase 42 | Complete |
| DEBT-01 | Phase 43 | Complete (inventario: ~71 hallazgos, 6 dims) |
| DEBT-02 | Phase 43 | Complete (validación Opus 1-a-1: 23 falsos-pos/won't-fix) |
| DEBT-03 | Phase 43 | Complete (24 FIX-NOW, 21 commits, suite 341 verde) |
| DEBT-04 | Phase 43 | Complete (ledger + 11 checkpoints operador + memoria) |

### DEBT (Phase 43 — eliminación de deuda técnica, exhaustiva)

- **DEBT-01 — Inventario exhaustivo con evidencia.** Swarm premortem Sonnet (≥6 dimensiones: código app/, código packages/, DB+migraciones+pgTAP, tests+cobertura+CI, deps+config+build, planning+docs+scratch) produce `43-DEBT-LEDGER.md` con cada hallazgo (archivo:línea, repro, severidad, blast radius). Nada por sentado: sin evidencia verificable no entra.
- **DEBT-02 — Validación adversarial Opus 1-a-1.** Cada hallazgo recibe su propio veredicto Opus: ¿deuda real o falso positivo? causa raíz, qué rompe, test que lo protege → FIX-NOW / CHECKPOINT-OPERADOR / WON'T-FIX. Prohibido el fix masivo sin validación individual.
- **DEBT-03 — Fixes seguros.** Solo los FIX-NOW: aplicados con test + commit atómico por fix; suite app ≥316 verde + tsc -b limpio + packages/* verdes entre cada fix; cero regresión/cambio de comportamiento sin prueba; migraciones nuevas (si las hay) ESCRITAS no aplicadas (apply=operador).
- **DEBT-04 — Cierre.** DEBT-LEDGER final (fixed/deferred-con-razón-y-dueño/won't-fix-con-razón) + guards anti-regresión (CI app/ tests, linter si se decide) + reporte de checkpoints de operador + memoria/STATE actualizadas.

**Coverage:**

- v4.0 requirements: 22 total (19 base + 3 CRUCEN, deuda de Phase 37 → Phase 41)
- Phase 42 (LOCKDOWN, post-encendido cruces): 4 (LOCKDOWN-01..04)
- Phase 43 (DEBT, eliminación de deuda técnica): 4 (DEBT-01..04)
- Mapped to phases: 30
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-24*
*Last updated: 2026-06-24 after initial definition (transcribed from .planning/MILESTONE-v4-cruces.md)*
