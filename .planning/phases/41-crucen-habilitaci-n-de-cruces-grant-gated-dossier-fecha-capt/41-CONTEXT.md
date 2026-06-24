# Phase 41: CRUCEN — Habilitación de cruces (grant gated + dossier + fecha_captura) - Context

**Gathered:** 2026-06-24
**Status:** Ready for research+planning (ventana fresca; research = sonnet-swarm + validadores Opus)
**Source:** Deuda destapada por el code-review de Phase 37 (37-REVIEW.md: WR-01 fixed, **WR-02 deferred**) + el gate legal interactivo de Phase 39 (F17 NET firmado; cruces quedó OFF con 3 bloqueos). Esta fase NO re-diseña la superficie de cruces (eso fue Phase 36/37); cierra las 3 deudas que faltan para que `crucesPublicEnabled` sea **firmable y encendible** — sin firmarla ni encenderla.

<domain>
## Phase Boundary

Dejar la superficie de cruces (`/parlamentario/[id]` → `CrucesSection`, construida en Phase 37, gated OFF) **lista para encender**, cerrando los 3 bloqueos. **NO se enciende, NO se firma, NO se aplica el grant** — eso es Phase 39 (humano) + operador.

**EN ALCANCE (3 deliverables, granulares):**
- **CRUCEN-01 — Fix WR-02 (frescura honesta), vertical slice:** nueva migración `0041` que cambia el RPC `cruces_de_parlamentario` para PROYECTAR `cruce_senal.fecha_captura`; `CrucesSection`/`CrucesView` la usan como `capturedAt` del `ProvenanceBadge`; tipos + tests. Aplicable a PROD (operador checkpoint) porque NO concede nada.
- **CRUCEN-02 — Grant gated:** nueva migración `0042` con `grant execute ... to anon` del RPC, **escrita y commiteada pero NO aplicada** (apply = checkpoint humano post-sign-off). pgTAP + guard.
- **CRUCEN-03 — Dossier legal de cruces:** `docs/legal/...-LEGAL-DOSSIER-CRUCES.md` (espejo de `17-LEGAL-DOSSIER-NET.md`), `signoff: pending`, prep para firma humana.

**FUERA DE ALCANCE (gates LOCKED — un agente jamás los cruza):**
- **NO flipear `crucesPublicEnabled`** (Candado B). Encender = Phase 39 (humano).
- **NO aplicar la migración de grant (0042)** a PROD. Deny-by-default hasta el sign-off legal de cruces (espejo del patrón F17/NET).
- **NO firmar el dossier de cruces** (`signoff` queda `pending`). La firma es humana, como F17.
- NO tocar la superficie de proyecto (Phase 38, diferida) ni MONEY/NET.
</domain>

<decisions>
## Implementation Decisions (LOCKED / a refinar en research)

### CRUCEN-01 — fecha_captura en el RPC + componente (vertical slice)
- **Dato disponible:** `cruce_senal` YA tiene la columna `fecha_captura` (la setea el materializador `materializar_cruces()` en `0039` con `now()` al materializar = fecha real de frescura del cruce). El RPC `0040` simplemente NO la proyecta. La fila del cruce es por (parlamentario, sector) → `fecha_captura` es a nivel de SEÑAL, no por item de evidencia; todos los items de una señal comparten esa fecha de captura (correcto: es cuándo se materializó el cruce).
- **Migración 0041:** `cruces_de_parlamentario(text)` debe devolver una columna nueva `fecha_captura timestamptz`. ⚠️ **GOTCHA (verificar en research):** agregar una columna a la `returns table` de una función **NO se puede con `create or replace`** (Postgres prohíbe cambiar el tipo de retorno) → requiere `drop function ... ; create function ...` (espejo de `0028_votos_instructivos` que hizo drop+recreate "por returns table modificado"). Tras el recreate, **re-emitir `revoke execute ... from public` Y `revoke execute ... from anon, authenticated`** (Supabase re-concede por DEFAULT PRIVILEGES a cada función nueva — lección de Phase 36/0040; el pgTAP-vs-PROD lo cazó). El RPC sigue **deny-by-default** (sin grant a anon — eso es CRUCEN-02). Proyección sigue PII-safe (sin rut/partido/donante_id).
- **Componente (`app/components/cruces-de-parlamentario.tsx`):** `capturedAt={new Date(s.fecha_captura)}` (de la SEÑAL, no `item.fecha`) en cada `ProvenanceBadge`. Esto elimina el stale-amber falso (la fecha de captura es reciente, no la fecha de la reunión). El meeting date (`item.fecha`) puede mostrarse como texto factual plano ("Reunión registrada el …") si el research lo recomienda — decisión del plan. Quitar/actualizar el comentario "LIMITACIÓN CONOCIDA (WR-02)" ya presente en el archivo.
- **Tipos (`app/lib/types.ts`):** añadir `fecha_captura: string` a `CruceSenalRpcRow`.
- **Tests:** actualizar `cruces-de-parlamentario.test.tsx` (las fixtures `makeSenal` necesitan `fecha_captura`); afirmar que el badge ya NO marca stale-amber con una fecha de captura reciente. pgTAP `0041` (columna presente + RPC sigue sin grant a anon).

### CRUCEN-02 — grant gated (escrito, NO aplicado)
- **Migración 0042:** un único `grant execute on function public.cruces_de_parlamentario(text) to anon;` (espejo del `grant` final de `subgrafo_red`/`0030:254` y `lobby_de_parlamentario`/`0021`). Es la línea que faltaba: hoy `0040` hace `revoke execute ... from anon, authenticated` y **intencionalmente NO** concede. Esta migración es ese grant, separado, para aplicar SOLO tras el sign-off.
- **NO aplicar:** la migración se commitea pero NO se corre contra PROD ni se registra en `schema_migrations`. Un guard/test (o nota en el plan) garantiza que ninguna corrida autónoma la aplica. El SUMMARY debe dejar EXPLÍCITO que 0042 queda sin aplicar.
- **pgTAP 0042:** afirma que, una vez aplicada, anon tiene EXECUTE (es la prueba para el día del encendido). Se corre SOLO post-apply (no en la corrida autónoma).
- **Orden de encendido (documentar, no ejecutar):** firmar dossier CRUCEN-03 (humano) → aplicar 0042 (operador, `psql --db-url` + `schema_migrations`) → flip `crucesPublicEnabled=true` en Cloudflare (operador). Los tres juntos.

### CRUCEN-03 — dossier legal de cruces
- **Archivo:** `docs/legal/...-LEGAL-DOSSIER-CRUCES.md`. Numeración: F13=MONEY, F17=NET mapean a su Phase; cruces = capability de Phase 36 → sugerencia `docs/legal/36-LEGAL-DOSSIER-CRUCES.md` (o nombre descriptivo). Decisión del plan; mantener consistencia con el patrón de front-matter.
- **Front-matter YAML** (espejo de `17-LEGAL-DOSSIER-NET.md`): `documento`, `alcance: CRUCES (señales parlamentario↔sector)`, `signoff: pending`, `asesor: ""`, `fecha_signoff: ""`, `observaciones: ""`, `depende_de`, `nota: "Encender crucesPublicEnabled requiere signoff: approved + aplicar el grant 0042"`.
- **Contenido (preparación, NO dictamen):** estructurar la superficie de riesgo de las señales de cruce: el **riesgo nuclear** = que la COMPOSICIÓN de hechos públicos (reuniones de lobby agregadas por sector) se lea como insinuación de afinidad/captura/conflicto (riesgo existencial #1 del proyecto); las garantías de framing ya implementadas (conteo neutro, sin verbo causal/score/afinidad, contraparte cruda + IdentityMarker, anti-insinuación §9.1, provenance por evidencia FND-08); minimización Ley 21.719 (sin rut/partido/donante_id; nombre de contraparte crudo); atribución por dataset; el **doble candado** (Candado A = RPC sin grant a anon + RLS deny-by-default sobre `cruce_senal` en 0039; Candado B = `crucesPublicEnabled` default OFF). Checklist de sign-off §9 (espejo NET) + anexo de supuestos. Cerrar con "el abogado dictamina y firma".
- **Firma = humana.** El dossier nace `pending`. (Cuando se firme, será como F17: registrar asesor/fecha/observaciones en el YAML.)

### Claude's Discretion (a resolver en research/plan)
- Número exacto del dossier de cruces y su nombre de archivo.
- Si mostrar `item.fecha` (fecha de reunión) como texto plano además del badge de frescura.
- Forma exacta del guard que impide aplicar 0042 en autónomo.
- Si CRUCEN-01 y CRUCEN-03 van en Wave 1 (independientes) y CRUCEN-02 en Wave 1 también (es solo escribir un .sql) — probablemente las 3 son independientes → 1 wave, 3 plans.
</decisions>

<canonical_refs>
## Canonical References (READ antes de planificar/implementar)

### El defecto que se arregla (la deuda)
- `.planning/phases/37-surf-superficie-de-cruces-en-ficha-de-parlamentario-gated/37-REVIEW.md` — WR-02 (frescura) + su `resolution` (deferred), WR-01 (ya fixed).
- `app/components/cruces-de-parlamentario.tsx` — el comentario "LIMITACIÓN CONOCIDA (WR-02)" + el `ProvenanceBadge` con `capturedAt={item.fecha…}` a cambiar.
- `app/components/provenance-badge.tsx` — el acople `capturedAt===null → "fuente desconocida"` + `esStale`/amber (por qué `null` NO sirve y por qué `fecha_captura` SÍ).

### Contrato de datos (en PROD — la base a modificar)
- `supabase/migrations/0040_cruces_rpc.sql` — RPC actual (returns table SIN fecha_captura; `revoke from public` + `revoke from anon, authenticated`; SIN grant).
- `supabase/migrations/0039_cruce_senal.sql` — la tabla `cruce_senal` (tiene `fecha_captura`); el materializador.

### Espejos a copiar
- `supabase/migrations/0030_net.sql` (líneas ~250-254) — patrón `revoke from public` + `grant execute ... to anon` de `subgrafo_red` (espejo para CRUCEN-02).
- `supabase/migrations/0028_votos_instructivos.sql` — patrón **drop+recreate** de una función por cambio de returns table (espejo para CRUCEN-01).
- `supabase/migrations/0021_*.sql` — `lobby_de_parlamentario` grant a anon (segundo espejo).
- `docs/legal/17-LEGAL-DOSSIER-NET.md` — **espejo estructural directo del dossier de cruces** (front-matter, secciones de riesgo, checklist §9, anexo de supuestos, descargo "prep no dictamen"). Recién firmado F17 (2026-06-24) — usar su estructura, NO su contenido NET.
- `docs/legal/13-LEGAL-DOSSIER.md` — segundo espejo (MONEY).

### Convenciones
- `CLAUDE.md` — DDL = `psql --db-url --single-transaction` + fila en `schema_migrations` (NUNCA `db push`); pnpm monorepo; frontend tests desde `app/` (`npx vitest run`).
- Memoria: `memory/v4-cruces-progreso.md` (Phase 36/37 + el gate de Phase 39; los gotchas pgTAP-vs-PROD y `revoke from anon,authenticated` explícito).
</canonical_refs>

<gates_LOCKED>
## Gates inviolables (un agente jamás los cruza)
1. **NO flipear `crucesPublicEnabled`** (ni `.env`, ni código que lo defaultee ON). Encender = Phase 39 (humano).
2. **NO aplicar la migración de grant (0042)** a PROD. Se escribe y commitea; el apply es checkpoint humano post-sign-off.
3. **NO firmar el dossier** (`signoff: pending`).
4. **CRUCEN-01 (0041) SÍ es aplicable a PROD pero como checkpoint OPERADOR** (DDL: `psql --db-url --single-transaction` + `schema_migrations`). El agente la ESCRIBE y verifica con pgTAP-vs-PROD si el operador la aplica; no la aplica solo salvo autorización explícita del operador en la corrida.
5. **El RPC sigue deny-by-default tras 0041** (re-emitir `revoke execute from anon, authenticated` tras el drop+recreate — Supabase re-concede por DEFAULT PRIVILEGES; el pgTAP que asserta el grant de anon es lo único que lo caza).
6. Señales factuales, anti-insinuación §9.1 intacta; PII-safe (sin rut/partido/donante_id).
</gates_LOCKED>

<deferred>
## Deferred (lo que ESTA fase deja listo pero NO hace)
- Firmar el dossier de cruces → Phase 39 (humano).
- Aplicar el grant 0042 + flip `crucesPublicEnabled` → operador, post-firma.
- Superficie de cruces en ficha de PROYECTO → Phase 38.
</deferred>

---

*Phase: 41-crucen-habilitacion-de-cruces-grant-gated-dossier-fecha-captura*
*Context gathered: 2026-06-24 — deuda de Phase 37 (WR-02) + gate de Phase 39*
