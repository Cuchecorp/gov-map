# Requirements — Milestone v6.1 "Entendible y completo"

**Defined:** 2026-07-09
**Milestone goal:** Dos quejas directas del operador: (1) `/red` "se ve muy confuso" — el grafo debe ser ENTENDIBLE; (2) la búsqueda de proyectos "no funciona con todos los históricos, muchas veces no tiene todas las ideas matrices o las leyes" — la búsqueda debe ser COMPLETA.

## v6.1 Requirements

### RED — Grafo de relaciones entendible

- [x] **RED-01**: `/red` con seed muestra SOLO el ego-network real (el seed + sus vecinos directos, aristas entre ellos), NUNCA los ~136 nodos apiñados. Sin seed: estado inicial que orienta (explicación + selector prominente), jamás el grafo completo.
- [x] **RED-02**: Layout legible y determinista que NO implique afinidad (decisión LOCKED de F18: nunca force-simulation): p.ej. radial ego-céntrico con vecinos en anillo en orden neutro (alfabético), etiquetas legibles sin zoom, tope de vecinos con "ver más" honesto, usable en móvil 390px. La leyenda "cómo leer este grafo" se actualiza al layout nuevo.
- [x] **RED-03**: Lectura fría BrowserOS (patrón F61: captura→corrección→re-captura, desktop+390px) da veredicto "comprensible" en `/red` con seed y sin seed; evidencia before/after archivada.

### BUSQ — Búsqueda de proyectos completa

- [x] **BUSQ-01**: Todo proyecto presente en la DB tiene ficha + embedding (hoy: 156 proyectos, 74 fichas, 74 embeddings, 60 ideas matrices): backfill LOCAL completa el gap, reintenta fallidos y registra causa por boletín; techo honesto documentado (PDF escaneado, fuente caída, etc. — nunca fabricar).
- [ ] **BUSQ-02**: Cobertura histórica ampliada más allá del set agenda∪votación∪tabla: enumerar e ingerir proyectos de un alcance definido y declarado (p.ej. legislatura actual completa y/o últimos N años vía la fuente que la investigación confirme), como backfill masivo LOCAL conforme a convención (R2 primero, rate-limit, idempotente, reanudable). El alcance elegido queda documentado con su porqué.
- [ ] **BUSQ-03**: Ideas matrices y cuerpos legales al máximo alcanzable del corpus: pipeline re-corre extracción para fichas sin idea; los casos imposibles quedan con estado honesto Y la cobertura real (N/M fichas, N/M ideas) es visible para el operador (freshness CLI o /metodologia) — el usuario nunca cree que buscó sobre todo si no fue así: si la búsqueda opera sobre un subconjunto, la UI de /buscar lo declara.

## Future Requirements (deferred)

- Ingesta on-demand de un boletín buscado y ausente (encolar y avisar "disponible pronto").
- Búsqueda por texto íntegro de la ley (no solo idea matriz/título).

## Out of Scope

- Gates humanos/legales (F13/F17/0042, RUT-01/Phase 40, DB password B26) — sin cambio.
- Re-diseño del resto de superficies (v6.0 las cerró); solo /red y /buscar+fichas.
- Backfill masivo en GitHub Actions — convención LOCKED: masivo = LOCAL.

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| RED-01 | Phase 62 | Complete |
| RED-02 | Phase 62 | Complete |
| RED-03 | Phase 62 | Complete |
| BUSQ-01 | Phase 63 | Complete |
| BUSQ-02 | Phase 63 | Pending |
| BUSQ-03 | Phase 63 | Pending |

---
*Modo de trabajo v6.1 (directiva del operador, igual que v6.0): Fable planifica/dirime/controla; ejecutores Sonnet o menores; autónomo y ordenado; BrowserOS como gate de comprensión; gates humanos jamás los flipea un agente.*
