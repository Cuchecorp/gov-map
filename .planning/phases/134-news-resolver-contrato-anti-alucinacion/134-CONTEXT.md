# Phase 134 — NEWS-RESOLVER · CONTEXT + PLAN CONSOLIDADO

**Fecha:** 2026-08-10 · **Planifica:** Fable (estratega, régimen autónomo de
`133-b-ENMIENDA-PROXY.md`: Sonnet ejecutor, Opus verificador, Fable estratega/validador).
**Goal (ROADMAP):** el LLM no puede inventar un vínculo — lista cerrada → resolver
determinista offline → dead-letter con causa. **Requirements:** NEWS-04. **SC1..SC4 LOCKED.**

## Decisiones de entrada (dirimidas por documentos vigentes, no nuevas)

1. **P-12 muerto por D-133-H:** SC1 del ROADMAP manda — el LLM emite boletín/nombre **de la
   lista cerrada inyectada** (3.675/186 son cifras de contrato, la lista real se carga de
   `proyecto`/`parlamentario` en runtime); jamás un id. La frase contraria de 133 fue borrada.
2. **`extraerBoletines` se MUEVE, no se reescribe** (D-133-H deuda declarada): es pura, cero
   imports, un solo importador (`app/components/lobby-de-parlamentario.tsx:6`). El archivo
   completo se mueve **verbatim** a `packages/news/src/resolver/boletin-en-materia.ts` y
   `app/lib/boletin-en-materia.ts` queda como re-export desde `@obs/news` (dirección
   app→packages, la correcta). Diff cero de comportamiento; el guard TS↔SQL de
   `0062_lobby_menciones_de_boletin.test.sql` sigue válido.
3. **Fail-closed heredado de 133:** T4/T9 no-medidos ⇒ el enrutamiento a fichas queda OFF en
   producción. 134 construye la INFRAESTRUCTURA del contrato igual (135/137 la necesitan);
   el gate de enrutamiento vive aguas abajo y se declara.
4. **Dead-letter:** tabla nueva `noticia_dead_letter` (término del ROADMAP), migración
   **0086**, patrón 0084 (RLS deny-all, cero grants, pgTAP espejo). Columna `rejection_stage`
   con check cerrado; `url_hash` + `payload` mínimos; NUNCA texto completo (mismo régimen de
   copyright/PII del golden).
5. **Contrato de emisión (para 135):** `CompletionRequest` con `temperature: 0`, schema zod
   con `confianza` y umbral; los outcomes de `validate.ts` mapean a `rejection_stage`.
   Allowlist vacía ⇒ **throw LOUD** antes de cualquier llamada (jamás procesar con lista
   vacía).

## Unidades (commits atómicos)

- **134-01** Mover `extraerBoletines` a `packages/news/src/resolver/` (verbatim) + shim
  re-export en `app/lib` + dep `@obs/news` en `app` + tests existentes verdes sin editar su
  lógica (el test de app puede seguir importando `@/lib/boletin-en-materia`).
- **134-02** Migración `0086_noticia_dead_letter.sql` + pgTAP `0086_*.test.sql` + apply a
  PROD por psql `--single-transaction` + corrida pgTAP contra el schema aplicado.
- **134-03** Resolver determinista en `packages/news/src/resolver/`: `allowlist.ts` (carga
  desde `proyecto`/`parlamentario(+alias)` con assert no-vacía LOUD), `resolver.ts`
  (`resolverBoletin`: emisión → normalización vía `extraerBoletines` → pertenencia exacta a
  la allowlist, si no ⇒ `null`; `resolverParlamentario`: match único por nombre foldeado
  contra lista cerrada; homónimo/apellido suelto/parcial ⇒ `null`), `dead-letter.ts` (writer
  Supabase con `rejection_stage`). Tests con controles positivos apareados por regla.
- **134-04** Contrato de emisión + gate: `emision.ts` (builder de request temperature=0 +
  schema zod con confianza + umbral), `gate.ts` (all-or-nothing por lote: valida TODO antes
  de escribir NADA; un lote fallido jamás toca el estado publicado). VERIFICATION de los 4 SC
  por Opus (verificador) + SUMMARY.

## Amenazas top

- T-134-01 reescritura accidental de `extraerBoletines` ⇒ test de igualdad byte a byte del
  cuerpo de la función contra el snapshot movido (y el pgTAP 0062 existente).
- T-134-02 resolver "best-guess" (fuzzy) ⇒ prohibido: solo igualdad exacta post-normalización
  determinista; test con homónimos y parciales exigiendo `null`.
- T-134-03 allowlist vacía procesa en silencio ⇒ throw LOUD con test.
- T-134-04 dead-letter con texto completo (copyright/PII) ⇒ schema de payload estricto sin
  campos de texto; pgTAP + test del writer.
- T-134-05 gate escribe parcial ⇒ test: lote con 1 inválido ⇒ 0 escrituras.
