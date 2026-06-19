# Phase 15: MONEY Financiamiento — SERVEL verbatim + sub-maestra de donantes - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning
**Mode:** mvp

<domain>
## Phase Boundary

El ciudadano ve el financiamiento de campaña de un parlamentario **verbatim**, ingerido por un conector SERVEL artesanal y frágil que se pone en **cuarentena** ante cualquier corrida parcial — una declaración por omisión es inaceptable. Conector SERVEL dentro de `@obs/dinero` (reusa el patrón ChileCompra de Phase 14) → sub-maestra de donantes → reconciliación RUT-exacto del candidato → sección de ficha. Requirements: MONEY-03, MONEY-04.

**Gate de exposición (heredado de Phase 13):** toda ruta pública MONEY nace detrás de `moneyPublicEnabled()` (default OFF); las tablas MONEY nacen deny-by-default a `anon` (RLS + revoke). No se enciende nada hasta el sign-off legal real (deuda operador F13). Se construye la rebanada; la exposición queda apagada.

</domain>

<decisions>
## Implementation Decisions

### Conector SERVEL — ingesta verbatim + drift bloqueante
- Fuente/formato (CONFIRMADO live por research 2026-06-19): la fuente real NO es `servel.cl` directo sino un **Azure Blob** `repodocgastoelectoral.blob.core.windows.net`, con **`.xlsx` por elección** (GET anónimo, ~16k filas, 11 columnas). Agregar ese host como **host EXACTO con scope al conector SERVEL**, NO como sufijo gov en `DEFAULT_ALLOWED_SUFFIXES` (ampliaría SSRF). Parser xlsx nuevo (`exceljs@4.4.0` recomendado) tras `checkpoint:human-verify` (slopcheck roto en Windows). Parse **verbatim sin LLM**. La URL por elección la provee el operador (generalización MEDIUM, 2 ejemplos live).
- **A1 RESUELTO (decisión de operador 2026-06-19): la fuente SERVEL NO trae RUT — ni donante ni candidato, solo NOMBRES.** Con la regla RUT-exacto LOCKED, el enlace aporte→parlamentario confirma **cero filas hoy**; todos los aportes quedan en estado honesto **"no-verificado"** (sin atribución) hasta que exista un puente nombre→RUT de candidatos en una fase futura. Esto es fail-closed y coherente con el principio anti-atribución-por-nombre. Se construye igual: conector verbatim + sub-maestra de donantes + sección gated. NUNCA enlazar por nombre para "rellenar" la cobertura.
- Drift **BLOQUEANTE** (NO el default no-bloqueante de v1.0): una corrida parcial se pone en **cuarentena** con reconciliación de completitud (conteos/totales por elección/candidato), nunca emite filas silenciosamente.
- **Crudo → Supabase Storage** (decisión 2026-06-19): R2 era el destino del criterio original, pero R2 S3 devuelve **401 Unauthorized** con las credenciales provistas (re-probado 2026-06-19 vía `scripts/r2-probe.ts`, ambos addressing styles → 401). Fallback a **Supabase Storage** para recuperabilidad del crudo (funciona). R2 queda como deuda de operador (regenerar token Object Read & Write de la cuenta correcta). Ver [[env-credentials-reality]].
- Sub-maestra donantes: tabla `donante` cruda keyed por RUT donante (cuando exista) + nombre; deny-by-default a `anon` si contiene PII; construida en este bloque, no diferida a NET.

### Enlace + periodo electoral + estados honestos
- Enlace aporte→parlamentario: RUT-exacto del **candidato** contra la maestra interna (reusa el invariante `EnlaceConfirmado` RUT-only de Phase 9, igual que contratos); **nunca por nombre**; sin match → sin atribución.
- Restricción por periodo electoral: cada aporte fechado y restringido por periodo; un aporte de una candidatura previa **nunca** se atribuye al mandato actual sin fecharlo (mostrar elección/periodo explícito).
- Estados honestos: verificado / no-verificado / no-ingestado vía marcador de ingesta; un vacío nunca se lee como "limpio".
- Dato sensible (afiliación): un aporte de campaña puede revelar afiliación política (dato sensible Ley 21.719); el RUT del donante queda interno/deny-by-default y pasa por la compuerta `data-routing` del LLM (ningún RUT/PII al LLM).

### Ficha + gate de exposición
- Gate: la sección de financiamiento y el RPC público van detrás de `moneyPublicEnabled()` (default OFF); las tablas nacen deny-by-default a `anon` (RLS + `revoke all ... from anon, authenticated`).
- Redacción/atribución: financiamiento **verbatim** con fuente/fecha/enlace por fila; atribución SERVEL = **términos por verificar** (NO asumir CC BY 4.0; research confirma); carril propio (`mt-12`) + `ProvenanceBadge`.
- Anti-insinuación: sin lenguaje causal ni de afinidad; cada dataset en su propio carril (regla Phase 11).

### Claude's Discretion
- Nombres exactos de tablas/columnas y número de migración (siguiente tras 0023), consistentes con el esquema.
- Estructura interna del conector SERVEL dentro de `@obs/dinero` (espejando el patrón ChileCompra) y los parsers verbatim del formato real.
- API exacta del helper de Supabase Storage para el crudo (bucket, key versionada `servel/<eleccion>/<fecha>/<hash>`).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@obs/dinero` (Phase 14): patrón de conector (connector/parse/reconciliar/writer/writer-supabase/ingest-run/ingest-cli/model), `EnlaceConfirmado` RUT-only, marcador `*_ingesta_estado`, `assertAllowedUrl` + allowlist. SERVEL extiende este paquete.
- RUT/DV módulo-11 en `packages/identity` (`deterministic.ts`); reusar, no reimplementar.
- Gate `app/lib/money-gate.ts` (`moneyPublicEnabled`); secciones de ficha `app/components/*-de-parlamentario.tsx`.
- Patrón RLS deny-by-default + revoke + RPC security-definer (migraciones 0021/0022/0023).
- Supabase Storage: cliente `@supabase/supabase-js` ya en uso (writer-supabase de los conectores) — destino del crudo.

### Established Patterns
- Migraciones SQL + pgTAP; deny-by-default verificado por test (anon 0 SELECT grant).
- pgmq + delay 2–3s para barrido con rate-limit; GitHub Actions escape hatch.

### Integration Points
- `/parlamentario/[id]/page.tsx` (nueva sección apilada, gateada, debajo de #dinero/contratos).
- Maestra de parlamentarios (RUT interno) para el cruce del candidato; marcador de ingesta por parlamentario.
- `.env.example` (posible secreto/credencial SERVEL si la descarga lo requiere; bucket de Supabase Storage para el crudo).

</code_context>

<specifics>
## Specific Ideas

- El conector SERVEL es deliberadamente "artesanal frágil": la postura por defecto ante incertidumbre es **cuarentena**, no emisión. Una fila silenciosa es peor que ninguna fila.
- R2 quedó 401 con las credenciales provistas el 2026-06-19; el crudo va a Supabase Storage por ahora. No re-intentar R2 sin un token nuevo verificado con `scripts/r2-probe.ts`.

</specifics>

<deferred>
## Deferred Ideas

- Agregación de aportes por contraparte/donante — Phase 16.
- Encendido real de `MONEY_PUBLIC_ENABLED` + sign-off legal — operador (F13).
- Poblar el RUT interno de la maestra (IDENT-10) — operador; cobertura real ~0 hasta entonces ("no consultado todavía").
- Migrar el crudo a R2 cuando el token R2 funcione (deuda operador).

</deferred>
