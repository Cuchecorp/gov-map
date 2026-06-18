// One-shot loader: parsea el HTML LIVE de Cámara (capturado vía curl con el header-set
// anti-Cloudflare, HTTP 200 desde este egreso) con el PARSER REAL `parseCamaraCitaciones`
// y lo carga al Supabase LOCAL con el WRITER REAL `SupabaseAgendaWriter` (mismo upsert
// idempotente que runIngest). Fallback documentado del checkpoint 06-04 cuando el `Fetcher`
// de @obs/ingest es bloqueado por Cloudflare pero la fuente responde 200 a curl.
import { readFileSync } from "node:fs";
import { parseCamaraCitaciones } from "../src/parse-camara-citaciones.ts";
import { SupabaseAgendaWriter } from "../src/writer-supabase.ts";

const SB_URL = process.env.SUPABASE_LOCAL_URL ?? "http://127.0.0.1:54421";
const KEY = process.env.SUPABASE_LOCAL_SERVICE_KEY ?? "";
if (!KEY) throw new Error("falta SUPABASE_LOCAL_SERVICE_KEY");

const writer = new SupabaseAgendaWriter({ url: SB_URL, serviceKey: KEY });
const semanas: Array<[number, string]> = [
  [23, "2026-W23"],
  [24, "2026-W24"],
  [25, "2026-W25"],
  [26, "2026-W26"],
];

let total = 0;
for (const [w, isoKey] of semanas) {
  const html = readFileSync(
    new URL(`../.live-capture/camara-2026-${w}.html`, import.meta.url),
    "utf8"
  );
  const citaciones = parseCamaraCitaciones(html, isoKey, {
    enlace: `https://www.camara.cl/legislacion/comisiones/citaciones_semana.aspx?prmSemana=2026-${w}`,
  });
  await writer.upsertCitaciones(citaciones);
  console.log(`Cámara ${isoKey}: ${citaciones.length} citaciones cargadas`);
  total += citaciones.length;
}
console.log(`TOTAL Cámara: ${total}`);
