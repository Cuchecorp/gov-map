# Phase 126 — Discussion Log

**Mode:** autónomo (Pasada 1, `.planning/PROMPT-v13.0-build-autonomo.md`) — discuss granular por-decisión con recomendación auto-seleccionada y logged; cero AskUserQuestion (los únicos checkpoints de operador de la pasada son 128 y 129).

## Áreas discutidas (todas — auto)

### 1. Guard B-03 (create view sin security_invoker)
- Q: ¿Archivo dedicado o extender lockdown-guard.test.ts? → **Dedicado `app/lib/create-view-guard.test.ts`** (recomendado: precedente *-antiflip-guard, nombre explícito, lockdown-guard ya cargado)
- Q: ¿Escaneo estático de migrations o query a DB viva? → **Estático sobre `supabase/migrations/*.sql`** (recomendado: guards estáticos sin secrets, patrón CI existente)
- Q: ¿Fixture como archivo .sql o string inline? → **String inline** (jamás contaminar migrations/)
- Q: ¿Matviews? → **Violación también** (no soportan security_invoker; allowlist vacía inicial obliga decisión explícita)

### 2. SUPERFICIES_PANEL
- Q: ¿Declarar nombres ahora o al crearlos en 128? → **Ahora, con prefijo congelado `panel-*` + lista de 7 archivos del editorial spike** (loader tolera faltantes — patrón Wave-0 Phase 100)
- Q: ¿Cómo cerrar el hueco de nombre imprevisto? → **Assert anti-drift: fs glob `components/panel-*.tsx` ⊆ SUPERFICIES_PANEL**

### 3. Idioms nuevos / NEGACIONES_LOCKED
- Q: ¿Entradas literales a NEGACIONES_LOCKED o constante hermana? → **Ambos** (stems fijos a NEGACIONES_LOCKED por mandato verbatim del criterio + export IDIOMS_APROBADOS single-source para 128)
- Q: ¿Cómo probar que la extensión no abre huecos? → **Self-check doble**: ningún stem contiene término prohibido + mutation con término inyectado adyacente al idiom sigue detectado

### 4. Mutation self-check carril PANEL
- Q: ¿Fixture nueva o extender Test 2? → **Extender Test 2** con trío explícito señal/exprés/los más sobre fixture de superficie panel

### 5. Runner por nombre explícito
- Q: ¿Cómo satisfacer "por nombre explícito, jamás glob"? → **Script `pnpm guards` con lista explícita** + conteo real de guards al planear (D-14)

## Deferred
- Guard B-03 contra DB viva (pg_views) — deuda de operador si ocurriera, no guard estático
- Alta de `lib/links-internos.ts` al scan — decisión para plan de 128

## Notas
- Scope intacto: nada de copy ni vistas en esta fase; solo guards.
