// Probe LIVE manual (NO es un test de CI): hace 1 request real al listado de audiencias de
// leylobby y verifica que el HTML trae el cell `Identificador` (`{INST}AW{N}`) y la tabla de
// asistentes. Mirror de `live-camara.probe.ts`.
//
// Uso: pnpm --filter @obs/lobby exec tsx src/live-leylobby.probe.ts AA001 2024
//   (institución, año). Respeta el delay 2-3s del HostRateLimiter y el UA identificatorio.
//
// NOTA CONGRESO (Open Question 2): la Cámara/Senado NO publican en leylobby; este probe valida
// la FORMA del parser sobre cualquier institución leylobby. La corrida LIVE contra el congreso
// usa el portal propio de la Cámara y es verificación de operador (checkpoint Task 4).

import { Fetcher, HostRateLimiter, RobotsGuard } from "@obs/ingest";
import { LeylobbyConnector, LeylobbyBloqueadaError } from "./connector-leylobby";
import { parseLobbyAudiencias } from "./parse-leylobby";

async function main() {
  const institucion = process.argv[2] ?? "AA001";
  const anio = Number(process.argv[3] ?? new Date().getFullYear());

  const connector = new LeylobbyConnector({
    fetcher: new Fetcher(),
    rateLimiter: new HostRateLimiter(),
    robots: new RobotsGuard({ allowlist: {} }),
  });

  console.log(`[probe] fetch LIVE leylobby ${institucion}/${anio} (delay 2-3s LOCKED)…`);
  try {
    const html = await connector.fetchAudiencias(institucion, anio, 1);
    const tieneIdentificador = /[A-Z0-9]+AW\d+/.test(html);
    const tieneTabla = /<table[^>]*class="[^"]*table/i.test(html);
    const aud = parseLobbyAudiencias(html, { institucionCodigo: institucion });
    console.log(`[probe] HTTP 200 — ${html.length} bytes — identificador? ${tieneIdentificador} — tabla? ${tieneTabla}`);
    console.log(`[probe] parseadas ${aud.length} audiencias reales`);
    if (aud[0]) {
      const sp = aud[0].asistentes.find((a) => a.rol === "Sujeto Pasivo");
      const cps = aud[0].asistentes.filter((a) => a.rol !== "Sujeto Pasivo");
      console.log(
        `[probe] ejemplo: ${aud[0].identificador} | sujeto pasivo: ${sp?.nombre ?? "(ninguno)"} | contrapartes: ${cps.length}`,
      );
    }
    if (aud.length === 0) process.exitCode = 2;
  } catch (err) {
    if (err instanceof LeylobbyBloqueadaError) {
      console.error(`[probe] BLOQUEADA: leylobby ${err.status} — ${err.message}`);
      process.exitCode = 3;
    } else {
      console.error(`[probe] error:`, err);
      process.exitCode = 1;
    }
  }
}

void main();
