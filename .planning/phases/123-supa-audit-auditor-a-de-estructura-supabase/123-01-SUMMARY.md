---
phase: 123
plan: 01
subsystem: supabase-audit
tags: [preflight, metodo, manifiesto, supabase-ops, read-only]
requires: []
provides:
  - ".supabase-ops.yaml (SSoT del HOOK de supabase-ops)"
  - "123-SUPA-AUDIT-00-METODO.md (regimen, vocabulario, plantilla, ejes)"
affects: [123-02, 123-03, 123-04, 123-05, 123-06]
tech-stack:
  added: []
  patterns: ["auditoria contra la DB viva, jamas contra supabase/migrations"]
key-files:
  created:
    - .supabase-ops.yaml
    - .planning/phases/123-supa-audit-auditor-a-de-estructura-supabase/123-SUPA-AUDIT-00-METODO.md
  modified: []
decisions:
  - "El vocabulario de veredicto queda LOCKED en tres valores: conforme / offender / limite-declarado"
  - "destino de offender queda LOCKED en cuatro valores: 124-aditivo / supabase-architect+checkpoint / guard / deuda-operador"
  - ".supabase-ops.yaml queda VERSIONADO en git, con prohibicion de credenciales escrita dentro del propio archivo"
  - "La Phase 124 numera sus migraciones desde 0073 (ultimo ARCHIVO del repo), no desde el ultimo del ledger"
metrics:
  duration: "~25 min"
  completed: 2026-07-29
  tasks: 2
  commits: 2
---

# Phase 123 Plan 01: Método y preflight SUPA-AUDIT — Summary

Preflight de `supabase-ops` satisfecho con un manifiesto bootstrapeado contra PROD (57 tablas / 42
funciones verificadas) y método de los seis ejes LOCKED con el gotcha de `schema_migrations`
demostrado: 15 migraciones están aplicadas en la DB viva sin figurar en el ledger.

## Qué se hizo

### Task 1 — `.supabase-ops.yaml` (commit `45665cf`)

Manifiesto SSoT en la raíz del repo, con la estructura de `manifest.example.yaml` rellenada con
hechos **verificados contra PROD**, no adivinados. Claves de primer nivel presentes: `project`,
`environments`, `dead_refs`, `corpus`, `embeddings`, `storage`, `deploy`, `connections`,
`drift_patterns`, `model_routing_overrides`, `canonical_docs`, `debt_ledger`.

Parsea limpio (validado con `yaml@2.9.0` del store pnpm): 57 tablas, 42 funciones, `dim=768`,
`type=vector`, `index=hnsw`, `distance=cosine`, `buckets=[]`, `prod.ref=bctyygbmqcvizyplktuw`.

### Task 2 — `123-SUPA-AUDIT-00-METODO.md` (commit `b71b6f5`)

Fragmento rector con §0.0 a §0.6 completas, espejando el molde de 122. Vocabulario de veredicto de
tres valores, plantilla de offender de 7 columnas con `destino` de vocabulario cerrado, los seis ejes
asignados a 123-02/03/04 sin huérfanos, y el gotcha demostrado con tres queries transcritas.

## Evidencia clave

### Ancla temporal (ejecutada)

```
2026-07-29|UTC|PostgreSQL 17.6 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit
```

### Corpus vivo (filtro `pg_depend deptype='e'` aplicado)

**57 tablas** en `public`: `actualidad_senal, aporte, aportes_ingesta_estado, arista, citacion,
citacion_invitado, citacion_punto, comision, comision_membresia, consentimiento, contratista,
contrato, contratos_ingesta_estado, cruce_senal, declaracion, declaracion_accion_derecho,
declaracion_actividad, declaracion_bien_inmueble, declaracion_bien_mueble, declaracion_familiar,
declaracion_pasivo, declaracion_valor, donante, drift_alert, entidad, entidad_tercero,
entidad_tercero_alias, identidad_audit, ingest_run, leyes_rotacion_estado, leylobby_cursor_estado,
lobby_audiencia, lobby_contraparte, lobby_ingesta_estado, notificacion_envio, parlamentario,
parlamentario_alias, parlamentario_bio, parlamentario_militancia, pii_contraparte_declaracion,
probidad_ingesta_estado, proyecto, proyecto_autor, proyecto_embedding, proyecto_ficha,
revision_entidad, revision_identidad, sector, sesion_sala, sesion_tabla_item, source_snapshot,
suscripcion, tramitacion_evento, vinculo_entidad, vinculo_identidad, votacion, voto`

**42 funciones** en `public`: `actualidad_senales_panel, agregado_por_contraparte,
agregado_por_contraparte_cap, aportes_de_parlamentario, bienes_de_parlamentario, buscar_citaciones,
buscar_proyectos_hibrido, co_comisionados_de_parlamentario, coautores_de_parlamentario,
coincidencia_votos_par, comisiones_de_parlamentario, comparar_declaraciones,
contratos_de_parlamentario, copartidarios_de_parlamentario, cruces_de_parlamentario,
cruces_de_proyecto, de_la_misma_zona, declaraciones_de_parlamentario,
entidad_tercero_estado_no_regresa, f_unaccent, identidad_audit_immutable, lobby_de_parlamentario,
lobby_en_tramitacion, lobby_menciones_de_boletin, match_proyectos,
militancia_historica_compartida, militancias_de_parlamentario, parlamentario_estado_no_regresa,
parlamentario_publico, parlamentario_publico_v2, parlamentarios_publico, parlamentarios_publico_v2,
rebeldias_de_parlamentario, resolver_entidad, resolver_identidad, subgrafo_red,
tasa_ausencia_comparada, vinculo_entidad_guarda, vinculo_entidad_guarda_insert,
vinculo_identidad_guarda, vinculo_identidad_guarda_insert, votos_de_parlamentario`

### Embeddings (verificados, no asumidos)

```
embedding|vector(768)
CREATE INDEX proyecto_embedding_hnsw ON public.proyecto_embedding USING hnsw (embedding vector_cosine_ops) WITH (m='16', ef_construction='64')
```

### El gotcha de `schema_migrations` — demostrado

Ledger: 55 versiones. Repo: 70 archivos. **15 migraciones existen como archivo y NO figuran en el
ledger**: `0026`, `0028`, `0030`, `0031`, `0052`, `0059`–`0068`. Las diez del tramo `0059`–`0068`
dieron `t` en la prueba de existencia de objeto — **están aplicadas**. `0052` (gate MONEY) también
(`aportes_de_parlamentario` y `contratos_de_parlamentario` presentes). Además `0027` y `0029` no
existen en ninguna de las dos caras: hueco de numeración propio del repo.

Conclusión LOCKED: **leer los archivos de migración da una foto FALSA; la DB viva manda.**

## Desviaciones (RULE-1: manda la realidad)

**1. [RULE-1] El plan proponía probar 0064 con `cruces_de_parlamentario`; esa función NO lleva `statement_timeout`.**

- **Encontrado en:** Task 2, al construir la prueba de existencia del §0.4.
- **Antes:** la consulta propuesta habría devuelto `f` para 0064 y roto la demostración.
- **Después:** se enumeró `pg_proc.proconfig` y se encontró que 0064 aplicó `statement_timeout=5s`
  (+ `search_path=""`) a **13 funciones**, entre ellas `co_comisionados_de_parlamentario`, que es la
  que se usó como testigo. La demostración da `t` en las diez.
- **Hallazgo derivado que hereda 123-03 (eje 4):** `cruces_de_parlamentario`,
  `cruces_de_proyecto`, `votos_de_parlamentario`, `lobby_de_parlamentario`,
  `aportes_de_parlamentario`, `contratos_de_parlamentario`, `bienes_de_parlamentario`,
  `declaraciones_de_parlamentario`, `rebeldias_de_parlamentario`, `subgrafo_red`,
  `buscar_citaciones`, `match_proyectos`, `tasa_ausencia_comparada`, `comparar_declaraciones` y
  `agregado_por_contraparte*` **NO** llevan `statement_timeout` en `proconfig`. Eso es
  **candidato a offender del eje 4** (bounded) — **no se resolvió aquí**: esta fase no corrige, y el
  barrido completo del eje 4 es 123-03.
- **Commit:** `b71b6f5`

**2. [RULE-1] El plan asumía que el ledger empezaba a fallar en 0059; falla antes.**

- **Antes:** "las migraciones 0059-0068 fueron aplicadas sin traza".
- **Después:** el hueco es mayor — `0026`, `0028`, `0030`, `0031` y `0052` también faltan. La tabla
  de contraste del §0.4 registra las 15, no las 10.
- **Commit:** `b71b6f5`

**3. [RULE-1] `storage.buckets` está VACÍO en PROD pese a `SERVEL_CRUDO_BUCKET=crudo-servel` en `.env.example`.**

- El manifiesto lo registra como `supabase_buckets: []` (el hecho) con nota, y se marca como
  **offender candidato del eje 6** para 123-04. No se creó ningún bucket (sería DDL + deuda de
  operador).
- **Commit:** `45665cf`

**4. [RULE-1] `R2_BUCKET` está vacío en `.env.example`** ⇒ el nombre del bucket R2 va como
`UNKNOWN — verify`, no inventado. `.env` no se leyó para rellenarlo (prohibido por el régimen).

## Contrato que heredan 123-02 / 123-03 / 123-04

1. **Régimen** (§0.0): read-only, cero DDL/DML/`db push`/deploy/flags, cero PII, filtro
   `pg_depend deptype='e'` **siempre**, cero requests a fuentes gubernamentales.
2. **Vocabulario de veredicto** (§0.1): exactamente `conforme` · `offender` · `limite-declarado`.
   Sin cuarto valor ni prosa libre.
3. **Régimen de evidencia — autoritativa vs contraste** (§0.1 + §0.4):
   - **Autoritativa** = consulta a los catálogos de la **DB viva** (`pg_class`, `pg_proc`,
     `pg_policies`, `pg_depend`, `information_schema`, `storage.buckets`). **Solo esto** sostiene un
     veredicto.
   - **De contraste** = archivos del repo (`supabase/migrations`, `app/lib/*`), SUMMARYs previos,
     memoria. Sirven para **formular hipótesis y detectar drift**, **jamás** para cerrar un
     veredicto. Cuando la evidencia de contraste contradice a la autoritativa, **manda la
     autoritativa** y la contradicción se registra como hallazgo.
   - **Regla dura:** `conforme` sin bloque ```sql asociado es INVÁLIDO; 123-06 lo rechaza.
4. **Plantilla de fila de offender** (§0.2): 7 columnas en orden fijo
   `| # | objeto (tipo · nombre) | eje | riesgo | fix propuesto | query que lo detectó (Q-NN) | destino |`.
   La query **nunca** dentro de la celda: identificador `Q-NN` → bloque ```sql numerado en el mismo
   fragmento. `destino` ∈ {`124-aditivo`, `supabase-architect+checkpoint`, `guard`,
   `deuda-operador`}.
5. **Asignación de ejes** (§0.3): 1-2-3 → **123-02**; 4-5 → **123-03**; 6 → **123-04**. Corpus de
   partida = 57 tablas / 42 funciones; auditar menos exige `limite-declarado` explícito.
6. **Riesgo rector** (§0.5): el sitio lee con `service_role` ⇒ RLS no lo protege; el guard CI
   `app/lib/lockdown-guard.test.ts` es parte del boundary (eje 6). Allowlist en **ambos sentidos**.
7. **Numeración de fixes:** la Phase 124 arranca en **`0073`** (siguiente al último *archivo* del
   repo, no al último del ledger), y ninguna migración de 124 puede asumir estado leyendo el ledger.
8. **Ancla temporal común:** `2026-07-29`, TimeZone `UTC`, PostgreSQL **17.6**.

## Known Stubs

Ninguno. Los campos no verificables del manifiesto llevan literalmente `UNKNOWN — verify`
(`embeddings.task_type_*`, `storage.r2_buckets[0].name`, `deploy.env_var_canonical`,
`connections.frontend_ef`, `connections.hyperdrive`, `debt_ledger`), que es el contrato del propio
plan, no un stub encubierto.

## Threat Flags

Ninguno. Esta fase no introdujo superficie: cero endpoints, cero rutas de auth, cero cambios de
schema. Los dos artefactos son documentación versionada y fueron greppeados contra fuga de
credenciales.

## Verificación

- `test -f .supabase-ops.yaml` + grep anti-secreto (los 8 patrones del `<automated>` del plan: esquemas de connection string, claves secretas y publicables de Supabase, PAT de Supabase, prefijo JWT, access-key-id S3, `SERVICE_ROLE_KEY`, y credenciales embebidas en URL) + `bctyygbmqcvizyplktuw` + cabecera `PROHIBIDO todo valor de credencial` → **OK**
- Fragmento 00: `## 0.1 Vocabulario de veredicto` + `pg_depend` + `schema_migrations` + `service_role` + cero connection strings → **VERIFY_OK**; los 7 encabezados `## 0.0`–`## 0.6` presentes; 5 referencias a `supabase-ops.yaml`

> Nota: los patrones anti-secreto se describen aquí en prosa a propósito. Transcribirlos literales
> hacía que este mismo SUMMARY disparara el escáner (falso positivo sin credencial alguna).
- `git status`: **cero** cambios en `supabase/migrations/`, `app/`, o cualquier `.env`. Los tres
  entries sucios (`119-REVIEW.md`, `pnpm-workspace.yaml`, `122-VERIFICATION.md`) son **preexistentes**
  a este plan.

## Self-Check: PASSED

- FOUND: `.supabase-ops.yaml`
- FOUND: `.planning/phases/123-supa-audit-auditor-a-de-estructura-supabase/123-SUPA-AUDIT-00-METODO.md`
- FOUND: commit `45665cf`
- FOUND: commit `b71b6f5`
