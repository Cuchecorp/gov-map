// Probe LIVE manual (NO es un test de CI): hace 1 request SPARQL real al endpoint de InfoProbidad
// (`datos.cplt.cl/sparql`) y verifica que el JSON trae `results.bindings` con `fechaDeclaracion` y
// la estructura esperada. Mirror de `live-leylobby.probe.ts`.
//
// Uso: pnpm --filter @obs/probidad exec tsx src/live-infoprobidad.probe.ts "bianchi chelech"
//   (fragmento de nombre normalizado). Respeta el delay 2-3s del HostRateLimiter y el UA.

import { Fetcher, HostRateLimiter, RobotsGuard } from "@obs/ingest";
import { InfoProbidadConnector, InfoProbidadBloqueadaError } from "./connector-infoprobidad";
import { queryDeclaracionesPorNombre } from "./sparql";
import { parseDeclaraciones } from "./parse-infoprobidad";

async function main() {
  const nombre = (process.argv[2] ?? "bianchi chelech").toLowerCase();

  const connector = new InfoProbidadConnector({
    fetcher: new Fetcher(),
    rateLimiter: new HostRateLimiter(),
    robots: new RobotsGuard({ allowlist: {} }),
  });

  console.log(`[probe] fetch LIVE InfoProbidad nombre="${nombre}" (delay 2-3s LOCKED)…`);
  try {
    const json = (await connector.fetchSparql(queryDeclaracionesPorNombre(nombre))) as {
      results?: { bindings?: unknown[] };
    };
    const bindings = json?.results?.bindings;
    const tieneBindings = Array.isArray(bindings);
    const decls = parseDeclaraciones(json, { enlace: "https://datos.cplt.cl/sparql" });
    const fechas = new Set(decls.map((d) => d.fechaPresentacion));
    console.log(
      `[probe] HTTP 200 — results.bindings? ${tieneBindings} (${bindings?.length ?? 0} filas) — ` +
        `versiones parseadas: ${decls.length} — fechas distintas: ${fechas.size}`,
    );
    if (decls[0]) {
      console.log(
        `[probe] ejemplo: ${decls[0].fuenteId} | ${decls[0].fechaPresentacion} | tipo: ${decls[0].tipo} | ` +
          `licencia: ${decls[0].licencia} | bienes inmuebles: ${decls[0].bienes.inmuebles.length}`,
      );
    }
    if (decls.length === 0) process.exitCode = 2;
  } catch (err) {
    if (err instanceof InfoProbidadBloqueadaError) {
      console.error(`[probe] BLOQUEADA: InfoProbidad ${err.status} — ${err.message}`);
      process.exitCode = 3;
    } else {
      console.error(`[probe] error:`, err);
      process.exitCode = 1;
    }
  }
}

void main();
