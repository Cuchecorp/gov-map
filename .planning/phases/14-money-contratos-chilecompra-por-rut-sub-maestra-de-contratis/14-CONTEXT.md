# Phase 14: MONEY Contratos — ChileCompra por RUT + sub-maestra de contratistas - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning
**Mode:** mvp

<domain>
## Phase Boundary

Primera rebanada del bloque MONEY: el ciudadano ve los contratos del Estado **asociados al RUT** de un parlamentario, redactados estrictamente como tales (nunca "del parlamentario"), con la regla RUT-exacto como único camino de enlace y una sub-maestra de contratistas para agregación futura (Phase 16). Conector `@obs/dinero` (ChileCompra `api.mercadopublico.cl`) → reconciliación RUT-exacto → sección de ficha. Requirements: MONEY-01, MONEY-02.

**Gate de exposición (heredado de Phase 13):** toda ruta pública MONEY nace detrás de `moneyPublicEnabled()` (default OFF) y las tablas MONEY nacen deny-by-default a `anon` (RLS + revoke). No se enciende nada hasta el sign-off legal real (deuda operador F13). Se construye la rebanada completa; la exposición queda apagada.

</domain>

<decisions>
## Implementation Decisions

### Conector @obs/dinero — ingesta ChileCompra
- Estrategia: `api.mercadopublico.cl`, búsqueda por proveedor/RUT; barrido **serial por RUT** de la maestra respetando el delay 2–3s LOCKED vía **pgmq**; escape hatch de GitHub Actions para el barrido masivo/inicial.
- DV módulo-11: reusar/extender la utilidad de RUT existente en `packages/identity` (`backfill-rut.ts` / `deterministic.ts`); **nunca fabricar RUT**; RUT inválido → cuarentena, nunca fila silenciosa.
- Natural vs jurídica + sub-maestra: etiquetar persona natural vs jurídica por tipo de proveedor; crear sub-maestra `contratista` keyed por RUT del proveedor; el sujeto del contrato es la **entidad proveedora**, distinta de cualquier enlace al parlamentario.
- Provenance: provenance + fecha de corte **por fila** (mismo patrón que `@obs/lobby` / `@obs/probidad`). R2 está bloqueado (probado) → omitir el snapshot crudo y dejar marca; no bloquear por R2.

### Enlace RUT-exacto + estados honestos
- Regla de enlace (criterio duro): el enlace contrato→parlamentario se fija **ÚNICAMENTE por RUT-exacto** contra el RUT interno de la maestra; **nunca por nombre**; un RUT sin match exacto no produce atribución (NULL + mención cruda, vía el invariante tipado `EnlaceConfirmado`).
- Estados honestos: distinguir tres estados — "enlazado" / "consultado sin contratos" / "no consultado todavía" — vía un marcador de ingesta por parlamentario (como `lobby_ingesta_estado` / `probidad_ingesta_estado`). Un vacío nunca se lee como "limpio".
- RUT no poblado (deuda IDENT-10): el RUT interno de la maestra aún NO está poblado (no hay fuente oficial cruzable; deuda de operador). El conector se construye igual; donde no hay RUT interno, el parlamentario queda **"no consultado todavía"** de forma honesta. No inventar RUT, no bloquear la fase.
- Sub-maestra contratistas: tabla `contratista` cruda keyed por RUT proveedor; deny-by-default a `anon` si contiene cualquier PII; la agregación por contraparte vive en Phase 16.

### Sección de ficha + gate de exposición
- Gate: la sección de ficha y el RPC público de MONEY van detrás de `moneyPublicEnabled()` (default OFF, server-only); las tablas MONEY nacen deny-by-default a `anon` (RLS + `revoke all ... from anon, authenticated`) hasta el sign-off.
- Redacción: título "Contratos del Estado **asociados al RUT**" (NUNCA "del parlamentario"); carril propio (`mt-12`) + `ProvenanceBadge` + fecha de corte por fila; atribución de fuente ChileCompra = **"mención de la fuente"** (NO CC BY 4.0).
- Persona jurídica en UI: el sujeto mostrado es la entidad proveedora, separada visualmente de cualquier enlace al parlamentario; un contrato a persona jurídica nunca se colapsa en una atribución personal.
- Anti-insinuación: sin lenguaje causal ni de afinidad; cada dataset en su propio carril; regla anti-"máquina de sospechas" fijada en Phase 11.

### Claude's Discretion
- Nombres exactos de tablas/columnas y número de migración (siguiente disponible tras 0023), consistentes con el esquema existente.
- Forma exacta de los query builders de `api.mercadopublico.cl` y estructura interna del paquete `@obs/dinero` (espejando `@obs/probidad`).
- Paginación/orden de la lista de contratos en la ficha.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@obs/probidad` (`packages/probidad/src/*`) es el análogo de conector más cercano: `connector-*.ts`, `parse-*.ts`, `reconciliar-declarante.ts`, `writer.ts`/`writer-supabase.ts`, `ingest-cli.ts`, `ingest-run.ts`, `model.ts`, marcador `*_ingesta_estado`. `@obs/dinero` lo espeja.
- RUT/DV módulo-11 + lógica determinista en `packages/identity` (`backfill-rut.ts`, `deterministic.ts`) y golden set (`packages/adjudication`, `packages/fichas`).
- Invariante de writer tipado `EnlaceConfirmado` (Phase 9) — el enlace RUT-exacto lo reusa para impedir atribución sin match determinista.
- Gate `app/lib/money-gate.ts` (`moneyPublicEnabled`, Phase 13) — la sección de ficha lo consume.
- Secciones de ficha `app/components/{lobby,patrimonio,votos}-*.tsx` con carril propio + `ProvenanceBadge` + 3 estados honestos.

### Established Patterns
- Migraciones SQL en `supabase/migrations/` con pgTAP; RLS deny-by-default + `revoke` para PII (0021/0022 lo hacen bien).
- pgmq + pg_cron para barrido con rate-limit; GitHub Actions como escape hatch para crawls largos.
- RPCs security-definer por parlamentario (`*_de_parlamentario`).

### Integration Points
- `/parlamentario/[id]/page.tsx` (nueva sección apilada, gateada).
- Maestra de parlamentarios (RUT interno) para el cruce; marcador de ingesta por parlamentario.
- `.env.example` ya tiene `MONEY_PUBLIC_ENABLED`.

</code_context>

<specifics>
## Specific Ideas

- "Contratos asociados al RUT", no "contratos del parlamentario" — la redacción es parte del contrato de honestidad, no cosmética.
- El barrido por RUT depende del RUT interno poblado; mientras sea deuda de operador, la cobertura real será baja y eso se muestra honestamente ("no consultado todavía"), no como ausencia de contratos.

</specifics>

<deferred>
## Deferred Ideas

- Agregación de contratos por contraparte/empresa — Phase 16.
- Encendido real de `MONEY_PUBLIC_ENABLED` + sign-off legal — operador (F13).
- Poblar el RUT interno de la maestra (IDENT-10) — operador; no inventar RUT.

</deferred>
