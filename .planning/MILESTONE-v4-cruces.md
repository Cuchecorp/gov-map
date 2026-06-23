# MILESTONE: gov-map — De datos a cruces verificables y publicables

> Roadmap de milestone. Drop-in en `.planning/`. Estado base verificado: migraciones hasta `0033` aplicadas (0034+ libres; 0027/0029 nunca existieron como forward migrations — son números de pgTAP); workflows existentes: `agenda-weekly`, `leyes-weekly`, `backfill`, `fichas-backfill`, `backup-parlamentario`, `deploy-cloudflare`. NO existe workflow para lobby/probidad/dinero. Convención LOCKED: aplicar SQL vía `psql --db-url` (no `db push`, por schema_migrations drift); pgTAP es la única prueba válida; ingesta en dos etapas (Fuente→R2 crudo→Supabase); deny-by-default + gate de presentación para todo dato sensible.

## Goal

Convertir gov-map de un cascarón pulido con datos por carril en una plataforma que **cruza** lobby, financiamiento y votos por parlamentario y sector, manteniendo trazabilidad a la fuente y sin afirmar causalidad. El milestone construye los cimientos de datos e identidad, luego la capa de cruces, luego las superficies de ficha, distribución y endurecimiento.

**Insight de ruta crítica:** la resolución de entidades (#3) y la ingesta de las tres fuentes (#1) son los cimientos; ambos alimentan la capa de cruces (#2); los cruces alimentan las superficies de ficha y proyecto (#6/#8). Atravesando todo, el gate legal (#10) controla la **exposición pública** de lobby/aportes/contratos y de cualquier señal de cruce — el código se puede construir entero deny-by-default, pero **nada sensible se enciende sin firma humana F13 (MONEY) y F17 (NET)**. Además, ChileCompra/SERVEL y todo cruce que use RUT están bloqueados por la brecha RUT-01 (RUT ausente en la maestra hoy), que es un prerrequisito duro no resuelto por estos diseños.

---

## FASE 0 — Desbloqueo de CI (blocker transversal)

**Por qué primero:** los validadores identificaron un blocker de CI que mata cualquier workflow programado antes de tocar la red. Sin esto, las Fases 1+ no corren. Es barato y desbloquea todo lo demás.

### 0.1 — Patch loadEnv CI-safe en CLIs estrella
- **WHAT:** Parchar los CLIs de lobby y probidad para que carguen credenciales con fallback a `process.env`, no solo desde `.env` en disco.
- **WHY:** `run-camara-lobby-cli.ts` y `run-probidad-todos-cli.ts` hacen `readFileSync(.env)` sin try/catch ni fallback. GitHub Actions no tiene `.env` → ENOENT y muerte antes del primer fetch. Toda la Fase 1 depende de esto.
- **REPO TARGETS:** `packages/lobby/src/run-camara-lobby-cli.ts`, `packages/probidad/src/run-probidad-todos-cli.ts` (y cualquier futuro `run-dinero-prod-cli.ts`). Patrón a copiar: `run-agenda-prod-cli.ts` (wrap read en try/catch, `process.env` toma precedencia).
- **KEY NOTES:** No es el patrón de `agenda-weekly.yml` (eso es el YAML); es el `loadEnv` de `run-agenda-prod-cli.ts`. Backwards-compatible: local sigue leyendo `.env`.
- **DEPENDS-ON:** ninguno.
- **EFFORT:** S
- **AUTONOMY:** autónomo.
- **ACCEPTANCE:** los CLIs corren en un entorno sin `.env` cuando las vars están en `process.env`; `pnpm test` verde.

---

## FASE 1 — Cimientos: ingesta + identidad de entidades

**Por qué este orden:** ingesta (#1) e identidad (#3) son independientes entre sí pero ambos son prerrequisito de los cruces (#2). Se construyen en paralelo. La parte shippable de #1 hoy es **solo lobby + probidad** (cruzan por nombre, sin RUT); ChileCompra/SERVEL quedan diferidos tras RUT-01. **Desbloquea:** datos confirmados que #2 materializa en señales.

### 1.1 — Ingesta lobby + probidad programada (#1, slice corregido)
- **WHAT:** Wire de los conectores ETL ya completos de lobby (Cámara + LeyLobby) y patrimonio/InfoProbidad a workflows de GitHub Actions recurrentes. Añadir el paso R2 crudo faltante en probidad. **NO** programar ChileCompra/SERVEL en esta fase. **NO** tocar `MONEY_PUBLIC_ENABLED`.
- **WHY:** Los pipelines existen completos (writers reales, reconciliación de identidad), pero nunca fueron programados. Lobby ya tiene R2; probidad no (sin bloque R2 en `run-probidad-todos.ts`).
- **REPO TARGETS:**
  - Nuevos: `.github/workflows/lobby-camara-weekly.yml`, `.github/workflows/lobby-leylobby-weekly.yml`, `.github/workflows/probidad-weekly.yml`.
  - Reusar: `packages/lobby/src/run-camara-lobby-cli.ts`, `packages/lobby/src/ingest-cli.ts` (LeyLobby), `packages/probidad/src/run-probidad-todos-cli.ts`.
  - Modificar: `packages/probidad/src/run-probidad-todos.ts` (añadir bloque Etapa-1 R2 espejando `run-camara-lobby.ts` L88–105, best-effort try/catch), `run-probidad-todos-cli.ts` (wire R2Store desde env).
- **KEY NOTES (correcciones de validador):**
  - **WAF camara.cl:** Node fetch bloqueado por TLS fingerprint. El workflow debe `curl -A 'Bot-Ciudadano/1.0' -o /tmp/lobby.html ...` y pasar `--html-file`. Fail si respuesta < 10 KB.
  - **LeyLobby:** solo instituciones del ejecutivo (Cámara/Senado NO publican en leylobby.gob.cl). Sin WAF. Senado lobby fuera de scope (no hay portal equivalente confirmado).
  - **Probidad:** ~155–200 SPARQL × 2–3s ≈ 6–10 min, dentro de límites GH. Sin WAF.
  - **Provenance:** NO crear `crudo_r2_key` en `*_ingesta_estado` (corrección del validador — son tablas per-parlamentario, public-read; un crudo = un RUN). Usar la tabla `source_snapshot` que YA existe (migración 0002) + `SnapshotWriter` en `@obs/ingest` (`snapshot.ts`). Los pipelines hoy llaman `R2Store.putImmutable` directo y descartan la key; el fix es wirearlos a `SnapshotWriter`.
- **DEPENDS-ON:** 0.1.
- **EFFORT:** L (el diseño implicaba M; XL era para el alcance completo con ChileCompra+SERVEL+RUT, que aquí se difiere).
- **AUTONOMY:** autónomo para construir + correr en dry-run; **needs-human-checkpoint** para encender LIVE (secrets del operador: `R2_*`, ya en `agenda-weekly.yml`).
- **ACCEPTANCE:**
  1. `lobby-camara-weekly` en dispatch manual loguea `audiencias=N>0` y escribe `lobby_audiencia` con `estado_vinculo='confirmado'`.
  2. `lobby-leylobby-weekly` loguea `audiencias=N>0` o degrada honesto (`LeylobbyBloqueadaError`).
  3. `probidad-weekly` loguea `declaraciones/bienes/confirmados>0`; filas `declaracion` con `parlamentario_id` no nulo.
  4. Tras run LIVE, `source_snapshot` tiene una fila por run con `r2_path` poblado.
  5. `pnpm test` verde.

### 1.2 — Resolución de identidades de terceros (#3)
- **WHAT:** Extender el subsistema de identidad (hoy solo parlamentarios) a (A) donantes/proveedores con RUT y (B) gestores/contrapartes de lobby. Maestra `entidad_tercero` con ID estable, alias, matcher determinista, pipeline de adjudicación con gate humano, y conexión de los reconciliadores existentes.
- **WHY:** Hoy `lobby_contraparte.contraparte_id` y `contratista` quedan NULL por diseño porque no hay maestra de terceros a la que apuntar → los cruces contarían entidades duplicadas o incorrectas. Es prerrequisito de la corrección de #2/#6/grafo.
- **REPO TARGETS:**
  - Migraciones: `0034_entidad_tercero.sql` (tabla + `entidad_tercero_alias` + sequence `entidad_id_seq` + trigger anti-demotion espejo de 0007/0012 + RLS deny-by-default), `0035_vinculo_entidad.sql` (`vinculo_entidad` + `revision_entidad`, espejo de `revision_identidad` 0006), `0036_entidad_fk.sql` (FK formal `lobby_contraparte.contraparte_id`→`entidad_tercero`, columna `contratista.entidad_id`, columna `identidad_audit.tipo_entidad`, RPC transaccional `resolver_entidad` espejo de 0015).
  - Nuevos en `@obs/identity`: `deterministic-entidad.ts`, `seeder-entidad.ts`, `writer-entidad-supabase.ts`, `backfill-entidad-cli.ts`.
  - Nuevos en `@obs/adjudication`: `pipeline-entidad.ts`, `prompt-entidad.ts`, `writer-revision-entidad.ts`, `revisor-entidad-cli.ts`.
  - Modificar: `packages/dinero/src/reconciliar-contrato.ts`, `packages/lobby/src/reconciliar-sujeto.ts` (escribir `entidad_id`), writers de lobby/dinero.
  - UI admin protegida: `app/app/admin/revisar-entidades/page.tsx`.
- **KEY NOTES:**
  - **Personas jurídicas: nunca LLM.** Identidad solo por RUT exacto; nombre-sin-RUT de jurídica → siempre `no_confirmado` (fail-closed). LeyLobby NO publica RUT de contraparte → la mayoría de gestores quedan `no_confirmado`: cruce incompleto pero **nunca incorrecto** (degradación honesta).
  - **Persona natural** usa LLM solo ante homónimos; `assertNoRutInLlmInput` sobre el prompt (el RUT NUNCA cruza al LLM).
  - ID estable vía `nextval('entidad_id_seq')` (no lógica TS frágil). Custodia: exportar maestra a JSON fuera de Supabase (espejo de `backup.ts`).
  - Backfill = LOCAL (operador), no CI (sin minutos), idempotente/reanudable.
- **DEPENDS-ON:** ninguno duro (extiende andamiaje existente). Conviene tras 1.1 para tener contrapartes pobladas que resolver.
- **EFFORT:** L.
- **AUTONOMY:** autónomo para construir tablas/matcher/pipeline; **needs-human-checkpoint** para la revisión de matches dudosos (cola `revision_entidad` → revisor humano vía RPC `resolver_entidad`). Ningún match dudoso se promueve a `confirmado` sin humano.
- **ACCEPTANCE:**
  1. `entidad_tercero` con ID estable, alias, trigger anti-demotion; RLS deny-by-default en las 3 tablas nuevas.
  2. `matchDeterministaEntidad` confirma por RUT-único o nombre-único-por-tipo; ambigüedad→`no_confirmado` (≥10 tests).
  3. `reconciliar-sujeto.ts` escribe `contraparte_id` confirmado (antes siempre null); `reconciliar-contrato.ts` escribe `contratista.entidad_id`.
  4. Dudosos → `revision_entidad` estado `pendiente`; revisor-cli confirma vía RPC transaccional.
  5. `assertNoRutInLlmInput` falla el test si un RUT se cuela al prompt.
  6. Backfill idempotente: 2ª corrida = 0 entidades/vínculos nuevos.

---

## FASE 2 — Cruces (capa derivada)

**Por qué este orden:** #2 consume datos confirmados de lobby (Fase 1.1) e identidades resueltas (Fase 1.2). Construible deny-by-default, pero **NO publicable** sin Fase 4 (legal). **Desbloquea:** las superficies de ficha/proyecto (#6/#8).

### 2.1 — Capa de cruces como entidad de primer nivel (#2, scope corregido)
- **WHAT:** Modelar relaciones explícitas parlamentario↔sector cruzando lobby, aportes y votos; materializar señales factuales (conteos de evidencia, sin score de correlación); exponer **solo tras gate legal**. Etiquetado de sector por LLM con su propio eval.
- **WHY:** Sin la capa de cruces el sitio nunca conecta los carriles — es el valor diferenciador. Pero es el dato de mayor impacto reputacional.
- **REPO TARGETS:**
  - Nuevo package `@obs/cruces` (`sector.ts`, `clasificar-fichas-cli.ts`, `clasificar-lobby-cli.ts`, `model.ts`).
  - Migraciones (numeración tras 1.2 → 0037+): `sector` (catálogo + enum), `sector_id` en `proyecto_ficha`, `lobby_contraparte` **y `donante`** (el diseño omitió donante — corregido), `cruce_senal` (deny-by-default), `materializar_cruces()` (security definer, search_path='', pg_cron offset ~`23 3 * * *`), RPC `cruces_de_parlamentario` **NO grant a anon hasta firma**.
  - Modificar fichas: `model.ts`, `prompt.ts`, `extraer.ts`, `pipeline-cli.ts`.
- **KEY NOTES (correcciones de validador — críticas):**
  - **`cruce_senal` NO es espejo de `arista`.** `arista` es arista binaria parlamentario↔parlamentario (extremo_a<extremo_b, ambos FK a entidad); `cruce_senal` es fila única parlamentario+sector+evidencia jsonb. Forma distinta — no transfieren los invariantes de `arista`/`subgrafo`.
  - **El `sector_id` en `FichaSchema` ROMPE el contrato SEM-02 de extracción literal** (idea_matriz debe ser substring verificable; el golden gate cuenta fabricación como falla existencial). Clasificar a una taxonomía cerrada **es imputación, no extracción literal** — contradice "literal o null". Por tanto: **schema/pipeline/golden SEPARADO** para sector, no reusar el flujo de extracción literal. Necesita su propio eval/golden set antes de encender.
  - **Sensibilidad LLM:** `lobby_contraparte` es tercero deny-by-default (Ley 21.719). Enviar nombre/representado al LLM con `sensitivity:'public'` viola FND-06 (`data-routing.ts`). Tratar como dato no-público; clasificar nombre+materia con la política de routing correcta.
  - **NO inyectar llamada LLM por fila dentro de `writer-supabase.ts`** (rompe la convención de dos etapas e idempotencia). La clasificación va en el CLI batch de `@obs/cruces`, etapa derivada separada.
  - **Señales de voto bajo escrutinio:** `0030_net.sql §27` excluye `co_votacion` del MVP por decisión LEGAL (17-LEGAL-DOSSIER §2, anti-insinuación). Las señales `lobby_sector_voto`/`aporte_sector_voto` son precisamente ese patrón → **re-justificar o dejarlas OFF** hasta sign-off explícito; arrancar con `lobby_sector_aporte` (la menos insinuante) y diferir las de voto.
  - Wording factual obligatorio: "N reuniones con gestores del sector X / M aportes de donantes del sector X / K votos favorables", sin verbo causal. Linter de texto prohíbe "corrupción/influencia/benefició/a cambio de".
- **DEPENDS-ON:** 1.1 (lobby confirmado), 1.2 (entidades resueltas para sector de donante/contraparte), Fase 4 para publicar.
- **EFFORT:** XL.
- **AUTONOMY:** autónomo para tablas/materializador/CLI/eval **deny-by-default**; **needs-legal-signoff** para grant del RPC a anon y encender `crucesPublicEnabled()`. Las señales de voto requieren sign-off adicional vs 17-LEGAL-DOSSIER §2.
- **ACCEPTANCE:**
  1. Migraciones aplican vía `psql --db-url`; pgTAP: `sector` public-read, `cruce_senal` deny-by-default, cuerpo de `materializar_cruces()` no referencia partido ni RUT.
  2. CLI sector `--dry-run` sobre 10 proyectos: ≥7 con `sector_id` no nulo (umbral honesto) **medido contra su propio golden**, no el de extracción literal.
  3. Tras materializar con datos de lobby actuales, `cruce_senal` ≥1 fila `lobby_sector_aporte` para ≥5 parlamentarios (señales de voto OFF salvo sign-off).
  4. RPC nunca proyecta rut/partido/email/donante_id (pgTAP).
  5. Con `crucesPublicEnabled()=false` la sección no monta.

---

## FASE 3 — Superficies (ficha + proyecto)

**Por qué este orden:** consumen `cruce_senal` (Fase 2). Construibles tras la capa de cruces; visibles solo tras gate.

### 3.1 — #6 Superficie de cruces en ficha de parlamentario
- **WHAT:** `CrucesSection` (Server Component) que llama al RPC y renderiza señales factuales con provenance inline, sibling de `#lobby`/`#patrimonio` (nunca anidado — convención anti-insinuación §9.1).
- **REPO TARGETS:** `app/components/cruces-de-parlamentario.tsx`, modificar `app/app/parlamentario/[id]/page.tsx`, nuevo `app/lib/cruces-gate.ts` (`crucesPublicEnabled()` default OFF, espejo de `money-gate.ts`/`net-gate.ts`).
- **KEY NOTES:** patrón de `patrimonio-de-parlamentario.tsx`/`lobby-de-parlamentario.tsx`. Empty honesto si cero cruces. Cada evidencia con enlace original (FND-08).
- **DEPENDS-ON:** 2.1, 4.x (gate).
- **EFFORT:** M.
- **AUTONOMY:** autónomo para construir; **needs-legal-signoff** para encender.
- **ACCEPTANCE:** renderiza sin error de hidratación con gate ON; no monta con gate OFF; sin verbo causal (linter); cada evidencia trazable.

### 3.2 — #8 Superficie de cruces en ficha de proyecto (opcional, gated)
- **WHAT:** `cruces_de_proyecto(boletin)` → parlamentarios que votaron a favor con cruces en el sector del proyecto, PII-safe.
- **REPO TARGETS:** `app/components/cruces-de-proyecto.tsx`, modificar `app/app/proyecto/[boletin]/page.tsx`, RPC adicional en migración de Fase 2.
- **KEY NOTES:** mismo gate. Proyección vía `parlamentario_publico` (nunca rut/partido). Hereda la advertencia anti-insinuación de las señales de voto — **diferir si las señales de voto quedan OFF**.
- **DEPENDS-ON:** 2.1, 3.1, sign-off de señales de voto.
- **EFFORT:** M.
- **AUTONOMY:** needs-legal-signoff.
- **ACCEPTANCE:** PII-safe verificado por pgTAP; gated; trazable.

---

## FASE 4 — Distribución / Gate legal (#10) — atraviesa, no es secuencial

**Por qué:** #10 no es una fase tardía sino el **gate transversal** que controla la exposición de todo lo sensible de Fases 1–3. Se inicia temprano (humano), se resuelve antes de encender cualquier flag.

### 4.1 — #10 Sign-off legal (MONEY F13 + NET F17 + cruces)
- **WHAT:** Revisión legal humana (Ley 21.719) que habilita: exposición de aportes/contratos (`MONEY_PUBLIC_ENABLED`), datos de red (`netPublicEnabled`), y señales de cruce (`crucesPublicEnabled`).
- **WHY:** LOCKED. SIGNOFF-01 + `docs/legal/13-LEGAL-DOSSIER.md` (F13) y `17-LEGAL-DOSSIER.md` (F17) requieren firma humana. MONEY también depende de RUT-01. NET es doble-candado (RLS + flag).
- **REPO TARGETS:** ninguno de código — `docs/legal/*`, env vars en Cloudflare Pages (acción de operador).
- **KEY NOTES:** **Un agente autónomo NUNCA flipea estos flags.** El "quality floor flip" propuesto en #1 está **eliminado** (contradice gate LOCKED). MEMORY: F13 y F17 pendientes hoy.
- **DEPENDS-ON:** datos de Fases 1–2 listos para revisar; RUT-01 para MONEY.
- **EFFORT:** N/A (proceso humano).
- **AUTONOMY:** **needs-legal-signoff** (exclusivamente humano).
- **ACCEPTANCE:** firmas F13/F17 registradas; flags encendidos por operador; despliegue verificado.

---

## FASE 5 — Endurecimiento

**Por qué último:** ChileCompra/SERVEL y MONEY dependen de RUT-01 (no resuelto por estos diseños) y de F13. Se hace tras cimientos + gate.

### 5.1 — RUT-01 + ChileCompra/SERVEL (resto de #1, diferido)
- **WHAT:** Cosecha de RUT a la maestra; wire real de ChileCompra (hoy es CLI demo: maestra vacía, un RUT hardcodeado `76.123.456-0`, falta `MERCADOPUBLICO_TICKET`); workflow manual SERVEL por elección.
- **WHY:** Sin RUT, ChileCompra cruza cero parlamentarios y la señal `aporte_sector_voto`/MONEY no tiene evidencia.
- **REPO TARGETS:** `packages/identity/src/backfill-rut.ts` (cosecha), nuevo `run-dinero-prod-cli.ts` (carga maestra + TareaRut[] semana actual), `.github/workflows/dinero-chilecompra-weekly.yml`, `.github/workflows/dinero-servel-manual.yml`; añadir bloque R2/`SnapshotWriter` a `ingest-run.ts` (hoy "R2 BLOQUEADO").
- **KEY NOTES:** ChileCompra degrada a dry-run sin ticket → assert post-run `if [ $CONTRATOS -eq 0 ]; exit 1`. SERVEL: `workflow_dispatch` only (URL Azure Blob por elección, operador-provista, A2).
- **DEPENDS-ON:** RUT-01 (prerrequisito duro, no resuelto aquí), 4.1 para exponer.
- **EFFORT:** L–XL.
- **AUTONOMY:** **needs-human-checkpoint** (RUT, ticket, URL SERVEL); exposición needs-legal-signoff.
- **ACCEPTANCE:** con ticket y RUTs reales, `contratos=N>0`; SERVEL `aportes=N>0`; cruce de identidad por RUT confirmado.

---

## Autonomy & checkpoints

**Un agente autónomo PUEDE construir end-to-end:** Fase 0 (patch CI); Fase 1.1 (workflows lobby/probidad + wire `SnapshotWriter`); Fase 1.2 (tablas/matcher/pipeline de entidades, deny-by-default); Fase 2.1 (capa de cruces deny-by-default + eval de sector); Fases 3.1/3.2 (componentes detrás de gate OFF). Todo esto es código + migraciones + tests, sin exponer nada.

**DEBE detenerse para un humano:**
- **Legal (F13 MONEY, F17 NET, cruces):** ningún flag `*_PUBLIC_ENABLED` se enciende sin firma. El "flip por quality floor" del diseño #1 queda eliminado.
- **Matches dudosos (#3):** toda promoción a `confirmado` de entidades ambiguas pasa por la cola `revision_entidad` + revisor humano.
- **Exposición de patrimonio/financiamiento/cruces:** se construye, no se publica, hasta sign-off.
- **RUT-01, `MERCADOPUBLICO_TICKET`, URL SERVEL, encender LIVE:** acciones de operador.

---

## Risks & honest-degradation (vs principios LOCKED)

- **Provenance (FND-08):** la provenance run-level va en `source_snapshot` (existente), NO en un `crudo_r2_key` paralelo sobre tablas per-parlamentario (corrección del validador). Cada dato mostrado lleva fuente/fecha/enlace.
- **No causalidad / anti-insinuación:** las señales de cruce son **conteos factuales**, nunca score de correlación; wording sin verbo causal (linter). Las señales derivadas de voto chocan con `0030_net.sql §27` / 17-LEGAL-DOSSIER §2 — arrancan OFF y requieren re-justificación legal; el grafo `co_votacion` permanece excluido.
- **PII shielding (Ley 21.719):** RUT nunca cruza al LLM (`assertNoRutInLlmInput`); jurídicas se identifican solo por RUT exacto (sin LLM); terceros deny-by-default; RPCs públicos nunca proyectan rut/partido/email. Resultado honesto: muchos gestores de lobby (sin RUT en la fuente) quedan `no_confirmado` — cruce **incompleto pero nunca incorrecto**.
- **Fragilidad de formato de fuente:** WAF camara.cl (curl + fail-si-<10KB); ticket ChileCompra expirable (assert post-run); SPARQL Virtuoso lento (rate-limit 3s, `--limit` si throttle); URL SERVEL drift (manual, conocido).
- **Brecha RUT-01 (honesta):** ChileCompra y MONEY no son shippables hoy; se difieren explícitamente en lugar de fingir que el CLI demo es un pipeline.
- **Esfuerzos corregidos:** #1 slice lobby+probidad = L (no M); #1 completo = XL; #2 = XL (no M/L); #3 = L. Migraciones se aplican por `psql --db-url` con pgTAP como única prueba válida.
---

## Notas de síntesis (correcciones de los validadores Opus aplicadas)

- **Verifiqué contra el repo:** migraciones llegan a `0033` (0034+ libres; 0027/0029 ausentes, confirmando al validador); existen `agenda-weekly.yml`/`leyes-weekly.yml`/`fichas-backfill.yml` pero **ningún** workflow de lobby/probidad/dinero — confirma la premisa de #1.
- **Apliqué todas las correcciones de validador:** (a) blocker de CI `loadEnv` como Fase 0; (b) provenance vía `source_snapshot`/`SnapshotWriter` existentes, no un `crudo_r2_key` paralelo; (c) `MONEY_PUBLIC_ENABLED` flip **eliminado** (gate humano LOCKED); (d) ChileCompra/SERVEL + RUT-01 diferidos a Fase 5; (e) `cruce_senal` no es espejo de `arista`; (f) `sector_id` fuera de `FichaSchema` literal (rompe SEM-02) → eval propio; (g) señales de voto chocan con 17-LEGAL-DOSSIER §2 → arrancan OFF; (h) sensibilidad LLM de contrapartes (FND-06).
- **Designs #4/#5/#7/#9 no venían con bloque detallado** en el payload — solo #1/#2/#3 y las referencias #6/#8/#10 de la instrucción. Mapeé #6=ficha-parlamentario, #8=ficha-proyecto, #10=gate legal según el insight de ruta crítica dado, y ubiqué cada uno por su rol de dependencia. Si #4/#5/#7/#9 existen con diseños propios, faltan en el input y habría que insertarlos en su fase correspondiente.
- **Efforts corregidos** reflejados (#1 slice=L, #1 total=XL, #2=XL, #3=L).
