// seed-fichas-cli — entry-point LOCAL del SEED de fichas (espeja el esqueleto de pipeline-cli.ts).
//
// Cierra la causa raíz de BUSQ-01: crea una fila proyecto_ficha estado='pendiente' para cada
// `proyecto` sin ficha (los invisibles al pipeline). NO corre el backfill — solo abre las filas;
// el operador luego corre `pipeline-cli` sobre esas pendientes. Idempotente (ON CONFLICT DO NOTHING).
//
// Flags (validados ANTES de tocar la DB):
//   --dry-run          NO instancia el writer ni toca la DB (solo avisa)
//   --service-key K    SERVICE/SECRET key (o SUPABASE_SECRET_KEY del entorno)
//
// Sin service key (y sin --dry-run) → degrada a dry-run con aviso (mismo gating que pipeline-cli).
// Env-driven, sin puertos hardcodeados: SUPABASE_URL (o SUPABASE_API_URL), SUPABASE_SECRET_KEY.
// El secreto viene de env; `--service-key` es solo override (nunca se loguea — T-63-01/T-63-03).
// MEMORY gotcha "dos entrypoints CLI": el guard isMain matchea SOLO el nombre de ESTE archivo.

import { SupabaseFichasWriter } from "./writer-supabase";

export interface SeedCliOptions {
  dryRun?: boolean;
  serviceKey?: string;
  /** Override de URL (default: SUPABASE_URL / SUPABASE_API_URL del entorno). */
  url?: string;
  log?: (msg: string) => void;
}

export interface SeedCliResult {
  dryRun: boolean;
  creados: number;
}

/** Error de validación de flags (se reporta ANTES de cualquier DB). */
export class SeedCliArgsError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "SeedCliArgsError";
  }
}

/** Parsea argv → SeedCliOptions, fail-fast por flag desconocido / valor vacío. */
export function parseArgs(argv: string[]): SeedCliOptions {
  const opts: SeedCliOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--service-key": {
        // Fail-fast: sin valor, `decidirDryRun` degradaría SILENCIOSAMENTE a dry-run
        // y el operador creería estar escribiendo sin persistir nada (WR-05). Error explícito.
        // WR-05: además rechazar un valor que EMPIEZA con "--" — `--service-key --dry-run`
        // (operador olvidó la key) tomaría "--dry-run" como key, dejaría `dryRun` sin setear,
        // e iría LIVE con una key basura (inversión de modo). Un flag NUNCA es una key válida.
        const raw = argv[++i];
        if (raw == null || raw.trim().length === 0 || raw.startsWith("--")) {
          throw new SeedCliArgsError(
            "--service-key vacío o consumió un flag (esperado una key, no un --flag)",
          );
        }
        opts.serviceKey = raw;
        break;
      }
      default:
        if (a != null && a.startsWith("--")) {
          throw new SeedCliArgsError(`flag desconocido: ${a}`);
        }
    }
  }
  return opts;
}

/**
 * Decide si la corrida es dry-run: lo es si el operador lo pidió O si no hay service key
 * (sin key NO se toca la DB). Pura (testeable sin red).
 */
export function decidirDryRun(opts: { serviceKey?: string; dryRun?: boolean }): boolean {
  return opts.dryRun === true || (opts.serviceKey ?? "").length === 0;
}

/**
 * Corre el seed. En dry-run NO instancia el writer ni toca la DB (creados=0, solo avisa).
 * En LIVE: instancia SupabaseFichasWriter y llama seedFichasPendientes().
 */
export async function main(opts: SeedCliOptions = {}): Promise<SeedCliResult> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const url = opts.url ?? process.env.SUPABASE_URL ?? process.env.SUPABASE_API_URL ?? "";
  const serviceKey = opts.serviceKey ?? process.env.SUPABASE_SECRET_KEY ?? "";

  const dryRun = decidirDryRun({ serviceKey, dryRun: opts.dryRun });
  if (opts.dryRun !== true && serviceKey.length === 0) {
    log("fichas-seed: sin SUPABASE_SECRET_KEY → DRY-RUN (no toca DB)");
  }

  if (dryRun) {
    log("fichas-seed: DRY-RUN — no se instancia writer ni se abre ninguna fila proyecto_ficha");
    return { dryRun: true, creados: 0 };
  }

  const writer = new SupabaseFichasWriter({ url, serviceKey });
  log(`fichas-seed: writer Supabase (${url}) — seed idempotente (ON CONFLICT DO NOTHING)`);
  const { creados } = await writer.seedFichasPendientes();
  log(`fichas-seed: OK → ${creados} filas 'pendiente' creadas`);
  return { dryRun: false, creados };
}

// Entry-point CLI: `tsx seed-fichas-cli.ts [--dry-run] [--service-key K]`.
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  /seed-fichas-cli\.(ts|js|mjs|cjs)$/.test(process.argv[1]);
if (isMain) {
  let parsed: SeedCliOptions;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error("fichas-seed FLAGS:", err instanceof Error ? err.message : err);
    process.exit(2);
  }
  main(parsed)
    .then((r) => {
      console.log(
        `\nfichas-seed ${r.dryRun ? "DRY-RUN" : "LIVE"}: creados=${r.creados}`,
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error("fichas-seed FALLÓ:", err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
