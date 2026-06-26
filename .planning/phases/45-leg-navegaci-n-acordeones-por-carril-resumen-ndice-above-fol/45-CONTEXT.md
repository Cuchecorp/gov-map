# Phase 45: LEG — Navegación (acordeones por carril + resumen above-fold) - Context

**Gathered:** 2026-06-26
**Status:** Ready for planning
**Source:** Derivado del UI-SPEC LOCKED de Phase 44 (`.planning/phases/44-legibilidad-auditoria-plan/UI-SPEC.md`, decisión A+B)

<domain>
## Phase Boundary

**Entrega:** re-layout de la ficha de parlamentario `app/app/parlamentario/[id]/page.tsx` para hacerla **navegable**, sin tocar el contenido de las secciones ni los datos.

**EN SCOPE:**
- Convertir cada carril de dominio (`#votos`, `#lobby`, `#patrimonio`, `#cruces` gated, los MONEY gated y el honest-state de financiamiento) en un **acordeón independiente** (header siempre visible con su `<h2>`, cuerpo colapsable).
- Un **resumen + índice above-fold** (tras la cabecera, antes del primer carril): un chip por carril con conteo/estado honesto + ancla de salto.
- Default de apertura: colapsar carriles vacíos/ralos, abrir los sustantivos.

**FUERA DE SCOPE (explícito):**
- Gráficos/charts → Phase 46+ (esta fase NO instala Recharts ni dibuja nada).
- Cambios de datos, RPCs nuevas, ingesta → otras fases.
- Cambiar el contenido/markup interno de las secciones (VotosSection, LobbySection, PatrimonioSection, etc.) más allá de envolverlas en el acordeón.
- Tocar la lógica de los gates MONEY/CRUCES (se conservan tal cual: cuando OFF, el nodo entero sigue ausente del HTML).
</domain>

<decisions>
## Implementation Decisions (LOCKED — del UI-SPEC §1)

### Acordeón
- **Componente: `@radix-ui/react-accordion`** (coherente con el stack Radix ya instalado: separator/slot/tooltip). Accesible (teclado/ARIA), SSR-friendly. Es la **única dependencia nueva** de la fase.
- **Uno por carril de dominio.** PROHIBIDO un acordeón que agrupe dos dominios en una misma unidad (anti-insinuación §8.2).
- **Header siempre visible (no colapsable):** el `<h2>` del carril vive en el header del acordeón → conserva `h1→h2→h3` aunque el cuerpo esté cerrado.
- **Conteo/estado en el header** (`(9)`, `(6 años)`, `(—)`): respeta los 3 estados honestos (dato / vacío-honesto / no-ingerido); nunca aparenta densidad.
- **Patrón técnico:** la ficha sigue **server-rendered**; solo el toggle del acordeón es un **thin client wrapper** (`"use client"`), envolviendo los Server Components de sección como children. Los Suspense + skeletons existentes se conservan.

### Frontera de carril (DESIGN-SYSTEM §3/§8 — LOCKED, HARD)
- El gap **`mt-12` entre carriles hermanos NUNCA se colapsa**, ni con un carril vacío. Es la frontera anti-insinuación. Los acordeones son hermanos separados por `mt-12`, no una lista de items dentro de un solo acordeón.
- Una reunión de lobby / declaración / contrato / voto **JAMÁS** comparten `<article>/<Card>/<li>/<tr>`.

### Resumen + índice above-fold (§1.1)
- Se renderiza **después de la cabecera (`ParlamentarioHeader`), antes del primer carril**.
- **Un chip por carril** con: (a) etiqueta del carril, (b) conteo/estado honesto (3-estado), (c) ancla (`href="#votos"` etc.) que salta al carril.
- El conteo se deriva **server-side** (los Server Components de sección ya consultan los RPCs; el resumen reutiliza esos conteos sin queries nuevas, o hace los counts mínimos vía los RPCs ya allowlisted). NUNCA inventa un número.

### Comportamiento-preservante (seguridad + datos)
- Contenido de cada sección **intacto**: cada dato conserva fuente+fecha+enlace (ProvenanceBadge).
- **Sin `.from('parlamentario')`** ni cualquier tabla PII directa en el árbol público; **sin RPC fuera del `PUBLIC_RPC_ALLOWLIST`** (`app/lib/lockdown-guard.test.ts`). El guard CI debe seguir verde.
- **SSR intacto:** la ficha se sigue renderizando en el server; solo el toggle es cliente. No mover lectura de datos al cliente.
- **Default de apertura:** colapsar carriles vacíos/ralos; conservador = abrir el primero con datos sustantivos (heurística simple, discreción de Claude).

### Claude's Discretion
- Heurística exacta de qué carriles abren por default.
- Estilado/markup del chip de resumen y del header del acordeón (dentro del DESIGN-SYSTEM: crema/petróleo, escala 8-pt, sin foto/partido).
- Ubicación de los nuevos componentes (p.ej. `app/components/parlamentario-resumen.tsx`, `app/components/carril-accordion.tsx`).
- Animación del acordeón (respetar `prefers-reduced-motion`).
- Cómo obtener los conteos para el resumen sin duplicar queries (preferir reutilización; aceptable un RPC ya allowlisted).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Diseño y plan (fuente de verdad de esta fase)
- `.planning/phases/44-legibilidad-auditoria-plan/UI-SPEC.md` — rediseño completo (§1 anatomía + reglas del acordeón, §5 decisión A+B, §6 checklist de invariantes).
- `.planning/phases/44-legibilidad-auditoria-plan/44-AUDIT-UX.md` — hallazgos UX priorizados + invariante que no se puede romper.
- `.planning/phases/19-producto-dise-o-brief-y-cierre-de-dise-o-del-frontend/DESIGN-SYSTEM.md` — §3 (frontera de carril `mt-12` LOCKED), §7 (3 estados honestos), §8 (invariantes anti-insinuación HARD), voz editorial ES.

### Código a modificar / leer
- `app/app/parlamentario/[id]/page.tsx` — el shell de carriles a re-layoutear (orden LOCKED: votos → lobby → patrimonio → cruces gated → MONEY gated / honest-state).
- `app/components/{votos,lobby,patrimonio,contratos,financiamiento,cruces}-de-parlamentario.tsx` — secciones a envolver (NO modificar su contenido interno).
- `app/components/parlamentario-header.tsx` — cabecera (se conserva; el resumen va debajo).
- `app/lib/lockdown-guard.test.ts` — guard CI (PUBLIC_RPC_ALLOWLIST + lista de tablas PII prohibidas). Debe seguir verde.
- `app/components/ui/` — primitivas (Skeleton, etc.); seguir el patrón de envoltura existente.

### Seguridad / deploy
- Memoria/`STATE.md`: Camino A (árbol público corre con `service_role`, bypassa RLS → PII protegida por el guard CI). Build OpenNext en **Docker Linux** (Windows rompe el worker → 500); deploy `wrangler` local = **checkpoint operador**.
</canonical_refs>

<specifics>
## Specific Ideas

- Orden de carriles LOCKED (no reordenar): `#votos`, `#lobby`, `#patrimonio`, `#cruces` (gated, hoy ON), MONEY gated (`#dinero`/`#financiamiento`, hoy OFF) o `#financiamiento-pendiente` (honest-state cuando MONEY OFF).
- El gate de cada sección gated (`crucesPublicEnabled`/`moneyPublicEnabled`) sigue envolviendo la `<section>` ENTERA (heading incluido): con OFF, el acordeón de ese carril NO existe en el HTML. El resumen above-fold solo lista los carriles efectivamente presentes.
- Test: la suite `app/` (vitest + RTL) debe quedar verde; agregar tests de render del resumen (chips + anclas) y del acordeón (header visible, toggle, frontera mt-12 entre carriles). `tsc -b` limpio.
</specifics>

<deferred>
## Deferred Ideas

- Gráficos (patrimonio-conteo, votos, etc.) → Phase 46+.
- Cualquier RPC agregada nueva o cambio de datos → fases de la pista de ingesta (F47/F48/F49, gated).
- Encender flags `*_PUBLIC_ENABLED` → exclusivo humano, nunca en esta fase.
</deferred>

---

*Phase: 45-leg-navegacion-acordeones-por-carril-resumen-indice-above-fold*
*Context derivado del UI-SPEC LOCKED de Phase 44 — 2026-06-26*
