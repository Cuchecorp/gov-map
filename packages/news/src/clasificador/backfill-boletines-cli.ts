// backfill-boletines-cli.ts — puebla `noticia.boletines_detectados` (137-01) con la
// detección DETERMINISTA de `extraerBoletines` sobre titular+descripción. Idempotente:
// re-correr recalcula el mismo valor (función pura sobre texto inmutable). LOCAL.
//
//   pnpm --filter @obs/news exec tsx src/clasificador/backfill-boletines-cli.ts
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { extraerBoletines } from "../resolver/boletin-en-materia.js";

export async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL ?? process.env.SUPABASE_API_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("backfill-boletines: SUPABASE_URL / SUPABASE_SECRET_KEY ausentes");
  const client = createClient(url, serviceKey);

  // Paginar SIEMPRE (cap PostgREST 1k).
  const filas: Array<{ url_hash: string; titular: string; descripcion: string | null }> = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await client
      .from("noticia")
      .select("url_hash, titular, descripcion")
      .order("url_hash")
      .range(desde, desde + 999);
    if (error) throw new Error(`backfill-boletines: lectura: ${error.message}`);
    if (!data || data.length === 0) break;
    filas.push(...data);
    if (data.length < 1000) break;
  }
  if (filas.length === 0) throw new Error("backfill-boletines: cero noticias (cero vacuo)");

  let conBoletin = 0;
  for (const f of filas) {
    const detectados = extraerBoletines(`${f.titular} ${f.descripcion ?? ""}`);
    if (detectados.length > 0) conBoletin += 1;
    const { error } = await client
      .from("noticia")
      .update({ boletines_detectados: detectados })
      .eq("url_hash", f.url_hash);
    if (error) throw new Error(`backfill-boletines: update ${f.url_hash}: ${error.message}`);
  }
  console.log(`backfill-boletines: filas=${filas.length} conBoletin=${conBoletin}`);
}

const ESTE_ARCHIVO = fileURLToPath(import.meta.url);
if (ESTE_ARCHIVO === (process.argv[1] ?? "")) {
  main().catch((err) => {
    console.error("backfill-boletines FALLÓ:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
