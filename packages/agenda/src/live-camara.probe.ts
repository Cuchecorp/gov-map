// Probe LIVE manual (NO es un test de CI): ejerce el transporte curl (WR-03) +
// el conector de Cámara + el parser contra la red real, y reporta si obtuvo
// HTTP 200 HTML parseado a citaciones (vs fixture/fallback).
//
// Uso: pnpm --filter @obs/agenda exec tsx src/live-camara.probe.ts 2026 25
//   (o el runner TS disponible). Imprime el conteo de citaciones reales.

import { Fetcher, HostRateLimiter, RobotsGuard } from "@obs/ingest";
import { CitacionesCamaraConnector, CamaraBloqueadaError } from "./connector-camara";
import { createCurlTransport, CurlUnavailableError } from "./transport-curl";
import { parseCamaraCitaciones } from "./parse-camara-citaciones";
import { semanaIsoKey } from "./semana-iso";

async function main() {
  const year = Number(process.argv[2] ?? 2026);
  const week = Number(process.argv[3] ?? 25);
  const clave = semanaIsoKey(year, week);

  const curlTransport = createCurlTransport();
  const fetcher = new Fetcher({ fetchFn: curlTransport as unknown as typeof fetch });
  const connector = new CitacionesCamaraConnector({
    fetcher,
    rateLimiter: new HostRateLimiter(),
    robots: new RobotsGuard({ allowlist: {} }),
  });

  console.log(`[probe] fetch LIVE Cámara ${clave} vía transporte curl…`);
  try {
    const html = await connector.fetchSemana(year, week);
    const isChallenge = /Just a moment|Attention Required|cf-challenge/i.test(html);
    const citaciones = parseCamaraCitaciones(html, clave);
    console.log(`[probe] HTTP 200 — ${html.length} bytes — challenge? ${isChallenge}`);
    console.log(`[probe] parseadas ${citaciones.length} citaciones reales`);
    if (citaciones[0]) {
      console.log(`[probe] ejemplo: ${citaciones[0].comision} | ${citaciones[0].fecha} | ${citaciones[0].horario}`);
    }
    if (citaciones.length === 0) process.exitCode = 2;
  } catch (err) {
    if (err instanceof CamaraBloqueadaError) {
      console.error(`[probe] BLOQUEADA: Cloudflare 403 incluso vía curl — ${err.message}`);
      process.exitCode = 3;
    } else if (err instanceof CurlUnavailableError) {
      console.error(`[probe] curl no disponible — usar browseros (ver backlog)`);
      process.exitCode = 4;
    } else {
      console.error(`[probe] error:`, err);
      process.exitCode = 1;
    }
  }
}

void main();
