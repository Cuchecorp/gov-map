// index.ts — barrel de packages/news/src/eval/. Propiedad EXCLUSIVA del plan 133-01 (D-133-A2
// interfaces): los planes 03 y 04 corren en la misma wave 2 con use_worktrees y NO lo tocan —
// importan por ruta relativa dentro de este directorio para evitar colisión de merge.
//
// En esta wave 1 re-exporta EXACTAMENTE los módulos que ya existen. NO puede re-exportar
// `thresholds.ts` / `caso-golden.ts` / `entrada-llm.ts` todavía: no existen y `tsc -b` fallaría
// (TS2307).
export * from "./taxonomia.js";
