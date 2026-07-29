# Phase 122: CRUCE-SQL — Cruces visibles × SQL de PROD - Context

**Gathered:** 2026-07-29
**Status:** Ready for planning
**Mode:** Smart discuss autónomo — decisiones del operador YA RESUELTAS en `.planning/PROMPT-v12.0-build-autonomo.md` (pasada 3). No se re-preguntó.

<domain>
## Phase Boundary

Recalcular con **SQL verbatim contra PROD** cada número de cruce que el sitio muestra, compararlo
con lo que emite el deploy real, y **corregir o declarar** toda discrepancia. Cubre:

1. **Relaciones entre parlamentarios** (5 bloques de ficha)
2. **`/comparar`** — 4 ejes + VSIM ("coinciden en N de M" contra `coincidencia_votos_par`; precedente 104-03, 3 pares)
3. **Cruces de ficha y de proyecto** (migraciones 0047–0050; `cruces_de_proyecto`, `cruce_senal`)
4. **Panel de actualidad** — 6 señales × SQL (precedente 104)
5. **lobby↔PL** — `lobby_menciones_de_boletin`, cobertura declarada ~3.8%
6. **`lobby_sector_aporte`** — 0 filas es **HONESTO** (stub estructural de 0052, NO bug)

**Fuera de alcance:** cambios de esquema no aditivos (van a 124), el deploy de los fixes de UI
(viaja agrupado con 125), links y fechas (114/115/117 ya cerradas).
</domain>

<decisions>
## Implementation Decisions

### Método de recálculo
- **SQL verbatim contra PROD**, read-only, vía `set -a; source .env; set +a` + `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "…"`. Jamás se ecoa ni escribe el valor de `SUPABASE_DB_URL`.
- **Conteos por `psql -tA`, nunca por REST** — PostgREST capa a 1.000 filas. Donde el sitio lee por RPC, se invoca la MISMA RPC por psql y además la query "de primeros principios" que la RPC pretende implementar; ambas se comparan.
- Sujetos concretos **deterministas por SQL**, reutilizando los sujetos ya elegidos por el inventario 113 (§1.1–1.3: `D1165`, `S1338`, boletín A) para que 122 y 125 hablen del mismo caso.
- Cero requests a fuentes gubernamentales ⇒ el rate-limit 2-3 s no aplica a esta fase. Cero PII (ni RUT, ni monto individual): se registran nombres de columna y conteos agregados, nunca valores PII.

### Registro de evidencia
- Un artefacto único por fase (`122-CRUCES-SQL.md`) con una fila por cruce visible: superficie + archivo:línea del emisor + RPC/columna de origen + **query verbatim** + **número SQL** + **número mostrado en el deploy** + veredicto (`cuadra` / `discrepancia-corregida` / `discrepancia-declarada`).
- Toda discrepancia queda con **ambos números y la query**, aunque se corrija.
- El artefacto declara su método y su cobertura, igual que 113. Cero cruces "asumidos": el universo sale del inventario 113 (`consumido_por` incluye 122).

### Denominadores y cobertura
- **Denominador honesto**: excluye `estado_vinculo <> 'confirmado'` (lobby) y pareos no confirmados donde corresponda. Si el denominador mostrado incluye lo no confirmado, es discrepancia y se arregla.
- Donde la cobertura es **parcial**, se declara en la superficie (p. ej. lobby↔PL ~3.8%) con el idiom aprobado; el número parcial nunca se presenta como total.
- Recalcular la cobertura declarada contra PROD — si el ~3.8% cambió, se actualiza el copy con la cifra observada y su fecha.

### Vacíos y copy
- **Cero filas se presenta como cero** — jamás se rellena, jamás se oculta la superficie. `lobby_sector_aporte` con 0 filas es el caso canónico: stub estructural honesto, no bug.
- Copy sin causalidad ni intención. Si un fix de copy toca vocabulario nuevo → **extender el linter anti-insinuación ANTES del copy** (patrón Wave-0 de v10.0/v11.0).
- `fecha_captura` JAMÁS se presenta como el hecho; "captura" pelado PROHIBIDO; idiom aprobado "según fuente al…".

### Régimen de fixes
- **Validar-y-arreglar**: los fixes de conteo/denominador/declaración se aplican inline en el código del sitio o como **migración aditiva numerada** (siguiente después de 0072) por `psql --single-transaction -f`, JAMÁS `supabase db push`.
- Cambio destructivo (drop / cambio de tipo / backfill) → NO se ejecuta: se delega el diseño a `supabase-architect` y se bloquea en checkpoint de operador.
- RPC pública nueva = aguja completa (cero-grant `>0044`, secdef PII-safe con `search_path`, `PUBLIC_RPC_ALLOWLIST`, bounded).
- El **deploy** de los fixes de UI **no se hace aquí** — viaja agrupado con 125.

### Claude's Discretion
- Orden de ataque de los 6 grupos de cruces, granularidad de los planes, y forma exacta de las tablas del artefacto.
- Si un cruce resulta imposible de recalcular sin datos que no existen en PROD, se **declara como límite** con evidencia (patrón "vacío honesto") en vez de fabricar el número.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.planning/phases/113-inv-inventario-rector-de-superficies/113-INVENTARIO.md` (1959 líneas, `estado: validado`) — universo de superficies, emisores con archivo:línea, RPCs por superficie, y sujetos deterministas §1.1–1.3.
- `.planning/phases/113-…/check-inventario.sh` — método re-ejecutable.
- RPCs ya inventariadas: `lobby_de_parlamentario`, `comparar_declaraciones`, `cruces_de_proyecto`, `lobby_menciones_de_boletin`, `coincidencia_votos_par`, `declaraciones_de_parlamentario`, `bienes_de_parlamentario`.
- Emisores clave: `app/components/panel-actualidad.tsx`, `app/app/comparar/page.tsx`, `app/components/similitud-votacion-comparar.tsx`, `app/components/lobby-menciones-de-boletin.tsx`, `app/components/lobby-de-parlamentario.tsx`.
- `app/lib/parlamentario-resumen-conteos.ts` — punto único donde se calculan los conteos de la ficha.

### Established Patterns
- Precedente 104 (panel de actualidad × SQL) y 104-03 (VSIM sobre 3 pares) — mismo método de recálculo.
- Migraciones 0047–0050 definen los cruces de ficha/proyecto; 0052 es el stub de `lobby_sector_aporte`.
- Guards de régimen en CI: anti-insinuación, lockdown 22, anti-flip (vsim/notif/money), bento, name-match-rut, env-example, integ-scope, provider-guard.

### Integration Points
- Gates observados en el deploy auditado: NET ON, CRUCES ON, VSIM ON, MONEY OFF, NOTIF OFF. Los flags `*_PUBLIC_ENABLED` **no se tocan**.
- Suite de referencia: app ~1428 tests + packages verdes + `tsc` 0. Cada plan la deja verde.
- Sitio PROD: https://observatorio-congreso.thevalis.workers.dev — Supabase ref `bctyygbmqcvizyplktuw`.
</code_context>

<specifics>
## Specific Ideas

- VSIM: cuadrar el literal "coinciden en N de M" contra `coincidencia_votos_par` sobre al menos los 3 pares del precedente 104-03.
- Panel de actualidad: las 6 señales, una query por señal.
- lobby↔PL: verificar que el ~3.8% de cobertura declarado sigue siendo la cifra observada.
- `lobby_sector_aporte` = 0 filas: dejar registrado explícitamente como **honesto** para que un auditor futuro no lo lea como bug.
</specifics>

<deferred>
## Deferred Ideas

- Deploy de los fixes de UI → **Phase 125** (agrupado).
- Defectos de estructura/seguridad de la DB (grants, RLS, allowlist) → **Phases 123/124**.
- Ampliar la cobertura de lobby↔PL más allá de lo ingerido → fuera del milestone (deuda de datos).
</deferred>
