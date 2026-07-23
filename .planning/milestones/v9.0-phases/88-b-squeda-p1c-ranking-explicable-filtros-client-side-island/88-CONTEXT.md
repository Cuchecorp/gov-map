# Phase 88: BÚSQUEDA P1c — Ranking explicable + filtros client-side island - Context

**Gathered:** 2026-07-21
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous — recomendaciones auto-aceptadas por directiva del operador, PROMPT-v9.0)

<domain>
## Phase Boundary

Capa de presentación sobre lo que el retrieval híbrido (87) ya devuelve: normalizador estado→buckets (server, puro, testeable), island cliente `buscar-filtros.tsx` que filtra/reordena SIN re-buscar, chips con counts honestos, y ranking explicable por reglas declaradas. NO entrega: cambios al retrieval/RPC (87 cerrada), deep-links (89), filtro por partido activo (llega con BIO-03 en P2 — se DISEÑA el slot, no se puebla).

</domain>

<decisions>
## Implementation Decisions

### Normalizador de estado (server-side, puro)
- Lib pura `app/lib/estado-bucket.ts`: texto libre (`proyecto.estado`/`etapa`) → enum de buckets. Table-driven (mapa de patrones→bucket), exportado y reusable.
- Buckets base: `en_tramitacion`, `publicado_ley`, `archivado`, `rechazado`, `retirado`, `sin_dato`. El set FINAL se deriva de los valores DISTINTOS reales en PROD (lectura read-only durante desarrollo para construir el mapa + tests con ejemplos reales del corpus) — no inventar categorías sin evidencia.
- Texto no mapeado → `sin_dato` (bucket honesto explícito), JAMÁS silenciosamente a un bucket sustantivo. NULL → `sin_dato`.
- Corre SERVER-side al armar el slice (el island recibe el bucket ya calculado).

### Island de filtros (contrato FichaRail — LOCKED)
- `app/components/buscar-filtros.tsx` `"use client"`: recibe el slice serializado ya obtenido (boletin, título, año, iniciativa mensaje/moción, estado_bucket, cámara de origen, fecha) y filtra/reordena EN MEMORIA (React state). El island JAMÁS toca Supabase ni re-consulta — cero red.
- Filtros: año, mensaje/moción, estado (buckets), cámara de origen. Partido: el diseño contempla la faceta pero queda OCULTA/no-renderizada hasta que BIO-03 (P2) puebl e el dato — no un placeholder deshabilitado visible que confunda.
- Chips con counts "de estos N resultados" (leyenda explícita — nunca counts presentados como globales del corpus); facetas con count 0 deshabilitadas; NULL/sin_dato como bucket visible.
- El slice lo arma el server component de /buscar (page.tsx) — enriquecer la consulta existente de hidratación con los campos necesarios (paginar `.range()` si aplica; PostgREST cap 1k no debe morder: son ≤20-50 resultados).

### Ranking explicable (reglas declaradas, jamás ML)
- Orden primario = rank del retrieval (relevancia, ya viene de la RPC). El ranking explicable actúa como TIE-BREAK y como reordenamiento OPT-IN del usuario:
  - Empates de relevancia → mensaje (Ejecutivo) antes que moción, luego más reciente antes que más antiguo.
  - Toggle de orden visible: "Relevancia (default) · Recientes primero · Mensajes primero" — cada uno determinista y explicado.
- Leyenda visible y honesta de las reglas ("orden por relevancia de búsqueda; los empates priorizan mensajes y recencia") — anti-insinuación: sin score de parlamentarios, sin ranking por polémica, nada inferido.
- Etiquetas explicativas por resultado (chip "Mensaje"/"Moción", año) para que el porqué del orden sea legible.

### UI/plumbing
- Tokens y patrones v8: Tailwind 4 `[var(--t)]`, chips cívicos con `[--var]` (gotcha v8.1), tipografía guard, cero-hex.
- Anti-insinuación linter (201 términos) debe pasar sobre todo el copy nuevo.
- Accesibilidad: filtros operables por teclado, aria-pressed en chips (seguir el patrón de islands existentes).
- Deploy + evidencia visual BrowserOS quedan para la fase 89 (gate explícito ahí); 88 cierra code-complete con suite verde + tsc. Si el executor puede validar con jsdom estructura/estados, suficiente para 88.

### Claude's Discretion
- Estructura exacta del slice serializado y dónde vive el tipo compartido.
- Persistencia de filtros en URL (querystring) vs estado local — elegir lo que el patrón de islands existente ya haga; si ninguno persiste, estado local basta.
- Microcopy exacto de leyendas (pasando el linter).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Contrato island FichaRail (v5 F55) — island recibe slice serializado, jamás Supabase. Buscar el componente análogo real en app/components/.
- `app/buscar/page.tsx` — server component que hidrata resultados (boletines → filas proyecto); punto de enriquecimiento del slice.
- `app/lib/buscar.ts` — retrieval (87, flag ON): devuelve boletines rankeados.
- Patrón chips cívicos + tokens `[--var]` (v8.1, 8 componentes ya migrados).
- Linter anti-insinuación + guards CI (tipografía, cero-hex, PII).

### Established Patterns
- Server Components por defecto; islands "use client" mínimos.
- Tests jsdom para estructura/estados; getComputedStyle solo en deploy real (los gates visuales van en 89).
- `import.meta.dirname` (jsdom rompe `new URL(import.meta.url)`).

### Integration Points
- `proyecto` (estado/etapa texto libre, fecha_ingreso, iniciativa, camara_origen — verificar nombres reales de columnas en migraciones/types.ts).
- El filtro de partido llegará vía BIO-03 (P2, fase 90-91) — el island debe poder recibir el campo opcional sin refactor.

</code_context>

<specifics>
## Specific Ideas

- REQUIREMENTS: RANK-01 (mensaje>moción + recencia por reglas declaradas), FILT-01 (año/iniciativa/estado/cámara — partido diferido a BIO-03), FILT-02 (counts honestos "de estos N"), FILT-03 (facetas vacías deshabilitadas + sin_dato explícito).
- El normalizador de estado es reusable: la ficha de proyecto y /agenda podrán consumirlo después — diseñarlo sin acoplarlo al island.

</specifics>

<deferred>
## Deferred Ideas

- Faceta partido activa → P2 (fase 91, cuando BIO-03 esté poblado).
- Deep-links + fecha captura + gate BrowserOS → fase 89.
- Filtro por tema/materia normalizada → v9.x/v10 (FEATURES defer).

</deferred>
