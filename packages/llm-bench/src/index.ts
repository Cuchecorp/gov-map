// OWNER: 106-01. Complete barrel. Wave-2 plans fill the referenced modules; they must NOT edit this file (WARNING 1 fix).
//
// This is the SINGLE, FINAL barrel of @obs/llm-bench. It names every export the
// package will expose via forward re-exports. Plan 106-01 authors the four core
// modules below; the parallel Wave-2 plans (106-02, 106-03) OVERWRITE only the
// placeholder guard/scorer module bodies — they never touch this file.

// --- Núcleo de medición (106-01) ---
export * from "./metrics";
export * from "./pricing";
export * from "./instrument";
export * from "./report";

// --- Driver del harness + mock (106-04, Wave 3) ---
export * from "./harness";
export * from "./mock-provider";

// --- Guards compartidos (106-02 llena los módulos) ---
export * from "./guards/freeze";
export * from "./guards/no-rut";

// --- Scorers por tarea (106-02 / 106-03 llenan los módulos) ---
export * from "./tasks/routing/scorer";
export * from "./tasks/clasificacion/scorer";
export * from "./tasks/juez/scorer";
export * from "./tasks/extraccion/scorer";

// --- Máquinas de decisión (107-02, NET-NEW: no del set placeholder 106) ---
export * from "./veredicto";
export * from "./tasks/juez/juez-vs-humano";
