// run-tramitacion-prod-cli — entry-point de OPERADOR / CRON de la ingesta de TRAMITACIÓN
// (proyectos + votaciones + votos + timeline) contra PROD.
//
// El `ingest-cli.ts` del paquete apunta a Supabase LOCAL. Este thin runner MIRRORea
// `run-agenda-prod-cli.ts` de @obs/agenda: carga `.env` (BOM-safe), apunta al Supabase REMOTO
// (SUPABASE_API_URL + SUPABASE_SECRET_KEY) y reusa el `main()` de @obs/tramitacion.
//
// COBERTURA SEMANAL INCREMENTAL (sweet spot): el descubrimiento del WS de Cámara por sesiones
// devuelve [] (el WS no enumera por año), así que en vez de "descubrir" se REFRESCAN los
// boletines que la plataforma YA referencia — la unión de:
//   * proyecto.boletin            (lo ya ingerido → mantener tramitación/votos al día)
//   * citacion_punto.boletin      (agenda de comisiones → proyectos en actividad reciente)
//   * sesion_tabla_item.boletin   (tabla de sala → proyectos en tabla esta semana)
// Re-ingerir es idempotente (upsert por clave natural): captura cambios de etapa + votos nuevos
// de la semana. Los boletines de agenda que aún no tienen ficha entran así por primera vez.
//
// Sin `--boletines` explícito → usa ese conjunto de la DB. Con `--boletines a,b` → lo overridea
// (bootstrap / corridas dirigidas). Credenciales SOLO de `.env`/secrets (NUNCA por argv).
//
// Uso:
//   tsx packages/tramitacion/src/run-tramitacion-prod-cli.ts [--dry-run] [--limite N]
//                                                            [--anno YYYY] [--boletines a,b,c]
//
// Provider LLM (MiniMax) OPCIONAL y NO inyectado aquí: las menciones ambiguas del Senado
// degradan fail-closed a `no_confirmado` (los votos deterministas vinculan igual). Minimalista
// y sin costo de tokens — alineado con la cadencia de cron.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { main as ingestMain, findWorkspaceRoot } from "./ingest-cli";

/** Recorte por defecto del conjunto de boletines a refrescar (acotado por WAF + tiempo). */
const DEFAULT_LIMITE = 80;

function flagValue(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1]! : null;
}

/**
 * Carga `.env` BOM-safe con PRECEDENCIA de `process.env` (CI inyecta secrets ahí, sin archivo).
 * Espeja `run-agenda-prod-cli.loadEnv`.
 */
function loadEnv(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(join(root, ".env"), "utf8").replace(/^﻿/, "");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) out[m[1]!] = m[2]!.trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // Sin `.env` (CI): los secrets vienen de process.env (abajo).
  }
  for (const k of ["SUPABASE_API_URL", "SUPABASE_SECRET_KEY", "SUPABASE_URL"]) {
    if (process.env[k]) out[k] = process.env[k]!;
  }
  return out;
}

/** Filtro de boletín bien formado `NNNNN-NN` (defensa: no mandamos basura al WS). */
const BOLETIN_RE = /^\d{3,6}-\d{1,3}$/;

/**
 * Junta los boletines a refrescar desde el Supabase remoto: unión de los referenciados por
 * proyecto + agenda (citaciones de comisión + tabla de sala). Prioriza los de AGENDA (actividad
 * reciente) sobre los ya ingeridos, dedup, y recorta a `limite`. Devuelve [] si la DB está vacía.
 */
async function boletinesARefrescar(
  url: string,
  serviceKey: string,
  limite: number,
  log: (m: string) => void,
): Promise<string[]> {
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

  const vistos = new Set<string>();
  const ordenados: string[] = [];
  const push = (b: unknown) => {
    if (typeof b === "string" && BOLETIN_RE.test(b) && !vistos.has(b)) {
      vistos.add(b);
      ordenados.push(b);
    }
  };

  // 1. Agenda PRIMERO (actividad reciente: comisiones + sala de esta/próximas semanas).
  const { data: puntos } = await sb
    .from("citacion_punto")
    .select("boletin")
    .not("boletin", "is", null);
  for (const r of (puntos as { boletin: string | null }[] | null) ?? []) push(r.boletin);

  const { data: items } = await sb
    .from("sesion_tabla_item")
    .select("boletin")
    .not("boletin", "is", null);
  for (const r of (items as { boletin: string | null }[] | null) ?? []) push(r.boletin);

  const agendaCount = ordenados.length;

  // 2. Proyectos ya ingeridos (mantenerlos al día). Se piden DESPUÉS → quedan tras los de agenda.
  const { data: proys } = await sb.from("proyecto").select("boletin");
  for (const r of (proys as { boletin: string | null }[] | null) ?? []) push(r.boletin);

  log(
    `tramitacion-prod: ${ordenados.length} boletines candidatos ` +
      `(${agendaCount} de agenda + ${ordenados.length - agendaCount} ya ingeridos)`,
  );
  return ordenados.slice(0, limite);
}

async function run(): Promise<void> {
  const root = findWorkspaceRoot(process.cwd());
  const env = loadEnv(root);
  const log = (m: string) => console.log(m);

  const dryRun = process.argv.includes("--dry-run");
  const limiteRaw = flagValue("--limite");
  const limite = limiteRaw != null ? Number(limiteRaw) : DEFAULT_LIMITE;
  if (!Number.isInteger(limite) || limite <= 0) {
    throw new Error(`--limite inválido: ${limiteRaw} (esperado entero > 0)`);
  }
  const annoRaw = flagValue("--anno");
  const anno = annoRaw != null ? Number(annoRaw) : new Date().getUTCFullYear();
  const boletinesRaw = flagValue("--boletines");

  const url = env.SUPABASE_API_URL || env.SUPABASE_URL || "";
  const serviceKey = env.SUPABASE_SECRET_KEY || "";

  // Sin credenciales remotas (y sin --dry-run) → degrada a dry-run (no toca DB), igual que main().
  const efectivoDryRun = dryRun || !url || !serviceKey;
  if (!dryRun && (!url || !serviceKey)) {
    log("tramitacion-prod: sin SUPABASE_API_URL/SECRET_KEY → DRY-RUN (no carga DB)");
  }

  // Conjunto de boletines: explícito (override) o derivado de la DB remota. Se deriva siempre
  // que HAYA credenciales (también en --dry-run: así el dry-run ejercita el gather + el fetch a
  // las fuentes, solo se salta la escritura).
  let boletines: string[] | undefined;
  if (boletinesRaw && boletinesRaw.trim().length > 0) {
    boletines = boletinesRaw.split(",").map((s) => s.trim()).filter(Boolean);
    log(`tramitacion-prod: ${boletines.length} boletines explícitos (override)`);
  } else if (url && serviceKey) {
    boletines = await boletinesARefrescar(url, serviceKey, limite, log);
    if (boletines.length === 0) {
      log(
        "tramitacion-prod: la DB no referencia ningún boletín todavía → nada que refrescar " +
          "(pasa --boletines a,b para bootstrap)",
      );
    }
  }

  const res = await ingestMain({
    ...(boletines !== undefined ? { boletines } : {}),
    anno,
    limite,
    dryRun: efectivoDryRun,
    // `localUrl` es solo el destino del writer; aquí apunta al REMOTO (idempotente).
    localUrl: url || undefined,
    serviceKey: serviceKey || undefined,
    cwd: root,
    log,
  });

  console.log(
    `\ntramitacion ${efectivoDryRun ? "DRY-RUN" : "LIVE"}: proyectos=${res.proyectos} ` +
      `votaciones=${res.votaciones} votos=${res.votos} eventos=${res.eventos} ` +
      `errores=${res.errores.length}`,
  );
  for (const e of res.errores) log(`tramitacion-prod: ERROR ${e.boletin} [${e.etapa}]: ${e.mensaje}`);
  process.exit(res.errores.length > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("tramitacion-prod FALLÓ:", err instanceof Error ? err.message : err);
  process.exit(1);
});
