# Phase 100: PANEL P1c — Landing panel + benchmark + gate BrowserOS — Research

**Researched:** 2026-07-24
**Domain:** Next.js 16 Server Component (landing `/`) que lee señales precomputadas vía RPC bounded + candados de régimen (linter, cero-hex, tipografía) + gate BrowserOS
**Confidence:** HIGH (todo el material es codebase real inspeccionado + contratos LOCKED de 98/99; cero dependencia de training data)

## Summary

Phase 100 NO instala paquetes, NO crea migraciones y NO agrega agregación on-read. Es una fase **puramente frontend + guards**: modificar `app/app/page.tsx` para reemplazar el CUERPO producto-céntrico (los 3 entry-cards + los 3 tiles germen de `actualidad-module.tsx`) por un PANEL que lee la RPC bounded `actualidad_senales_panel` (Phase 99, ya aplicada a PROD y en `PUBLIC_RPC_ALLOWLIST`) y agrupa sus 9 columnas por `tipo_senal` en BentoTiles. Todo el andamiaje ya existe: `createServerSupabase()` (service_role, Camino A), `BentoGrid`/`BentoTile`, tokens hsl() horneados, `force-dynamic`, y tres guards-como-test que ya escanean `app/page.tsx`.

El hallazgo clave sobre el CONTEXT: el CONTEXT pide "extender el linter home a `SUPERFICIES_PANEL`". La realidad del código es que el array `SUPERFICIES_HOME` (en `app/lib/anti-insinuacion-guard.test.ts`) YA incluye `app/page.tsx` + `components/actualidad-module.tsx`. La extensión correcta es **añadir un nuevo array `SUPERFICIES_PANEL`** con los componentes NUEVOS del panel (p.ej. un `components/panel-actualidad.tsx` nuevo) y sumarlo al bucle de escaneo — como PRIMER commit, antes de escribir copy. El mismo patrón aplica a los guards cero-hex/tipografía en `bento-guards.test.ts`.

**Primary recommendation:** Wave 0/1 = extender los TRES guards (`anti-insinuacion-guard.test.ts` con `SUPERFICIES_PANEL` + nuevos términos denylist; `bento-guards.test.ts` con las mismas superficies nuevas en cero-hex/tipografía/bare-var) ANTES del copy. Wave siguiente = un Server Component nuevo `PanelActualidad` que llama `sb.rpc("actualidad_senales_panel", { p_tipo: null })`, agrupa por `tipo_senal`, y renderiza cada grupo como BentoTile reusando el idioma de `actualidad-module.tsx` (fuente+fecha, empty-state honesto, `supresion_causa` como fila de causa nunca vacía). Montar en `page.tsx` en lugar del cuerpo producto-céntrico, hero LOCKED intacto, URL/anchors intactos. Cierre = benchmark BrowserOS + gate de lectura fría sobre el deploy real (runbook operador espejo de 68-BROWSEROS-GATE.md).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Lectura de señales precomputadas | API/DB (RPC bounded `actualidad_senales_panel`) | — | Cero agregación on-read (SEN-02 LOCKED); el proc SQL + pg_cron ya materializaron todo (Phase 99) |
| Fetch server-side de la RPC | Frontend Server (RSC, `page.tsx` / `PanelActualidad`) | — | service_role NUNCA llega al browser (`import "server-only"`); resuelve CORS del WAF y protege la key |
| Render de tiles + empty/supresión | Frontend Server (RSC) | — | Todo SSR, cero JS cliente nuevo (espejo `actualidad-module.tsx` que es RSC puro) |
| Framing anti-insinuación / candados | Build/CI (guards-como-test en `pnpm test`) | — | El contrato de honestidad se hace cumplir estáticamente en CI, no en runtime |
| Gate de comprensión + benchmark | Operador/orquestador (BrowserOS sobre deploy) | — | Lectura humana sobre HTML real renderizado; no automatizable por grep |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Contenido del panel (del 99 materializado):**
- Señales SEN validadas y materializadas: velocity ("N trámites en 7 días", NUNCA "top/los más" — T-52-13), urgencias vivas (fechadas), agenda próxima (citaciones futuras), agenda_sala (suprimida cuando no hay), archivados/retirados, agrupación por materia. Cada tile lee de la RPC bounded.
- Cada señal ya trae `cobertura_camara`, `supresion_causa`, `fecha_max`, `ventana`, `conteo` — el panel las MUESTRA, no recomputa.
- `agrupacion_materia` puede venir con label `(sin materia)` (proyecto.materia NULL en PROD — degradación honesta documentada en 99); el panel DEBE tolerarlo sin romper ni fabricar.

**Honestidad en UI (riesgo existencial #1):**
- Cada tile/señal lleva fuente + fecha + estado vacío honesto: "en las fuentes consultadas al [fecha]". JAMÁS "sin movimiento" sin scrape.
- Señal con `supresion_causa` → renderiza la causa ("sin datos frescos de esta fuente" / "sin sesiones agendadas…"), NO una lista vacía ni un 0 mudo.
- Cobertura/sesgo por cámara declarado; PROHIBIDO ranking cross-cámara por conteo (T-52-13). Framing factual, cero insinuación de intención/causalidad.

**Candados de régimen (guards como contrato):**
- Extender el linter home a `SUPERFICIES_PANEL` como PRIMER commit, ANTES de cualquier copy nuevo (Pitfall #6 + #3).
- cero-hex (tokens hsl() horneados), whitelist tipográfica, Tailwind v4 `[var(--t)]` obligatorio (bare `-[--var]` inválido), `force-dynamic` en la home.
- Copy hero LOCKED byte-idéntico salvo autorización explícita del operador. El panel reemplaza el CUERPO producto-céntrico, no necesariamente el hero.
- anti-insinuación: linter verde con vocabulario nuevo del panel ("último momento", "revivido", "exprés", "madrugada" NUNCA); extensión del denylist ANTES del copy.
- CSP ENFORCED: si el panel necesita un origen nuevo en connect-src (no debería — lee de Supabase server-side), ajuste MÍNIMO documentado; jamás quitar frame-ancestors/object-src.

**Benchmark + gate BrowserOS (criterios de éxito, no opcionales):**
- Benchmark BrowserOS documentado de senado.cl y camara.cl (portada/actualidad/tablas ASP.NET densas): qué EVITAR y qué SUPERAR. Iteración diseño→crítica→loop.
- Gate BrowserOS de lectura fría sobre el DEPLOY real (no local): veredicto "comprensible". Si el MCP BrowserOS está caído, el orquestador cierra el gate.

**Arquitectura de datos:**
- La home lee `actualidad_senal` vía la RPC bounded server-side (service_role, Camino A) — cero agregación on-read. Reusar el patrón de `actualidad-module.tsx`.
- La URL de la home NO cambia; anchors/section[id] intactos (gotcha v8.0: scroll-margin en section[id]).

### Claude's Discretion
Layout fino del panel (nº de tiles, orden, responsive 390px), copy factual exacto (dentro del linter), cómo agrupar señales en el BentoGrid, estados de carga. Preferir reusar BentoGrid/BentoTile y tokens existentes; el diseño lo valida el loop BrowserOS contra el benchmark.

### Deferred Ideas (OUT OF SCOPE)
- Similitud de voto / relaciones → Phases 101/102 (pasada 2).
- Notificaciones/suscripciones → Phase 103 (pasada 3).
- Leyes publicadas → SEN-06 futuro.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PANEL-01 | La landing muestra señales SEN validadas (no el bento producto-céntrico), reusando BentoGrid/tokens y conservando candados; linter home extendido a `SUPERFICIES_PANEL` ANTES del copy | `page.tsx` estructura documentada abajo; RPC contract (0066) + agrupar por `tipo_senal`; guards a extender listados con línea exacta |
| PANEL-02 | Cada tile/señal lleva fuente+fecha + estado vacío honesto ("en las fuentes consultadas al [fecha]"); cero agregación on-read; URL intacta | RPC devuelve `fecha_max`/`supresion_causa`/`evidencia`; patrón empty-state de `actualidad-module.tsx`; `fechaCorta` helper |
| PANEL-03 | Benchmark BrowserOS de senado.cl/camara.cl documentado con crítica de diseño; iteración diseño→crítica→loop | Recipe BrowserOS (bros-cli.mjs) + rúbrica benchmark abajo |
| PANEL-04 | Gate BrowserOS de lectura fría sobre el deploy real ("comprensible") — criterio de éxito | Runbook operador espejo de 68-BROWSEROS-GATE.md; deploy Docker OpenNext |
</phase_requirements>

## Standard Stack

**Sin instalación nueva.** Phase 100 no añade paquetes. Todo lo que necesita ya está en el repo:

| Asset | Ruta exacta | Rol en Phase 100 |
|-------|-------------|------------------|
| Landing (home `/`) | `app/app/page.tsx` | SE MODIFICA — reemplaza el cuerpo producto-céntrico por el panel |
| Tiles germen (RSC) | `app/components/actualidad-module.tsx` | Patrón a reusar/reemplazar (idioma de fuente+fecha+empty-state) |
| Primitivas bento | `app/components/bento/bento-grid.tsx`, `app/components/bento/bento-tile.tsx` | Reuso directo (span 2/4/6, variants default/accent) |
| Cliente Supabase server | `app/lib/supabase.ts` (`createServerSupabase`) | El `.rpc()` corre por aquí (service_role, Camino A) |
| Formateadores | `app/lib/format.ts` (`fechaCorta`, `conteoVotacion`, `fechaCortaSegura`) | Fechas/tallies neutros |
| tz Chile date-only | `app/lib/dia-calendario.ts` (`diaCalendarioCitacion`, `dayLabelCitacion`, `badgeFechaCitacion`) | Para señales de agenda (fecha date-only-midnight-UTC = día chileno; NUNCA convertir tz) |
| Linter anti-insinuación | `app/lib/anti-insinuacion-guard.test.ts` | SE EXTIENDE con `SUPERFICIES_PANEL` + nuevos términos |
| Candados bento | `app/lib/bento-guards.test.ts` | SE EXTIENDE (cero-hex + tipografía + bare-var) con las superficies nuevas |
| Allowlist RPC | `app/lib/lockdown-guard.test.ts` (`PUBLIC_RPC_ALLOWLIST`, línea 166) | `actualidad_senales_panel` YA presente — NO tocar |
| RPC bounded | `supabase/migrations/0066_actualidad_rpc.sql` | Contrato de datos (9 columnas) — YA aplicada a PROD |
| Wrapper BrowserOS | `scripts/bros-cli.mjs` | Benchmark + gate lectura fría |

## Package Legitimacy Audit

**No aplica.** Phase 100 no instala paquetes externos (ni npm ni jsr). Es modificación de código existente + extensión de guards. Sección omitida por diseño.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────────┐
   pg_cron L-V ×4 → │ actualidad.materializar_senales()  (Phase99) │
   GH Actions L-V → │  + CLI k-means (agrupacion_materia)          │
                    └───────────────────┬─────────────────────────┘
                                        │ escribe (service_role, deny-by-default)
                                        ▼
                            ┌───────────────────────┐
                            │  actualidad_senal      │  (tabla precomputada, RLS on, cero policy)
                            │  9 cols + provenance    │
                            └───────────┬────────────┘
                                        │ SELECT … LIMIT 200, statement_timeout 5s
                                        ▼
                     ┌────────────────────────────────────────┐
                     │ RPC public.actualidad_senales_panel(     │  security definer, doble-revoke,
                     │   p_tipo text default null)              │  en PUBLIC_RPC_ALLOWLIST
                     └───────────────────┬──────────────────────┘
                                         │  sb.rpc("actualidad_senales_panel",{p_tipo:null})
                                         │  (service_role bypass ACL — Camino A)
                                         ▼
   REQUEST  →  app/app/page.tsx (RSC, force-dynamic)  →  <PanelActualidad/> (RSC, server-only)
                     │ hero LOCKED intacto                    │ agrupa filas por tipo_senal
                     │ SearchBox                              │ una BentoTile por señal
                     │                                        │ fuente+fecha | supresion_causa | conteo
                     ▼                                        ▼
              BentoGrid (6-col) ───────────────────────► HTML SSR (cero JS cliente nuevo)
                                                              │
                                          getComputedStyle (gate BrowserOS sobre deploy real)
```

### Recommended Project Structure

```
app/
├── app/page.tsx                       # MODIFICADO: monta <PanelActualidad/> en vez del cuerpo producto-céntrico
├── components/
│   ├── panel-actualidad.tsx           # NUEVO (sugerido): RSC que llama la RPC y agrupa por tipo_senal
│   │                                  #   (o extender actualidad-module.tsx — decisión de plan)
│   ├── actualidad-module.tsx          # germen; puede quedar como fallback o fundirse
│   └── bento/{bento-grid,bento-tile}.tsx   # reuso directo
├── lib/
│   ├── supabase.ts                    # createServerSupabase (sin cambio)
│   ├── format.ts / dia-calendario.ts  # helpers (sin cambio)
│   ├── anti-insinuacion-guard.test.ts # EXTENDER: SUPERFICIES_PANEL + términos
│   └── bento-guards.test.ts           # EXTENDER: superficies panel en 3 guards
```

### Pattern 1: Fetch de la RPC bounded desde un RSC (Camino A)

**Qué:** llamar `actualidad_senales_panel` con `.rpc()` desde el cliente service_role, `throw` en error real (nunca `?? []` que fabrique "sin datos").
**Cuándo:** en el componente async `PanelActualidad` (o funciones por-tile bajo `<Suspense>`).
**Ejemplo** (patrón verbatim de `app/app/contraparte/[id]/page.tsx:104-111` + `actualidad-module.tsx:233-247`):

```typescript
// Source: app/app/contraparte/[id]/page.tsx (agregado_por_contraparte) + 0066_actualidad_rpc.sql
import { createServerSupabase } from "@/lib/supabase";

interface SenalRow {
  tipo_senal: string;        // 'velocity'|'nuevos_ingresos'|'urgencias'|'agenda_citacion'|'agenda_sala'|'archivados'|'agrupacion_materia'
  ventana: string | null;    // '7d' | '30d' | 'futuras' | null
  conteo: number;
  cobertura_camara: string | null;  // 'C.Diputados' | 'Senado' | '(sin cámara)' | '2022-2026 (piso de corpus)' | null
  materia: string | null;    // label factual clusters/agenda; '(sin materia)' tolerado
  cluster_id: number | null; // solo agrupacion_materia
  fecha_max: string | null;  // timestamptz ISO
  supresion_causa: string | null;  // NULL = activa; texto = suprimida CON causa
  evidencia: Record<string, unknown>; // jsonb items crudos con enlace de fuente
}

export async function PanelActualidad() {
  const sb = createServerSupabase();
  const { data, error } = await sb.rpc("actualidad_senales_panel", { p_tipo: null });
  // #34: error real de lectura ≠ "sin señales". Se lanza (NUNCA `?? []`).
  if (error) {
    throw new Error(`PanelActualidad: no se pudo leer actualidad_senales_panel: ${error.message}`);
  }
  const filas = (data as SenalRow[] | null) ?? [];  // [] legítimo SOLO si la RPC devuelve 0 filas
  // Agrupar por tipo_senal → una BentoTile por señal.
  const porTipo = new Map<string, SenalRow[]>();
  for (const f of filas) {
    (porTipo.get(f.tipo_senal) ?? porTipo.set(f.tipo_senal, []).get(f.tipo_senal)!).push(f);
  }
  // …render (ver Pattern 2)
}
```

Nota: `p_tipo: null` trae TODAS las señales en una llamada (LIMIT 200; la tabla es ≪200 filas hoy). Alternativa: una llamada por tile con `p_tipo:'velocity'` etc. — más llamadas, mismo costo (todo bounded). Preferir **una sola llamada** y agrupar en memoria (menos round-trips server↔DB).

### Pattern 2: Render de un tile con supresión honesta

**Qué:** cada señal se renderiza SIEMPRE. Si `supresion_causa != null`, se muestra la causa como texto — NUNCA una lista vacía ni un "0" mudo.
**Ejemplo** (idioma de `actualidad-module.tsx` empty-state, adaptado):

```tsx
// Source: derivado de actualidad-module.tsx:153-156 + CONTEXT honestidad LOCKED
function TileSenal({ tipo, filas }: { tipo: string; filas: SenalRow[] }) {
  return (
    <BentoTile variant="default" span={2} asChild>
      <section className="p-6">
        <h2 className="text-lg font-semibold mb-4">{TITULO[tipo]}</h2>
        {filas.map((f, i) => f.supresion_causa ? (
          // SUPRESIÓN: la causa es el contenido, nunca vacío (SEN-03 LOCKED)
          <p key={i} className="text-sm text-muted-foreground">
            {f.supresion_causa}
            {f.fecha_max && <> — en las fuentes consultadas al {fechaCorta(new Date(f.fecha_max))}</>}
          </p>
        ) : (
          // ACTIVA: conteo factual + cobertura declarada + fecha, NUNCA "top/los más"
          <p key={i} className="text-sm">
            <span className="font-mono">{f.conteo}</span> {FRAMING[tipo]}
            {f.cobertura_camara && <> · {f.cobertura_camara}</>}
            {f.fecha_max && <span className="font-mono text-xs text-muted-foreground"> · al {fechaCorta(new Date(f.fecha_max))}</span>}
          </p>
        ))}
      </section>
    </BentoTile>
  );
}
```

Framing por tipo (LOCKED, anti-ranking T-52-13): velocity = "trámites en 7 días", urgencias = "urgencias fechadas (30 días)", agenda_citacion = "citaciones próximas", archivados = "movimientos de archivo/retiro (30 días)", agrupacion_materia = "proyectos en «{materia}»" con `'(sin materia)'` tolerado. **NUNCA** ordenar `cobertura_camara` por conteo cross-cámara.

### Anti-Patterns to Avoid
- **Recomputar cualquier agregación on-read.** La RPC ya devuelve `conteo`/`fecha_max`/`cobertura_camara`. El panel SOLO formatea. (SEN-02 LOCKED, riesgo de perf en la ruta más visitada.)
- **`?? []` que oculte un error de lectura.** Un error de la RPC es un `throw` (#34); `[]` es SOLO el path legítimo de 0 filas.
- **Ranking cross-cámara** ("la Cámara más activa", "top", "los más"). La asimetría Cámara 25.741 vs Senado 20.357 es de cobertura, no de actividad (98-SPIKE §3).
- **Convertir la fecha de agenda a tz Chile.** `citacion.fecha`/`sesion_sala.fecha` son date-only-midnight-UTC = día chileno; usar `dia-calendario.ts`, jamás `Intl` con `timeZone: America/Santiago` sobre esos campos.
- **Tocar el hero copy LOCKED** sin autorización del operador (v8.1 D1: el operador ANULÓ cambios de copy). El panel reemplaza el cuerpo, no el hero.
- **Cambiar la URL o los `section[id]`.** Gotcha v8.0: scroll-margin en `section[id]`.
- **Bare `-[--var]` en Tailwind v4** (compila a valor inválido → elemento sin color). Usar `-[var(--var)]`. El guard `bento-guards.test.ts` (III) escanea TODO `app/components/**`.
- **Hex hardcodeado.** Solo tokens hsl() horneados / `bg-[var(--token)]` / `text-accent-product`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agregar señales en la request | SQL/count on-read en el RSC | RPC `actualidad_senales_panel` (precomputada) | SEN-02 LOCKED; ruta más visitada, statement_timeout ya acotado a 5s en la RPC |
| Grid responsive 6-col | CSS grid ad-hoc | `BentoGrid` + `BentoTile span={2\|4\|6}` | primitivas v8.0 con guards; colapsan a 1-col con orden DOM |
| Formateo de fecha | `new Date().toLocaleString` ad-hoc | `fechaCorta` / `dia-calendario.ts` | tz Chile es un contrato LOCKED con trampas (date-only vs timestamp real) |
| Detección de vocabulario insinuante | revisión manual del copy | extender `TERMINOS_PROHIBIDOS` + `SUPERFICIES_PANEL` en el guard | el guard es el contrato de CI; el copy nuevo pasa por él ANTES de escribirse |
| Cliente Supabase | `createClient` nuevo | `createServerSupabase()` | server-only + service_role + guard PII lo escanea |

**Key insight:** casi todo el trabajo "duro" (agregación honesta, supresión, defectos de datos D1/D2/D3, anti-ranking) ya vive en el proc SQL de Phase 99. Phase 100 es formateo + candados + gate. El riesgo NO es técnico sino de honestidad de copy y comprensión — por eso los guards y el gate BrowserOS son el 80% del valor.

## Runtime State Inventory

> Phase 100 NO es rename/refactor/migración. Es net-new UI + extensión de guards sobre datos ya materializados. No hay estado runtime que migrar.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Ninguno — la tabla `actualidad_senal` ya existe y la pobla Phase 99 (pg_cron + GH Actions). Phase 100 solo LEE. | None — verificado: 0066 aplicada a PROD, RPC devuelve filas en vivo (99-VERIFICATION Behavioral Spot-Checks). |
| Live service config | Ninguno — no toca crons, workflows ni portales. | None. |
| OS-registered state | Ninguno. | None. |
| Secrets/env vars | Reusa `SUPABASE_URL` + `SUPABASE_SECRET_KEY` ya presentes en el Worker (mismos del sitio actual). | None — sin nuevos secrets. |
| Build artifacts | Ninguno nuevo; el deploy re-buildea el Worker OpenNext (Docker) como siempre. | Re-deploy estándar para el gate #4. |

## Common Pitfalls

### Pitfall 1: "Extender SUPERFICIES_PANEL" cuando el home ya está cubierto
**Qué va mal:** el CONTEXT dice "extender el linter home a `SUPERFICIES_PANEL`", pero `SUPERFICIES_HOME` (anti-insinuacion-guard.test.ts:145-148) YA incluye `app/page.tsx` + `actualidad-module.tsx`. Confundirse y no cubrir el componente NUEVO del panel deja copy nuevo sin lintear.
**Por qué pasa:** nombres parecidos (`SUPERFICIES_HOME` existe; `SUPERFICIES_PANEL` no).
**Cómo evitar:** crear un array NUEVO `SUPERFICIES_PANEL` con los archivos NUEVOS (p.ej. `components/panel-actualidad.tsx` + cualquier subcomponente), sumarlo al bucle de escaneo (línea 472: `[...SUPERFICIES_VOTO, ...]`), y AÑADIR las superficies nuevas a los 3 guards de `bento-guards.test.ts` (`SUPERFICIES_CERO_HEX`, `SUPERFICIES_TIPOGRAFIA`; el guard III bare-var ya escanea `components/**`). Como PRIMER commit (Wave 0), ANTES del copy.
**Señales de alarma:** un `git grep` del nombre del componente nuevo no aparece en ningún array de guard.

### Pitfall 2: Un término nuevo del panel dispara falso-positivo por leyenda que lo niega
**Qué va mal:** si el panel renderiza una leyenda honesta que CONTIENE un término prohibido para NEGARLO (p.ej. "esto no implica que sea urgente por presión"), el guard la caza como offender.
**Por qué pasa:** `detectarInsinuaciones` busca el término en el render; no distingue afirmación de negación.
**Cómo evitar:** exportar la leyenda como constante desde el componente y añadirla verbatim a `NEGACIONES_LOCKED` (anti-insinuacion-guard.test.ts:378-400) ANTES de escanear (patrón LOCKED de CROSS_LINK/MENCIONES_LOBBY). Registrar la negación ANTES de añadir la superficie (lección BLOCKER 91).
**Señales de alarma:** el guard falla sobre la propia superficie que enfuerza la regla.

### Pitfall 3: Nuevo vocabulario temporal/editorial no está en la denylist
**Qué va mal:** el copy del panel usa "último momento", "revivido", "exprés", "madrugada", "reactivado" — insinuaciones de timing/intención (Out of Scope explícito en REQUIREMENTS.md).
**Por qué pasa:** la denylist actual cubre voto/dinero/bancada, no timing legislativo.
**Cómo evitar:** AÑADIR a `TERMINOS_PROHIBIDOS` los idioms de timing insinuante ANTES del copy: `"último momento"`, `"a última hora"`, `"de madrugada"`, `"exprés"`, `"revivido"`, `"reactivado a la mala"`, `"zombie"`, `"resucitó"`, `"colado"`. Tildes exactas (el regex NO es accent-insensitive). Añadir un mutation self-check que pruebe que el guard MUERDE sobre uno de ellos inyectado.
**Señales de alarma:** copy que sugiere que un timing es sospechoso en vez de reportar el hecho fechado neutro.

### Pitfall 4: `agrupacion_materia` con `materia='(sin materia)'` rompe el render
**Qué va mal:** `proyecto.materia` es NULL en PROD → el label cae a `'(sin materia)'` (degradación honesta, 99-VERIFICATION §Nota). Si el tile asume un label no vacío o lo esconde, o peor, fabrica uno, rompe el contrato.
**Por qué pasa:** el dato upstream nunca se pobló (fuera del alcance de 99/100).
**Cómo evitar:** renderizar `'(sin materia)'` tal cual como label factual, o suprimir el tile agrupacion_materia con una nota honesta ("agrupación por materia no disponible en las fuentes consultadas"). Nunca inventar un tema.
**Señales de alarma:** un cluster mostrado con un nombre de tema que no vino del dato.

### Pitfall 5: force-dynamic omitido → home horneada estática → 500
**Qué va mal:** sin `export const dynamic = "force-dynamic"`, Next hornea `/` estática en build y sirve datos congelados/500 en runtime (gotcha F50).
**Por qué pasa:** la home lee datos vivos por request.
**Cómo evitar:** `page.tsx` YA tiene `dynamic = "force-dynamic"` (línea 19). NO borrarlo al reescribir el cuerpo.
**Señales de alarma:** el build marca `/` como `○` (estática) en vez de `ƒ` (dinámica).

### Pitfall 6: El gate BrowserOS falso-positivo sobre HTML crudo
**Qué va mal:** verificar los candados (petróleo de enlaces, cero-hex efectivo) leyendo el HTML crudo en vez de `getComputedStyle` sobre el deploy real.
**Por qué pasa:** la cascada CSS real solo se resuelve en el browser sobre el deploy (project memory F55/v6.1).
**Cómo evitar:** el gate corre `getComputedStyle` vía `evaluate_script` (arg `expression`) sobre workers.dev, con `sleep 8-10s` tras abrir (SSR+hidratación), viewport 390px. Si el MCP está caído, PAUSAR — el orquestador cierra el gate (CONTEXT LOCKED).

## Code Examples

### Cómo se monta hoy el cuerpo a reemplazar (page.tsx)

```tsx
// Source: app/app/page.tsx:172-183 — los 3 tiles germen bajo <Suspense>
<Suspense fallback={<BloqueSkeleton span={4} />}>
  <VotadoEstaSemana />
</Suspense>
<Suspense fallback={<BloqueSkeleton span={2} />}>
  <UrgenciasVigentes />
</Suspense>
<Suspense fallback={<BloqueSkeleton span={6} />}>
  <UltimaActualizacion />
</Suspense>
// → Estos 3 (que leen tablas crudas con .from()) se REEMPLAZAN por tiles del panel
//   que leen la RPC precomputada. El hero (span-4) + SearchBox + accent tile se
//   CONSERVAN (o el hero LOCKED intacto; decisión de plan sobre entry-cards).
```

### Cómo extender el linter (Wave 0, ANTES del copy)

```typescript
// Source: app/lib/anti-insinuacion-guard.test.ts — patrón de los arrays existentes
const SUPERFICIES_PANEL: string[] = [
  "components/panel-actualidad.tsx",   // el/los componente(s) NUEVO(s) del panel
  // …sub-tiles si se separan
];
// …añadir al bucle (línea ~472):
for (const rel of [...SUPERFICIES_VOTO, ...SUPERFICIES_MONEY, ...SUPERFICIES_HOME,
                   ...SUPERFICIES_BUSQUEDA, ...SUPERFICIES_PERSONAS, ...SUPERFICIES_LOBBY,
                   ...SUPERFICIES_AGENDA, ...SUPERFICIES_DEEPLINK, ...SUPERFICIES_PANEL]) { … }

// Nuevos términos de timing insinuante (tildes exactas):
// "último momento", "a última hora", "de madrugada", "exprés", "revivido",
// "reactivado", "zombie", "resucitó", "colado"
```

### Recipe BrowserOS (benchmark + gate)

```bash
# Source: scripts/bros-cli.mjs header + 68-BROWSEROS-GATE.md §2
# 1. Benchmark: abrir portales oficiales, capturar, criticar diseño
PID=$(node scripts/bros-cli.mjs open "https://www.senado.cl/" | grep -oE "Page ID: [0-9]+" | grep -oE "[0-9]+")
# sleep 8-10s (SSR + hidratación) ANTES del screenshot
node scripts/bros-cli.mjs shot "$PID" "C:/Temp/bench-senado.png" || (sleep 3; node scripts/bros-cli.mjs shot "$PID" "C:/Temp/bench-senado.png")
node scripts/bros-cli.mjs content "$PID"   # markdown para la crítica
node scripts/bros-cli.mjs close "$PID"
# repetir con https://www.camara.cl/  (portada + tablas ASP.NET densas)

# 2. Gate lectura fría sobre el DEPLOY real (workers.dev), viewport 390px,
#    getComputedStyle vía evaluate_script (arg `expression`), NO sobre localhost.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Home lee tablas crudas con `.from()` (actualidad-module) | Home lee RPC precomputada bounded | Phase 99/100 (v10.0) | Cero agregación on-read en la ruta más visitada; supresión honesta como filas |
| `SUPERFICIES_HOME` cubre el home viejo | `SUPERFICIES_PANEL` cubre el panel nuevo | Phase 100 | Copy nuevo lintado ANTES de escribirse |
| Bento producto-céntrico (entry-cards) | Panel "qué está pasando HOY" | Phase 100 | Cambia el propósito de la landing; hero LOCKED intacto |

**Deprecado/a fundir:** `actualidad-module.tsx` (los 3 tiles germen votado/urgencias/frescura) — leen tablas crudas y `fecha_captura`. El panel nuevo los reemplaza por señales precomputadas. Decidir en el plan si se borran o quedan como fallback (mantener el linter cubriendo lo que quede montado).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | El componente nuevo del panel se llamará `panel-actualidad.tsx` (nombre sugerido) | Structure / linter | Ninguno material — el plan elige el nombre; lo load-bearing es sumarlo a los arrays de guard |
| A2 | Una sola llamada `p_tipo:null` es preferible a una por tile | Pattern 1 | Bajo — ambas son bounded; una llamada = menos round-trips. El plan puede elegir por-tile |
| A3 | Los términos de timing sugeridos ("exprés", "revivido", etc.) son el set correcto a denylistar | Pitfall 3 | Medio — el set exacto lo afina el copy real; el operador/discuss puede ampliarlo. Out-of-Scope de REQUIREMENTS respalda el criterio |
| A4 | La RPC devuelve `evidencia` como objeto jsonb (no string) vía supabase-js | Pattern 1 typing | Bajo — supabase-js deserializa jsonb a objeto JS; verificar al implementar |

## Open Questions

1. **¿Se borra `actualidad-module.tsx` o se conserva?**
   - Lo que sabemos: sus 3 tiles leen tablas crudas (`.from()` + `fecha_captura`); el panel nuevo lee la RPC precomputada.
   - Lo que no está claro: si el operador quiere mantener "Votado esta semana"/"Última actualización de datos" como tiles adicionales.
   - Recomendación: el plan decide; si se conserva algo, mantenerlo dentro del linter (ya está en `SUPERFICIES_HOME`). Preferir fundir en el panel para una sola fuente de verdad.

2. **¿El panel conserva los 3 entry-cards (/buscar, /parlamentarios, /agenda)?**
   - Lo que sabemos: el CONTEXT dice "reemplaza el CUERPO producto-céntrico". Los entry-cards SON producto-céntricos.
   - Recomendación: el hero + SearchBox se conservan (LOCKED); los entry-cards pueden moverse abajo o a nav secundaria. Decisión de layout (discreción de Claude), validada por el loop BrowserOS.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| RPC `actualidad_senales_panel` en PROD | fetch del panel | ✓ | 0066 aplicada | — (verificado en vivo, 99-VERIFICATION) |
| `actualidad_senal` con filas vivas | tiles con dato real | ✓ | pobladas por pg_cron/GH Actions | supresión honesta si stale |
| MCP BrowserOS (127.0.0.1:9200) | benchmark + gate #3/#4 | ✓ (host operador) | — | orquestador (tiene MCP) cierra el gate si caído |
| Docker + wrangler (deploy OpenNext) | gate #4 (deploy real) | ✓ (operador) | node:22-slim | build Windows rompe worker 500ea — usar Docker Linux |
| Supabase env en Worker | fetch runtime | ✓ | `SUPABASE_URL`+`SUPABASE_SECRET_KEY` | — |

**Missing dependencies with no fallback:** ninguna.
**Missing dependencies with fallback:** BrowserOS MCP → si cae, el orquestador cierra el gate (CONTEXT LOCKED).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (workspace `app/`) |
| Config file | `app/vitest.config.ts` |
| Quick run command | `pnpm --filter ./app test -- --run <archivo>` |
| Full suite command | `pnpm --filter ./app test -- --run` (baseline 1252 app verde, v9.0) + `pnpm test` (monorepo) + `pnpm --filter ./app exec tsc --noEmit` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PANEL-01 | linter home extendido a SUPERFICIES_PANEL (guard + mutation self-check MUERDE) | unit/guard | `pnpm --filter ./app test -- --run anti-insinuacion-guard` | ✅ existe — EXTENDER |
| PANEL-01 | cero-hex + tipografía + bare-var sobre superficies panel | unit/guard | `pnpm --filter ./app test -- --run bento-guards` | ✅ existe — EXTENDER |
| PANEL-01 | RPC allowlisted (regresión) | unit/guard | `pnpm --filter ./app test -- --run lockdown-guard` | ✅ existe — YA verde (14/14) |
| PANEL-02 | render de tile: activa / supresión / empty honesto; agrupación por tipo_senal; '(sin materia)' tolerado | unit (RTL sobre `*View` con fixtures) | `pnpm --filter ./app test -- --run panel-actualidad` | ❌ Wave 0 (crear) |
| PANEL-02 | force-dynamic presente; URL/anchors intactos | unit (estructura) | grep/estructura sobre page.tsx | ❌ Wave 0 (opcional; espejo `page-estructura.test.ts`) |
| PANEL-03 | benchmark documentado | manual/BrowserOS | N/A — doc + capturas | manual (operador/orquestador) |
| PANEL-04 | gate lectura fría "comprensible" sobre deploy | manual/BrowserOS | N/A — runbook operador | manual (operador/orquestador) |

### Sampling Rate
- **Per task commit:** `pnpm --filter ./app test -- --run anti-insinuacion-guard bento-guards lockdown-guard`
- **Per wave merge:** `pnpm --filter ./app test -- --run` + `tsc --noEmit`
- **Phase gate:** suite completa (app 1252+ verde, sin regresión) + `pnpm test` monorepo + `pnpm audit` 0 + guards verdes antes de `/gsd:verify-work`; luego benchmark (#3) + gate BrowserOS (#4) sobre deploy.

### Wave 0 Gaps
- [ ] `app/lib/anti-insinuacion-guard.test.ts` — añadir `SUPERFICIES_PANEL` + términos de timing + NEGACIONES_LOCKED si aplica + mutation self-check nuevo (cubre PANEL-01). **PRIMER commit, antes del copy.**
- [ ] `app/lib/bento-guards.test.ts` — añadir superficies panel a `SUPERFICIES_CERO_HEX` y `SUPERFICIES_TIPOGRAFIA` (+ whitelist de cualquier off-step nuevo del panel) (cubre PANEL-01 candados).
- [ ] `app/components/panel-actualidad.test.tsx` — RTL sobre las vistas puras (`*View`) con fixtures de las 7 señales incluyendo filas de supresión y `'(sin materia)'` (cubre PANEL-02). Espejo de `actualidad-module` (vistas testeables con fixtures).
- [ ] Fixtures de `SenalRow[]` (activa, suprimida, agrupacion_materia sin materia) para los tests de vista.

*(El framework existe; los gaps son archivos de test nuevos + extensión de guards. Sin instalación.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | El panel es lectura pública anónima; sin auth (auth es Phase 103) |
| V3 Session Management | no | — |
| V4 Access Control | yes | RPC bounded en `PUBLIC_RPC_ALLOWLIST`; service_role bypass ACL controlado por el lockdown-guard (árbol público NUNCA `.from()` PII ni RPC fuera del allowlist) |
| V5 Input Validation | yes | La RPC no recibe input de usuario en el panel (`p_tipo` es constante server-side); cero superficie de inyección. `p_tipo` en la RPC ya es paramétrico |
| V6 Cryptography | no | — |

### Known Threat Patterns for {Next.js RSC + Supabase service_role (Camino A)}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Fuga de service_role al bundle cliente | Information Disclosure | `import "server-only"` en `supabase.ts`; el panel es RSC puro (sin "use client") |
| Lectura de tabla PII desde el árbol público | Information Disclosure | lockdown-guard Block B escanea `app/` por `.from('<pii>')`; el panel solo llama la RPC no-PII |
| RPC no-allowlisted invocada | Elevation of Privilege | lockdown-guard Direction-A: toda `.rpc("x")` debe estar en `PUBLIC_RPC_ALLOWLIST` (`actualidad_senales_panel` ya lo está) |
| Superficie que pasa tests pero se lee como insinuación | Repudiation/Reputación | gate BrowserOS de lectura fría (PANEL-04) — la garantía humana que el linter no puede dar |
| Copy que insinúa intención/causalidad temporal | Repudiation | linter anti-insinuación extendido con términos de timing ANTES del copy |
| CSP: nuevo origen en connect-src | Tampering | el panel lee de Supabase server-side → NO necesita origen nuevo; jamás quitar frame-ancestors/object-src (CONTEXT LOCKED) |

## Sources

### Primary (HIGH confidence)
- `app/app/page.tsx` — estructura actual de la landing (hero LOCKED, force-dynamic:19, BentoGrid, 3 tiles germen bajo Suspense:172-183)
- `app/components/actualidad-module.tsx` — patrón RSC de fetch + empty-state honesto + `throw` en error (#34) + reglas duras A-E
- `app/components/bento/bento-grid.tsx` / `bento-tile.tsx` — primitivas (span, variants, tokens)
- `supabase/migrations/0066_actualidad_rpc.sql` — contrato de la RPC bounded (9 columnas, p_tipo paramétrico, LIMIT 200, statement_timeout 5s, doble-revoke)
- `supabase/migrations/0065_actualidad_senal.sql` — semántica de cada señal, supresión-como-fila, defectos D1/D2/D3, valores de `cobertura_camara`/`ventana`
- `app/lib/anti-insinuacion-guard.test.ts` — linter (SUPERFICIES_HOME:145 ya cubre page.tsx; TERMINOS_PROHIBIDOS:293; NEGACIONES_LOCKED:378; bucle:472)
- `app/lib/bento-guards.test.ts` — cero-hex (SUPERFICIES_CERO_HEX:69), tipografía (WHITELIST_ARBITRARIOS:249), bare-var III (escanea components/**)
- `app/lib/lockdown-guard.test.ts` — `actualidad_senales_panel` en PUBLIC_RPC_ALLOWLIST:166; patrón `.rpc()` allowlist Direction-A/B
- `app/lib/supabase.ts` — createServerSupabase (service_role, server-only, Camino A)
- `app/lib/dia-calendario.ts` / `app/lib/format.ts` — tz Chile date-only + fechaCorta/conteoVotacion
- `app/app/contraparte/[id]/page.tsx:104-111` — patrón `.rpc(name,{p_id})` + throw
- `.planning/phases/98-senales-p1a-spike-de-datos/98-SPIKE-FINDINGS.md` — veredicto por señal, anti-ranking §3, regla del reloj §4
- `.planning/phases/99-senales-p1b-materializador/99-VERIFICATION.md` — RPC live, señales vivas, degradación `'(sin materia)'` documentada
- `.planning/phases/68-.../68-BROWSEROS-GATE.md` — molde del gate operador (pre-flight, CDP, rúbrica, registro)
- `scripts/bros-cli.mjs` — wrapper MCP BrowserOS (open/shot/content/snapshot; gotchas CDP)
- `.github/workflows/ci.yml` — dónde corren los guards (pnpm --filter ./app test + tsc)
- `.planning/ROADMAP.md:162-177` — 4 success criteria de Phase 100

### Secondary (MEDIUM confidence)
- `docs/deploy-cloudflare.md` — runbook base (parcialmente stale: menciona anon key legacy; el runbook vigente es Docker OpenNext node:22-slim + wrangler global, project memory Camino A)

### Tertiary (LOW confidence)
- Ninguna — toda la investigación es sobre código/artefactos del repo.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todo inspeccionado en el repo, cero paquete nuevo
- Architecture: HIGH — RPC aplicada a PROD y verificada en vivo (99); patrón de fetch idéntico a superficies existentes
- Pitfalls: HIGH — derivados de contratos LOCKED (98/99) + memory de gotchas reales (F50 force-dynamic, tz Chile, bare-var v4, cascada CSS solo en deploy)

**Research date:** 2026-07-24
**Valid until:** 2026-08-23 (estable — código interno; el único riesgo de deriva es si Phase 99 re-materializa con columnas distintas, improbable)
