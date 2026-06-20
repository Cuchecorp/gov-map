# Phase 21: Producto en vivo — Diseño Phase 19 + directorio de parlamentarios + ideas matrices - Context

**Gathered:** 2026-06-20 (al cierre de Phase 20, estado vivo)
**Status:** Ready for planning
**Mode:** Runbook pre-armado por el orquestador con el estado operativo descubierto EN VIVO tras el deploy. El plan-phase autónomo debe LEER este archivo entero + `19-UI-SPEC.md` + `DESIGN-SYSTEM.md` antes de planificar.

<domain>
## Phase Boundary

Elevar el sitio YA DESPLEGADO (`https://observatorio-congreso.thevalis.workers.dev`) del **frontend v1.0 plano** al **producto de Phase 19** (diseño cerrado), y cerrar las dos brechas de contenido que el deploy expuso:

1. **Implementar el diseño Phase 19** (fondo crema + acento petróleo, header global, tipografía/espaciado) en las rutas existentes — el diseño está CERRADO y especificado, falta cablearlo.
2. **Directorio de parlamentarios** navegable (nueva ruta) — hoy NO se puede descubrir un parlamentario desde la UI.
3. **Ideas matrices visibles** — hoy salen vacías (0/74) porque no se ingirió el texto fuente de los proyectos.

**Fuera de alcance:** MONEY/SERVEL/NET (gated); lanzamiento público / indexar (gate legal Ley 21.719); re-ingestar la data ya cargada; features nuevas más allá del diseño cerrado y el directorio.
</domain>

<decisions>
## Implementation Decisions

### Diseño (autoritativo, NO re-abrir)
- Fuente de verdad del diseño: `.planning/phases/19-producto-dise-o-brief-y-cierre-de-dise-o-del-frontend/19-UI-SPEC.md` + `DESIGN-SYSTEM.md` (CLOSED) + `mockup/landing.html`. Implementar VERBATIM; ninguna decisión de diseño se re-abre.
- Tokens: 60/30/10 — fondo crema `hsl(40 33% 97%)`, card `hsl(40 30% 99%)`, muted `hsl(40 20% 93%)`, acento petróleo `hsl(183 38% 26%)` (light) / `hsl(183 34% 46%)` (dark). EXTENDER `app/app/globals.css`; NO tocar `app/app/styles/civic-tokens.css` (queda tal cual).
- Voz editorial ES + lista de vocabulario prohibido (anti-insinuación) en `DESIGN-SYSTEM.md §6`; honest-states en §7; invariantes anti-insinuación HARD en §8.

### Directorio de parlamentarios
- Nueva ruta (sugerido `/parlamentarios`) que liste los 186 con búsqueda/filtro por cámara/región/distrito. Cada item enlaza a `/parlamentario/<id>`. Ids reales: `D####`/`S####` (NO `P#####`). Header global debe dar acceso a este directorio y a /buscar.
- El RPC `parlamentario_publico(p_id)` ya existe (cabecera de ficha). Para el listado puede hacer falta un RPC nuevo (público, RLS-safe, SIN partido/rut/email) que devuelva el set — diseñarlo respetando LEGAL-03 (NUNCA exponer partido/rut/email a anon). Ver `supabase/migrations/0020_parlamentario_publico.sql` como patrón.

### Ideas matrices (contenido)
- Causa raíz (diagnosticada con psql): `proyecto_ficha`: 74 filas, `idea_matriz` poblada = **0**, `texto_r2_path` = **0**. El pipeline degradó las 74 a "título+materia" porque NO había texto fuente. Para poblar idea_matriz/cuerpos_legales hay que **ingerir el texto del proyecto** y re-correr la extracción (DeepSeek) del pipeline de fichas.
- Investigar el camino de texto: BCN/LeyChile `obtxml?opt=7&idNorma=` (norma) y/o el documento del proyecto del Senado/Cámara. Confirmar si `@obs/fichas` / `@obs/tramitacion` ya tienen un fetch de texto que no se disparó, o si hay que cablearlo. Luego re-correr `@obs/fichas` (sin `--dry-run`; `--reembed` si cambia el contenido) y verificar `count(idea_matriz) > 0` con psql.
- Honestidad: si un proyecto no expone texto, la ficha muestra el honest-state, NO inventa idea matriz.

### Claude's Discretion
- Estructura exacta de componentes del header/directorio; el RPC del listado; el orden del re-embed.
</decisions>

<code_context>
## Estado vivo descubierto (2026-06-20, post-deploy)

### Sitio EN VIVO
- `https://observatorio-congreso.thevalis.workers.dev` (Worker `observatorio-congreso`, account CF `10fb709d866bb5b06dd2a5d13c8dd472`, OAuth `sanchez.rossi@gmail.com`). `noindex` activo (toggle `PUBLIC_INDEXABLE`). Secrets de runtime ya seteados: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GEMINI_API_KEY`.

### Data en la nube (YA cargada — NO re-ingestar): `bctyygbmqcvizyplktuw.supabase.co`
- parlamentario 186 (confirmado), proyecto 74, tramitacion_evento 316, votacion 10, voto 1389 (1154 `estado_vinculo='confirmado'`), proyecto_embedding 74, lobby_audiencia 7, declaracion 10. MONEY (contrato/aporte) = 0 (gated).
- **Brecha 1 — ideas matrices:** `proyecto_ficha` idea_matriz = 0/74, texto_r2_path = 0/74. cuerpos_legales tiene placeholder, no contenido real.
- **Brecha 2 — descubrimiento:** rutas actuales = `/`, `/buscar`, `/proyecto/[boletin]`, `/parlamentario/[id]`, `/agenda`, `/contraparte/[id]`. NO hay `/parlamentarios` (directorio). La landing es solo búsqueda de proyectos.
- lobby/patrimonio: 0 enlazados a un parlamentario (fuente AA001/bianchi no es del Congreso) → la sección sale honest-empty en las fichas. Mejora opcional: buscar fuente de lobby/patrimonio realmente ligada a parlamentarios (deuda conocida, ver [[v2-progress-and-operator-debt]]).

### Frontend (`app/`, Next 16 App Router)
- AGENTS.md: "esta NO es la Next.js que conoces" → leer `node_modules/next/dist/docs/` antes de tocar APIs.
- `app/app/layout.tsx`: `generateMetadata` con robots noindex (toggle PUBLIC_INDEXABLE). Aquí va el header global.
- `app/lib/buscar.ts`: `PARLAMENTARIO_ID_RE = /^[DSP]\d{3,5}$/` (ya corregido en Phase 20). `BOLETIN_RE` para proyectos.
- `app/lib/supabase.ts`: cliente anon server-only (SUPABASE_URL + SUPABASE_ANON_KEY).

### Build/Deploy — GOTCHA CRÍTICO (LOCKED)
- **El build de OpenNext en Windows produce un bundle que 500ea en runtime** (`Dynamic require of "/.next/server/middleware-manifest.json" is not supported`). NO desplegar el build de Windows.
- **Build SIEMPRE en Linux vía Docker:** `docker-cf-build.sh` en la raíz (node:22; copia source sin node_modules vía tar; `pnpm install` non-fatal — pnpm 11 bloquea build-scripts, los nativos esbuild/workerd traen binarios prebuilt; `opennext cf-build`). Contenedor named `obsbuild` (sin `--rm`); reiniciar con `docker start -a obsbuild` reusa node_modules (rápido). Luego: borrar `app/.open-next` del host (PowerShell), `MSYS_NO_PATHCONV=1 docker cp obsbuild:/build/app/.open-next "<host>\app\.open-next"`, y `cd app && npx wrangler deploy` (OAuth ya autenticado). `pnpm --filter app run deploy` colisiona con builtin si se omite `run`.
- `.env` en Windows tiene BOM/CRLF → cargar al shell vía `~/obs_env.sh` (exports single-quoted) regenerado con un parser python (ver Phase 20). psql en `/c/Users/Carlo/miniconda3/Library/bin/psql`; `SUPABASE_DB_URL` para psql directo (bypassa RLS).
</code_context>

<specifics>
## RUNBOOK sugerido (next session)

**Pre-flight:** regenerar `~/obs_env.sh` desde `.env` (BOM/CRLF-safe). Confirmar sitio en vivo responde 200.

**Bloque A — Diseño Phase 19:**
1. Leer `19-UI-SPEC.md` + `DESIGN-SYSTEM.md` + abrir `mockup/landing.html`. Estudio visual (browseros) de las 3 referencias del usuario para calibrar calidad.
2. Cablear tokens crema/petróleo en `globals.css` (EXTENDER, no romper civic-tokens). Header global en `layout.tsx`. Aplicar tipografía/espaciado a cada ruta. Benchmark visual vs mockup.

**Bloque B — Directorio de parlamentarios:**
3. RPC público de listado (RLS-safe, sin partido/rut/email) si hace falta. Ruta `/parlamentarios` con búsqueda/filtro. Enlace desde el header.

**Bloque C — Ideas matrices:**
4. Investigar/cablear el fetch de texto fuente del proyecto (BCN obtxml / doc del proyecto). Re-correr `@obs/fichas` para poblar idea_matriz. Verificar psql `count(idea_matriz) > 0`. Idempotente.

**Bloque D — Redeploy + verificación:**
5. Rebuild en Linux (`docker start -a obsbuild`) → docker cp → `wrangler deploy`. Verificar e2e con browseros: diseño nuevo, directorio navegable, ideas matrices visibles, noindex activo, MONEY/NET off, sin foto/partido.

## browseros
Server live en `127.0.0.1:9200`. Driver: `.planning/phases/19-.../refs/bros.py` (tabs/nav/read/shot — los tools nativos mcp__browseros__* del cliente están desfasados vs el server; usar bros.py). Screenshots de Phase 20 en `.planning/phases/20-.../shots/` como referencia de "antes".
</specifics>

<deferred>
## Deferred Ideas
- **Fuente de lobby/patrimonio ligada a parlamentarios** (hoy AA001/bianchi no son del Congreso) — deuda de fuente, ver [[v2-progress-and-operator-debt]].
- **gov-map.com custom domain** — operador (agregar a cuenta CF + DNS).
- **Flip a indexable** (`PUBLIC_INDEXABLE=true`) — SOLO tras pasada legal Ley 21.719.
- **MONEY/NET** — gated (Phases 14-18).
- **Corpus de proyectos más amplio** — hoy 74 (rango 18300s + validados); ampliar boletines si se quiere.
</deferred>
