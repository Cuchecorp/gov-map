# Phase 51: LEG2 — Legibilidad profunda (P2) - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Ejecutar las propuestas anti-sobrecarga del diagnóstico (`.planning/DIAGNOSTICO-govmap-2026-07-02.md §2`): que la ficha de parlamentario y la ficha de proyecto se lean en minutos sin perder un solo dato ni violar la doctrina anti-insinuación. El volumen repetitivo se agrega y colapsa; el detalle queda a un clic, **server-driven**. Cubre: votos agregados por proyecto (SC1), timeline dos niveles + bloque "¿dónde está hoy?" (SC2/B19), patrimonio tarjeta-resumen (SC3/B3), comparador cableado (SC4/B4), rebeldías honestas (SC5/B5), lobby agrupado por contraparte (SC6/B11), provenance por sección (SC7), footer global (SC8). Deploy = checkpoint operador (fuera de la fase).

</domain>

<decisions>
## Implementation Decisions

### Votos agregados + rebeldías (SC1, SC5)
- "Ver detalle" por arco de proyecto = server-driven vía searchParam `?votosVer=<boletin>` (patrón `?ver=` de patrimonio; la fase exige server-driven). Colapsado por defecto: UNA línea-resumen por arco.
- Línea-resumen (conteos por sentido + rango de fechas, ej. "Votó en 45 ocasiones: 28 a favor · 15 en contra · 2 ausencias, entre may 2026 y jun 2026") se computa en el Server Component desde las filas ya traídas — el RPC `votos_de_parlamentario` ya agrupa por arco ANTES de paginar (WR-02), todas las líneas del arco están presentes → **cero RPC nueva** para SC1.
- Dead code B24: eliminar los paths muertos de `voto-ficha-row.tsx` que renderizan "De qué trata: no disponible aún" por fila (el honest-state ya se dice 1× por sección en ProyectoGrupo `votos-por-parlamentario.tsx:442-447`); refactorizar el camino de menciones si aún consume `VotoFichaMencionRow`.
- Rebeldías B5: ajustar el RPC `rebeldias_de_parlamentario` (nueva migración, drop+recreate por cambio de returns table → 42P13): excluir ausencias del cálculo/salida (o separarlas explícitamente), join para hidratar título del proyecto, dedupe por votación. Ya está en `PUBLIC_RPC_ALLOWLIST` — sin cambio de allowlist. Re-emitir doble revoke + grant (gotcha DEFAULT PRIVILEGES re-concede a anon en función nueva). Sigue SECURITY DEFINER set search_path='' (lee `parlamentario.partido` interno, emite solo derivado público — LEGAL-03 intacto). Apply remoto por psql --db-url = checkpoint operador; pgTAP acompaña.

### Ficha de proyecto — estado actual + timeline (SC2, SC7)
- Bloque "¿dónde está hoy?" = Server Component, primer elemento tras el header: etapa/estado (dato existente) + último hito (fecha + descripción) + urgencia vigente derivada de los eventos de urgencia (último "hace presente" sin "retira" posterior) + "hace N días" acompañado de fecha absoluta. Si un dato no es derivable, la línea se omite — honesto, nunca fabrica.
- Colapso conservador (B19): SOLO pares de urgencia ("retira"/"hace presente") colapsados en una línea por período ("Urgencia Suma renovada N veces entre X e Y — ver todas", expandible server-driven). Todo lo demás = hito estructural siempre visible, sin paginación.
- Provenance por sección (SC7): UN `ProvenanceBadge` en el heading de la sección timeline; se conserva el link "Ver fuente oficial ↗" por evento (trazabilidad por dato queda por enlace, no por badge repetido).
- Fuera de alcance (deferred): votaciones agrupadas por jornada, roll-call jerarquizado, umbral de similares (B18).

### Patrimonio + comparador (SC3, SC4)
- Tarjeta-resumen por versión: fecha de presentación + tipo de declaración + conteos por categoría de bien, **reusando el transform `seriePatrimonio`** del chart F46 (misma fuente de verdad). "Ver detalle" mantiene `?ver=<versionId>`. Jamás el `<dl>` completo inline.
- Campos cuyo valor es URI de CPLT: excluidos de TODO render (tarjeta Y detalle). La trazabilidad queda por ProvenanceBadge/fuente.
- Comparador (B4): form GET nativo con dos `<select>` de fechas de versión + botón "Comparar" que construye `?comparar=A,B` — cero JS, SSR.
- Copy: "Elige dos fechas para comparar"; con <2 versiones disponibles el form se OMITE y queda el hecho neutro existente ("Se necesita más de una versión para comparar") — cero contradicción.

### Lobby + footer + resumen (SC6, SC8)
- Lobby: vista agrupada por contraparte = DEFAULT (orden por frecuencia DESC: "contraparte + conteo + rango de fechas"); toggle server-driven `?vista=cronologica` conserva la vista actual paginada. Agregación computada en server desde el RPC existente trayendo todas las filas del parlamentario (bounded: cientos) → cero RPC nueva.
- Caveat de identidad (B11): nota única al tope de la sección (contrapartes como texto de la fuente, sin identidad verificada) + quitar `IdentityMarker` por fila. Contraparte sigue texto crudo, NUNCA enlazada (el RPC no emite contraparte_id — sin cambio).
- Footer global en `app/layout.tsx`: atribución de datos + licencia CC BY 4.0 con scope cuidado (NO contradecir atribuciones por dataset no-CC-BY: ChileCompra "mención de la fuente", SERVEL "términos por verificar" — esas siguen por sección), links a `/metodologia` y `/sobre` (crear páginas mínimas honestas si no existen) + contacto.
- Cabecera/resumen parlamentario: región/distrito/circunscripción + período en el header (el RPC `parlamentario_publico` ya los emite) y asistencia ("Presente en N de M") como chip del resumen above-fold — ya computada por `contarCarriles`/datos de votos.

### Claude's Discretion
- Microcopy exacto de líneas-resumen, tarjetas y footer (respetando banned-vocab del DESIGN-SYSTEM y doctrina anti-insinuación).
- Detalles de layout/espaciado dentro del marco F45 (CarrilAccordion, mt-12 como frontera LOCKED).
- Estructura interna de helpers puros y ubicación de tests (seguir convención: vistas puras RTL + source-scan estructural).
- Si el fetch "todas las filas" de lobby requiere paginar el RPC en lotes, resolverlo server-side sin cambiar contrato público.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/components/votos-por-parlamentario.tsx` — `VotosView` (:285), `agruparPorProyecto` (:180), `ProyectoGrupo` (:206), `VotosSection` (:642); pagina por arcos completos (PAGE_SIZE=20, :609-619). Rebeldías se renderizan en `VotosView:496-537`.
- `app/components/voto-ficha-row.tsx:86-89` — dead code B24 ("De qué trata: no disponible aún" por fila).
- `app/components/timeline-view.tsx` (lista plana con rail CSS) + `app/components/timeline-event.tsx` (:54 badge por evento + :41-51 link fuente) + `app/app/proyecto/[boletin]/page.tsx:149-167` (`TimelineSection`, fecha ASC).
- `app/components/patrimonio-de-parlamentario.tsx` — `VersionRow` (:371, `<dl>` + `?ver=` vía `buildVerHref` :198), `BienesDeVersion` (:322), `seriePatrimonio` (:126), `PatrimonioChartShell` (:170), comparador consumido en `PatrimonioSection:786-789` → `DeclaracionComparacion` (:565), hecho neutro <2 columnas (:578-585), `AtribucionCcBy` (:206-222).
- `app/components/lobby-de-parlamentario.tsx` — `LobbyView` (:124), `LobbySection` (:319), `agruparAudiencias` (:278), paginación `?lobbyPage` (:368-373), `ContraparteCruda` (:99) con `IdentityMarker` por fila (:119).
- `supabase/migrations/0019_voto_asistencia_y_ficha.sql:73-78` — RPC `rebeldias_de_parlamentario` SECURITY DEFINER; grant anon :104.
- `app/components/carril-accordion.tsx` — island Radix, h2 en header, forceMount + data-closed:hidden (SSR intacto); nunca importa secciones de dominio.
- `app/lib/lockdown-guard.test.ts` — `PUBLIC_RPC_ALLOWLIST` (:157-173, incluye `rebeldias_de_parlamentario`), guard de migraciones >0044.
- `app/app/layout.tsx` — sin footer global (body = GlobalHeader + children, :36-43); gate noindex `PUBLIC_INDEXABLE` (:21-29).

### Established Patterns
- Detalle server-driven por searchParams (`?ver=`, `?votosPage`, `?lobbyPage`, `?materia`) — el patrón a extender (`?votosVer`, `?vista`, form GET comparador).
- Gates fail-closed server-only envolviendo la `<section>` entera (cruces/money) — no se tocan en esta fase.
- Tests: (a) RTL sobre vistas puras con fixtures + asserts de banned-vocab/atribución; (b) source-scan estructural (page-estructura, lockdown-guard).
- Migraciones: cambio de returns table = drop+recreate (42P13); DEFAULT PRIVILEGES re-concede a anon en cada función nueva → re-emitir revoke/grant explícito; apply remoto por psql --db-url (nunca db push); pgTAP por migración.
- Doctrina anti-insinuación: carriles hermanos mt-12, cero composición dinero/lobby+voto, conteos neutrales, honest-state 1× por sección.

### Integration Points
- `app/app/parlamentario/[id]/page.tsx` — secciones envueltas en CarrilAccordion (:201-318); ParlamentarioResumen above-fold; header a enriquecer.
- `app/app/proyecto/[boletin]/page.tsx` — insertar bloque estado-actual tras header, antes de #idea-matriz.
- `app/app/layout.tsx` — footer global; páginas nuevas `/metodologia` y `/sobre` si faltan.
- Suite app/ (406 verde), `tsc -b`, lockdown-guard 7/7 — deben seguir verdes (SC9).

</code_context>

<specifics>
## Specific Ideas

- Línea-resumen de votos modelo del diagnóstico: "Votó en 45 ocasiones sobre este proyecto: 28 a favor · 15 en contra · 2 ausente, entre may 2026 y jun 2026".
- Colapso de urgencias modelo: "Urgencia Suma renovada 12 veces entre jun 2021 y jun 2026 — ver todas".
- Lobby agrupado modelo: "Enel Chile — 4 reuniones: fechas…".
- Diseño de referencia LOCKED: `phases/44-legibilidad-auditoria-plan/UI-SPEC.md` + `DIAGNOSTICO-govmap-2026-07-02.md §2`.

</specifics>

<deferred>
## Deferred Ideas

- Votaciones de proyecto agrupadas por jornada/trámite con explicación general/particular (§2.2.4).
- Roll-call jerarquizado "¿Cómo votó cada diputado?" con mini-resumen por bancada (§2.2.5).
- Umbral honesto en similares kNN (B18, §2.2.6).
- Directorio con territorio + micro-conteos + orden por región (§2.3).
- Agenda: próximos eventos con semana rala + truncado de materia (§2.4) — el cruce inverso proyecto→agenda es Phase 52.
- Buscador global unificado y módulo de actualidad en home (§2.5) — actualidad es Phase 52.
- Sitemap/indexabilidad (`PUBLIC_INDEXABLE`) — pendiente de sign-off.

</deferred>
