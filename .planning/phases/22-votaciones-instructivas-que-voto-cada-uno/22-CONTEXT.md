# Phase 22: Votaciones instructivas — qué votó cada uno y para qué - Context

**Gathered:** 2026-06-20 (análisis EN VIVO con browseros tras cerrar Phase 21)
**Status:** Ready for planning
**Mode:** Runbook pre-armado por el orquestador con el estado real descubierto en producción. El plan-phase autónomo debe LEER este archivo entero + `19-UI-SPEC.md` (§3 ficha parlamentario, §9 copy de votos) + `DESIGN-SYSTEM.md` (§6 voz, §7 honest-states, §8 invariantes) antes de planificar.

<domain>
## Phase Boundary

Hacer **instructiva** la sección de votaciones del sitio EN VIVO (`https://observatorio-congreso.thevalis.workers.dev`). Hoy un voto se ve como `En contra · Boletín N°18296-05`: el ciudadano NO entiende de qué trataba, ni el desenlace, ni qué significó ese voto. Esta fase usa los datos YA cargados (votaciones + ideas matrices pobladas en Phase 21) para que se entienda **qué se votó, cómo votó cada uno, y qué pasó** — sin insinuar intención ni causalidad.

**Dentro de alcance:** presentación instructiva de las votaciones en (a) la ficha del parlamentario (`/parlamentario/[id]`, componente `votos-por-parlamentario.tsx`) y (b) su espejo en la ficha del proyecto (`/proyecto/[boletin]`, componentes `votacion-card.tsx`/`voto-row.tsx`). Honest-state explícito para "Financiamiento/contratos" (MONEY gated). Redeploy + verificación e2e.

**Fuera de alcance:** re-ingestar o ampliar la cobertura de votaciones (hoy solo 2 boletines / 10 votaciones — deuda de datos SEPARADA); MONEY/SERVEL/NET (gated); lanzamiento público / indexar (gate legal Ley 21.719); cambios al directorio o al diseño cerrado de Phase 19/21.
</domain>

<decisions>
## Implementation Decisions

### Qué mostrar para que sea instructivo (autoritativo)
1. **Sustancia por voto (SC1):** cada fila de voto debe mostrar el **título del proyecto** (`proyecto.titulo`) + un **extracto de la idea matriz** (`proyecto_ficha.idea_matriz`, ~1-2 líneas truncadas) — no solo `Boletín N°XXXX`. Si el proyecto no tiene idea matriz (17/74 hoy), honest-state ("De qué trata: no disponible aún") — NUNCA fabricar.
2. **Desenlace por votación (SC2):** mostrar `votacion.resultado` (Aprobado/Rechazado) + conteo `total_si`–`total_no` (y abstención/pareo si aplica) + `quorum` + `etapa`. Enmarcar el voto del parlamentario respecto al desenlace, p.ej.: **"Votó En contra · el proyecto fue Rechazado (58–81)"**. Frase factual, sin juicio.
3. **Corregir "Asistencia" (SC3):** HOY el `<h3>Asistencia</h3>` muestra el desglose `A favor 5 · En contra 4 · …` — eso NO es asistencia, es el **sentido del voto**. Separar: (a) **Asistencia real** = presente vs `ausente` (de `seleccion='ausente'`) como su propia métrica; (b) renombrar el desglose de sentido a un heading honesto, p.ej. **"Cómo votó"** o **"Sentido de sus votos"**. No inventar asistencia que no exista (si solo hay votos emitidos, decir "N votos emitidos" honesto).
4. **Agrupar por proyecto — el arco (SC4):** en vez de una lista plana cronológica, agrupar las votaciones **por boletín/proyecto**: bajo cada proyecto (título + idea matriz + desenlace del proyecto) listar las etapas en que votó (PRIMER TRÁMITE: En contra; TERCER TRÁMITE: En contra). Así se ve la trayectoria de cómo votó una misma ley a lo largo de su tramitación.
5. **Significado de "a favor/en contra" (SC5):** una línea explicativa neutra: "A favor / En contra se refiere a **aprobar o rechazar el proyecto en esa etapa** de su tramitación." Sin causalidad, sin valoración.
6. **Funds honest-state (SC5):** la ficha debe tener un bloque honesto para "Financiamiento y contratos del Estado": "**Pendiente de revisión legal (Ley 21.719) antes de publicarse.**" En vez de omitir en silencio — el ciudadano sabe que existe y por qué no se muestra.
7. **Espejo en la ficha del proyecto (SC6):** la sección de votaciones del proyecto muestra resultado+conteo de cada votación y conecta con la idea matriz del propio proyecto (que ya vive en esa página).

### Anti-insinuación (LOCKED, UI-SPEC §9.1 / DESIGN-SYSTEM §6,§8)
- PROHIBIDO: ranking / score / índice / puntaje; juicio o adjetivo sobre un voto ("bien", "polémico", "incoherente"); relación/cercanía política; lenguaje causal ("votó así por…", "a cambio de…"). El nombre interno "rebeldías" JAMÁS aparece en UI — heading neutro "Votó distinto a su bancada".
- Toda métrica es **observable y factual** (qué votó, resultado, conteo, fuente). El framing del desenlace ("el proyecto fue Rechazado") es un hecho de la votación, no una valoración del voto.

### Datos: SIN nueva ingesta, SIN RPC nueva obligatoria
- anon YA puede leer (RLS public-read verificado): `votacion` (10 filas: resultado/total_si/total_no/total_abstencion/total_pareo/quorum/etapa/fecha/enlace), `proyecto` (74: titulo/materia/iniciativa/autores), `proyecto_ficha` (74: idea_matriz/cuerpos_legales), `voto` (confirmados vía RPC).
- `app/components/votos-por-parlamentario.tsx` (`VotosSection`, server component) **ya joina `proyecto.materia` por boletín** con el cliente anon — extender ese mismo patrón para traer `titulo` + `idea_matriz` (de `proyecto`/`proyecto_ficha`) y las filas de `votacion` (por `votacion_id`) para resultado/conteo.
- Opcional (más limpio, decisión del planner): extender el RPC `votos_de_parlamentario` para devolver `resultado/total_si/total_no/titulo` y evitar N+1 joins. Si se hace, es migración additiva sin PII (mismo gate LEGAL-03 que 0020/0026) + checkpoint operador `supabase db push --db-url "$SUPABASE_DB_URL"` + pgTAP.

### Claude's Discretion
- Estructura visual exacta del agrupamiento por proyecto y del bloque de desenlace; si se extiende el RPC o se hace join en el server component; el copy fino (respetando §6/§9); el truncado de la idea matriz.
</decisions>

<code_context>
## Estado vivo descubierto (2026-06-20, producción)

### La ficha del parlamentario HOY (browseros, `/parlamentario/D1054`)
Sección "Votaciones" con sub-bloques (de `votos-por-parlamentario.tsx` → `VotosView`):
- **`<h3>Asistencia</h3>`** con una barra + `A favor 5 · En contra 4 · Abstención 0 · Pareo 0 · Ausente 0` + "Emitió 9 votos registrados." → **MAL ETIQUETADO** (es el sentido del voto, no asistencia).
- **`<h3>Por tema</h3>`** = faceta por `proyecto.materia` (chips), sin score. OK.
- **Lista de votaciones** (`VotoFichaRow`): cada fila = chip `A favor`/`En contra` + `Boletín N°XXXX` (enlace) + ProvenanceBadge. **NO muestra título ni idea ni resultado.** ← el corazón del problema.
- **`<h3>Votó distinto a su bancada</h3>`** (rebeldías): su voto vs mayoría de bancada, enlaza al boletín. Sin sustancia del proyecto.
- NO hay bloque de "Financiamiento/contratos" honesto (MONEY simplemente ausente).

### Componentes a tocar
- `app/components/votos-por-parlamentario.tsx` — `VotosSection` (server, hace los fetches/joins) + `VotosView` (presentación pura, testeada con fixtures RTL). **La vista es pura → testear con fixtures, sin runtime.**
- `app/components/voto-ficha-row.tsx` — `VotoFichaRow` (fila de voto en la ficha del parlamentario).
- `app/components/voto-row.tsx` / `votacion-card.tsx` — lado del PROYECTO (espejo, SC6).
- `app/lib/types.ts` — tipos `VotoFichaRow`, `Seleccion`, `RebeldiaRow`; añadir campos (titulo/idea/resultado/totales) a los tipos de fila.
- `app/lib/format.ts` — `fechaCorta` (ya existe); quizá un helper de conteo.

### Datos (psql, verificado)
- `seleccion` ∈ {`si`(799), `no`(410), `ausente`(95), `abstencion`(85)}. (pareo definido en el tipo pero 0 filas.)
- `votacion`: 10 filas, 2 boletines (`14309-04`, `18296-05`). Campos: `resultado` (Aprobado/Rechazado), `total_si`, `total_no`, `total_abstencion`, `total_pareo`, `quorum`, `etapa`, `tipo`, `enlace`.
- Join `voto → votacion → proyecto_ficha.idea_matriz` FUNCIONA (ambos boletines tienen idea matriz).
- **Cobertura fina:** solo 2 boletines tienen votaciones → la vista DEBE degradar honesto ("pocas votaciones registradas todavía") y NO aparentar exhaustividad.

### RPCs existentes
- `votos_de_parlamentario(p_id, p_limit, p_offset)` → filas confirmadas (votacion_id, boletin, fecha, seleccion, etapa, camara, origen, fecha_captura, enlace). **No trae resultado/totales/titulo.**
- `rebeldias_de_parlamentario(p_id)` → security definer (partido nunca llega a anon).
- Patrón de RPC público PII-safe: `supabase/migrations/0020_parlamentario_publico.sql` y `0026_parlamentarios_publico_listado.sql` (de Phase 21).

### Build/Deploy (LOCKED, de Phase 21)
- Build SOLO Linux: `docker start -a obsbuild` (container YA existe, reusa node_modules) → borrar host `app/.open-next` → `MSYS_NO_PATHCONV=1 docker cp obsbuild:/build/app/.open-next "<host>/app/"` → `cd app && npx wrangler deploy` (OAuth `sanchez.rossi@gmail.com` ya autenticado). NO `pnpm deploy` (colisiona con builtin; usar `wrangler deploy` directo sobre el bundle).
- Windows produce bundle roto (500ea por `middleware-manifest.json`) — NO desplegar build de Windows.
- `.env` con BOM/CRLF → cargar `~/obs_env.sh` (ya regenerado). psql en `/c/Users/Carlo/miniconda3/Library/bin/psql`; `$SUPABASE_DB_URL` para DDL/pgTAP (bypassa RLS).

### browseros (verificación e2e)
- Server live en `127.0.0.1:9200`. Driver: `.planning/phases/19-.../refs/bros.py` (`tabs` / `nav <page> <url>` / `shot <page> <out.jpg>` / `read <page>`). Los tools nativos `mcp__browseros__*` están desfasados — usar bros.py. La tab 28 suele estar en producción; la 29 tiene el mockup.
- Screenshots "antes" de esta fase: `.planning/phases/21-.../shots/parlamentario_D1054_top.jpg`.
</code_context>

<specifics>
## RUNBOOK sugerido (next session)

**Pre-flight:** `source ~/obs_env.sh`; confirmar `$SUPABASE_DB_URL` y sitio 200.

**Bloque A — datos/tipos:**
1. Decidir join-en-server-component vs extender RPC `votos_de_parlamentario`. Traer por boletín: `proyecto.titulo`, `proyecto_ficha.idea_matriz`; por `votacion_id`: `resultado`, `total_si`, `total_no`, `total_abstencion`, `quorum`, `etapa`. Extender los tipos en `app/lib/types.ts`.

**Bloque B — VotosView instructiva:**
2. Reescribir `VotosView` (`votos-por-parlamentario.tsx`) + `VotoFichaRow`: (a) corregir "Asistencia" → separar asistencia real del sentido del voto; (b) cada voto con título+idea+desenlace; (c) agrupar por proyecto (el arco); (d) línea explicativa neutra de "a favor/en contra"; (e) bloque honest-state de Financiamiento/contratos (MONEY pendiente legal). Mantener la vista PURA + tests RTL con fixtures. Respetar §9.1 (cero score/juicio/causal).

**Bloque C — espejo proyecto:**
3. En la ficha del proyecto, mostrar resultado+conteo por votación conectado a la idea matriz del proyecto.

**Bloque D — redeploy + e2e:**
4. `docker start -a obsbuild` → docker cp → `wrangler deploy`. Verificar e2e (browseros): el voto ahora dice qué se votó + desenlace; "Asistencia" corregida; honest-states; noindex/MONEY-NET intactos; sin foto/partido. Screenshots a `22-.../shots/`.

## Gate de verificación
- Un ciudadano que abre una ficha entiende, sin clic: de qué trataba el proyecto, cómo votó la persona, y qué pasó con el proyecto.
- Cero términos prohibidos (§9.1) en código/copy. `civic-tokens.css` intacto. Tests del paquete `app` verdes. Deploy verificado e2e en producción.
</specifics>

<deferred>
## Deferred Ideas
- **Ampliar cobertura de votaciones** (hoy 2 boletines/10 votaciones) — deuda de DATOS: ingerir más votaciones desde `opendata.camara.cl` (getVotaciones) y/o Senado. Fase aparte; esta fase es de presentación.
- **MONEY / financiamiento real** — gated (Phases 14-18 + legal F13/F17). Aquí solo el honest-state.
- **Voto × tema con sustancia** — enriquecer la faceta "Por tema" con las ideas matrices; opcional.
- **OCR de PDFs escaneados / redacción RUT pre-LLM** — para subir idea_matriz de 57 a más (deuda de Phase 21).
</deferred>
