# PROMPT — Corrida autónoma v8.0 "Rediseño Bento" (Phases 76–81)

> Pegar en una sesión LIMPIA de Claude Code (repo Observatorio), tras `/clear`. El scaffolding ya existe: ROADMAP.md (6 fases 76-81 con success criteria, 7/7 reqs), REQUIREMENTS.md §v8 (BENTO-01..07 + decisiones D1-D4 RESUELTAS), MILESTONE-v8-bento.md (documento rector: mapeo mockup↔tokens, invariantes, riesgos), y el mockup en `.planning/design/bento/home-bento.dc.html`. NO re-descubrir; ejecutar.

---

## Prompt para pegar

```
/gsd-autonomous --from 76 --to 81
```

Directivas de la corrida (mismas que v6.x/v7.0, que cerraron completas):

- **Fable es el jefe**: planifica, dirime y controla; delega ejecución a agentes Sonnet o menores. Smart-discuss auto-acepta recomendaciones — las decisiones de diseño D1-D4 YA ESTÁN RESUELTAS por delegación del operador (REQUIREMENTS.md §v8): D1 copy LOCKED intacto (+kicker mono), D2 marcador diamante, D3 propagación acotada, D4 token nuevo `--radius-tile` (el `--radius` shadcn NO se toca). No re-preguntar.
- **Autónomo y ordenado**: sin preguntas al operador. El ÚNICO gate humano del milestone es la lectura fría final (Phase 81) — si el operador no responde, se documenta como handoff con la evidencia lista y la corrida CIERRA igual (patrón v7).
- **BrowserOS obligatorio** en 79 (antes/después por ruta) y 81 (deploy real vs mockup; MCP `http://127.0.0.1:9200/mcp`, wrapper `scripts/bros-cli.mjs`, páginas ocultas, desktop + 390px vía CSS inyectado). Si el MCP está caído, pedir al operador levantarlo — no fingir capturas.
- **Gates que un agente JAMÁS cruza**: flags `*_PUBLIC_ENABLED` (ninguna fase v8 los toca), sign-offs legales, DDL (v8 tiene CERO DDL), imprimir secrets.

## HALLAZGO RECTOR (verificado por conversión HSL — LÉELO ANTES DE PLANIFICAR)

**El mockup está dibujado SOBRE la paleta y tipografía actuales del sitio**: `#2A5859` = petróleo `--accent-product`, crema `#F9F6F0` = `--background`, `#FDFBF7` = `--card`, `#E3DDD3` = `--border`, `#2D6299`/`#A0343E` = civic tokens `--camara`/`--senado`, `#5C6373` = `--muted-foreground`; Geist/Geist Mono ya cargadas vía `next/font` en `app/app/layout.tsx`.

**v8.0 NO es migración de colores/tipografías: es LAYOUT + PRIMITIVAS** — `BentoGrid` (6 col, gap 14px) + `BentoTile` (spans 2/4/6, variants default/accent), tokens `--radius-tile` 16px / `--radius-control` 11px, contenedor `max-w-[1120px]`, header sticky. Si un plan se redacta como "definir paleta nueva / cambiar fuentes / copiar hex del mockup" → está MAL: los colores se referencian por token existente, SIEMPRE. Tabla completa de equivalencias y deltas: `MILESTONE-v8-bento.md` §0.

## Invariantes (cada plan los verifica; detalle en MILESTONE-v8-bento.md §1)

1. **Copy LOCKED intacto** (D1): h1 "Qué pasó con cada proyecto de ley y cada parlamentario.", cursiva "Con la fuente a la vista.", trust line, 4 pills. El copy del mockup es placeholder de diseño — NO manda. Se añade solo el kicker mono "OBSERVATORIO DEL CONGRESO".
2. **Cero strings/datos del mockup en producción**: los ejemplos de votaciones del mockup (títulos reales + tallies inventados) son FABRICACIÓN si se copian. Los tiles usan las queries reales existentes; empty states honestos.
3. **Linter anti-insinuación verde** (`app/lib/anti-insinuacion-guard.test.ts`, 201 términos): el copy del tile "¿Cómo leer esto?" se alinea con la fórmula existente de /sobre — el texto del mockup ("correlaciones no indicativas de irregularidades…") NO se copia tal cual.
4. **Island `/red` pixel-intocable**: `.net-*` no se toca (incl. `.net-chip` 11px DEBT-05). Si el contenedor cambia el ancho de /red, es decisión CONSCIENTE con verificación getComputedStyle en deploy (o exclusión documentada).
5. **Gates fail-closed intactos**: NET/MONEY/CRUCES/PUBLIC_INDEXABLE — ninguna superficie nueva los elude; "Red" en nav sigue condicionada a `netPublicEnabled`.
6. **Server-only intacto**: datos vía RPCs server-side; `SearchBox` único island del hero; `force-dynamic` en home se conserva.
7. **A11y**: touch targets 44px (las pills del mockup a 38px se SUBEN), focus-visible, contraste AA en tile accent, `scroll-margin-top` para el sticky.
8. **Cero hex hardcodeado en componentes bento** (candado con mutation self-check en Phase 80).

## Qué se construye (6 fases, lineales, cada una deja el sitio deployable)

- **76 — BENTO-BASE**: tokens `--radius-tile`/`--radius-control` + `BentoGrid`/`BentoTile` (`components/bento/`, tests de estructura) + header sticky 1120px + footer border-top. NINGUNA página cambia de layout interno aún; si el contenedor amenaza /red, excluirlo y diferir a 79.
- **77 — BENTO-HOME-SUPERIOR**: hero span-4 (kicker + copy LOCKED + SearchBox reestilada 52px/`--radius-control` + pills 44px) + tile accent "¿Cómo leer esto?" span-2 (CTA "Ver metodología →") + 3 tarjetas de entrada span-2 (diamante + →, copy actual).
- **78 — BENTO-HOME-ACTUALIDAD**: "Votado esta semana" span-4 (barra 3px `--camara`/`--senado`, tally mono en-dash, "Fuente ↗" `safeExternalHref`) + "Urgencias vigentes" span-2 (chip pill suma/simple, `urgenciaVigente()` existente) + strip frescura span-6. MISMAS queries; `ActualidadModule` lineal RETIRADO con sus tests migrados.
- **79 — BENTO-COHERENCIA** (alcance D3): contenedor + `--radius-tile` primer nivel en /buscar, /parlamentarios, /agenda, /sobre, /metodologia y paneles exteriores de fichas; interiores byte-idénticos; /red con tratamiento explícito (invariante 4). Capturas BrowserOS antes/después.
- **80 — BENTO-GUARDS**: colapso ≤md a 1 col (orden definido), a11y, par dark de tiles, candado cero-hex + guard tipográfico extendido + linter sobre copy nuevo de home — los 3 con mutation self-check (patrón del linter existente).
- **81 — BENTO-SHIP**: deploy Docker+wrangler (runbook abajo) + verificación BrowserOS en deploy real (home 1200px lado-a-lado con `.planning/design/bento/home-bento.dc.html`, móvil 390px, ruta interior, /red getComputedStyle — CIERRA de paso el gate visual pendiente de fase 75) + checklist de lectura fría como handoff.

```
76 ─► 77 ─► 78 ─► 79 ─► 80 ─► 81
```

**Relación con v7.0:** ninguna dependencia dura. v7 quedó code-complete con gates de OPERADOR abiertos (`HANDOFF-v7.0-operator-gates.md`) — la corrida v8 NO los toca ni los espera. "Votado esta semana" se renderiza vacío-honesto si los backfills 66/67 no han corrido.

## Contexto operativo (gotchas ya pagados)

- **Deploy**: build OpenNext en Docker `node:22-slim` (NUNCA alpine ni build Windows); robocopy a `C:/Temp/obs-build` antes de montar (OneDrive lentísimo); `docker run -w /app` SOLO vía PowerShell; wrangler GLOBAL `& node.exe "...wrangler.js" deploy --config wrangler.jsonc` (OAuth local); **pnpm 11: `pnpm config set dangerouslyAllowAllBuilds true` ANTES del `pnpm install` en el contenedor**. Runbook: `milestones/v6.0-phases/61-*/61-02-SUMMARY.md`.
- **BrowserOS**: `save_screenshot` en ráfaga tumba el MCP ("CDP request timeout") → sleep 8-10s, reabrir página, re-aplicar estado. `evaluate_script` usa arg `expression`; `click` usa `element`. 390px se fuerza con CSS inyectado.
- **jsdom no ve layout**: los tests validan estructura/props/gates, NO píxeles — por eso 79/81 llevan evidencia visual real (lección v6.1: cascada CSS solo cazable con getComputedStyle en deploy). jsdom además rompe `new URL(import.meta.url)` → usar `import.meta.dirname`.
- **pnpm overrides viven en `pnpm-workspace.yaml`** (pnpm 11 ya no lee `pnpm.overrides` de package.json — quick 260715-bvd).
- **Suite al inicio**: app 820 + packages 1103, verde + `tsc --noEmit` limpio. Cada plan la deja verde.
- **Sitio PROD**: https://observatorio-congreso.thevalis.workers.dev (última versión con /red layout B aprobado).
- **Mapa del frontend** (rutas, componentes, tokens, guards): ya explorado y volcado en MILESTONE-v8-bento.md — confiar en él, verificar con grep puntual solo lo que el plan toque.

## Al cerrar

audit-milestone → complete-milestone v8.0 → cleanup → tag → push a Cuchecorp/gov-map. Deja como deuda de operador (no de la corrida): sign-off de lectura fría del bento (checklist de 81) si no respondió en vivo, y los gates v7.0 que sigan abiertos en `HANDOFF-v7.0-operator-gates.md` (son de v7, no de esta corrida).
