// clasificar-noticias-cli.ts — cableado real del pipeline de clasificación (135-04).
// CORRE LOCAL (operador) o en el cron de 136. Lee PROD con service key (server-only).
//
//   pnpm --filter @obs/news exec tsx src/clasificador/clasificar-noticias-cli.ts [--dry-run]
//
// Provider: el ELEGIDO por el veredicto computado de 135-03 (veredicto-135.json). Si el
// veredicto no existe o no eligió a nadie, el CLI PARA (LOUD) — un clasificador sin vara
// aprobada no corre contra producción.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { DeepSeekProvider, GraniteProvider, MiniMaxProvider, type LLMProvider } from "@obs/llm";
import { SupabaseDeadLetterWriter } from "../resolver/dead-letter.js";
import { clasificarRun, type ClasificarRunDeps, type NoticiaPendiente } from "./clasificar-run.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const VEREDICTO_PATH = join(AQUI, "..", "eval", "veredicto-135.json");

/** Credencial ausente ⇒ DEGRADACIÓN HONESTA (SC2 de 136): el cron sale exit 0 SIN datos
 * fabricados, con log LOUD. Distinto de veredicto ausente/sin elección, que sigue siendo
 * fallo duro: un pipeline sin vara aprobada JAMÁS corre. */
export class CredencialAusenteError extends Error {}

function providerElegido(env: NodeJS.ProcessEnv): LLMProvider {
  const veredicto = JSON.parse(readFileSync(VEREDICTO_PATH, "utf8")) as {
    eleccion: string | null;
    candidatos: Array<{ provider: string; veredicto: { aprueba: boolean } }>;
  };
  if (!veredicto.eleccion) {
    throw new Error("clasificar-cli: veredicto-135.json sin elección — NEWS-05 no corre sin vara aprobada (LOUD)");
  }
  // H4 de la verificación 135: la elección debe estar APROBADA en el propio artefacto — el
  // freeze de sha protege en CI, pero este CLI corre local/cron donde CI no interviene.
  const elegido = veredicto.candidatos.find((c) => c.provider === veredicto.eleccion);
  if (!elegido || elegido.veredicto.aprueba !== true) {
    throw new Error(
      `clasificar-cli: la elección "${veredicto.eleccion}" no está aprobada en veredicto-135.json — jamás correr sin vara (LOUD)`,
    );
  }
  switch (veredicto.eleccion) {
    case "deepseek": {
      if (!env.DEEPSEEK_API_KEY) throw new CredencialAusenteError("DEEPSEEK_API_KEY ausente");
      return new DeepSeekProvider({ apiKey: env.DEEPSEEK_API_KEY });
    }
    case "granite": {
      if (!env.WORKERS_AI_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) {
        throw new CredencialAusenteError("credenciales Workers AI ausentes");
      }
      return new GraniteProvider({
        apiKey: env.WORKERS_AI_API_TOKEN,
        baseURL: `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
      });
    }
    case "minimax": {
      if (!env.MINIMAX_API_KEY) throw new CredencialAusenteError("MINIMAX_API_KEY ausente");
      return new MiniMaxProvider({ apiKey: env.MINIMAX_API_KEY });
    }
    default:
      throw new Error(`clasificar-cli: elección desconocida "${veredicto.eleccion}"`);
  }
}

export async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.SUPABASE_URL;
  // Nombre canónico del repo: SUPABASE_SECRET_KEY (.env); se acepta el alias estándar.
  const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("clasificar-cli: SUPABASE_URL / SUPABASE_SECRET_KEY ausentes");
  }
  const client = createClient(url, serviceKey);
  let provider: LLMProvider;
  try {
    provider = providerElegido(process.env);
  } catch (err) {
    if (err instanceof CredencialAusenteError) {
      console.log(
        `clasificar-cli: [degradación honesta] ${err.message} — cero llamadas, cero datos fabricados, exit 0`,
      );
      return;
    }
    throw err;
  }
  const runId = `clasif-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")}`;

  const deps: ClasificarRunDeps = {
    async leerPendientes(limite): Promise<NoticiaPendiente[]> {
      const { data, error } = await client
        .from("noticia")
        .select("url_hash, titular, descripcion")
        .eq("estado", "pendiente")
        .order("url_hash")
        .limit(limite);
      if (error) throw new Error(`clasificar-cli: leerPendientes: ${error.message}`);
      return data ?? [];
    },
    async escribirClasificaciones(filas): Promise<void> {
      if (dryRun) return;
      // Un upsert PARCIAL fallaría: la rama INSERT del ON CONFLICT exige las columnas NOT
      // NULL de 0084. Se leen las filas completas y se re-upsertea la fila ENTERA con los
      // campos de etiqueta — UN solo statement (la atomicidad que el gate precondiciona).
      const hashes = filas.map((f) => f.url_hash);
      const { data, error: errLee } = await client.from("noticia").select("*").in("url_hash", hashes);
      if (errLee) throw new Error(`clasificar-cli: releer filas: ${errLee.message}`);
      if (!data || data.length !== filas.length) {
        throw new Error(
          `clasificar-cli: releer filas devolvió ${data?.length ?? 0}/${filas.length} — abortado (jamás upsert parcial)`,
        );
      }
      const porHash = new Map(filas.map((f) => [f.url_hash, f]));
      const completas = data.map((fila: Record<string, unknown>) => {
        const f = porHash.get(fila.url_hash as string)!;
        return {
          ...fila,
          estado: "clasificada",
          etiqueta: f.etiqueta,
          etiqueta_confianza: f.etiqueta_confianza,
          etiqueta_modelo: f.etiqueta_modelo,
          clasificada_en: new Date().toISOString(),
        };
      });
      const { error } = await client.from("noticia").upsert(completas, { onConflict: "url_hash" });
      if (error) throw new Error(`clasificar-cli: escribirClasificaciones: ${error.message}`);
    },
    async marcarDescartadas(hashes): Promise<void> {
      if (dryRun) return;
      const { error } = await client
        .from("noticia")
        .update({ estado: "descartada" })
        .in("url_hash", [...hashes]);
      if (error) throw new Error(`clasificar-cli: marcarDescartadas: ${error.message}`);
    },
    deadLetter: dryRun
      ? { escribir: async (filas) => filas.length }
      : new SupabaseDeadLetterWriter(client),
    async escribirLedger(entrada): Promise<void> {
      if (dryRun) return;
      const { error } = await client.from("llm_ledger").insert(entrada);
      if (error) throw new Error(`clasificar-cli: escribirLedger: ${error.message}`);
    },
    provider,
    log: (m) => console.log(m),
  };

  const r = await clasificarRun(deps, runId);
  console.log(
    `clasificar-cli${dryRun ? " [dry-run]" : ""}: run=${runId} provider=${provider.id} procesadas=${r.procesadas} clasificadas=${r.clasificadas} rechazadas=${r.rechazadas} cap=${r.remanente_por_cap}`,
  );
}

const ESTE_ARCHIVO = fileURLToPath(import.meta.url);
if (ESTE_ARCHIVO === (process.argv[1] ?? "")) {
  main().catch((err) => {
    console.error("clasificar-cli FALLÓ:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
