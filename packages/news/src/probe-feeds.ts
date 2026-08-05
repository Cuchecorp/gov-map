// probe-feeds.ts — script LOCAL (no test, no CI) que corre el riesgo A4 del research: prueba
// si el Fetcher REAL de Node de @obs/ingest puede traer los 5 feeds de prensa (un WAF podría
// responder 403 a Node aunque `curl` funcione — precedente camara.cl). Corre EN SERIE, con
// RobotsGuard + HostRateLimiter reales (>=3s entre requests), y captura los XML crudos como
// fixtures del repo para los planes 02/04/05/06.
//
// Ejecutar UNA sola vez: `pnpm --filter @obs/news exec tsx src/probe-feeds.ts`.
// Ante 403/429/5xx: PARA (no reintenta en ráfaga, no hace workaround de UA/headers). Piso
// duro: <3 feeds vivos ⇒ la fase debe pararse y escalar (ver 132-01-PLAN.md Task 3).
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Fetcher, FetchError, HostRateLimiter, RetryableError, RobotsGuard } from "@obs/ingest";
import { FEEDS } from "./feeds";
import { allowlistNews } from "./allowlist-news";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "__fixtures__");

async function main(): Promise<void> {
  mkdirSync(FIXTURES_DIR, { recursive: true });

  const allowlist = allowlistNews();
  const robots = new RobotsGuard({ allowlist });
  const rateLimiter = new HostRateLimiter({ minDelayMs: 3000, jitterMs: 0 });
  const fetcher = new Fetcher({ allowlist });

  const vivos: string[] = [];
  const caidos: { slug: string; motivo: string }[] = [];
  const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

  let first = true;
  for (const feed of FEEDS) {
    const host = new URL(feed.url).host;

    // Regimen v13 (>=3s entre requests EN SERIE, sin importar si el host cambia): HostRateLimiter
    // solo serializa por-host (hosts distintos no se demoran entre si), asi que se agrega una espera
    // explicita de 3s entre cada request consecutivo del probe (excepto el primero).
    if (!first) await sleep(3000);
    first = false;

    console.log(`[req-start] ${feed.slug} ${new Date().toISOString()}`);

    const permitido = await robots.isAllowed(feed.url);
    if (!permitido) {
      console.log(`[robots-disallow] ${feed.slug} — PARANDO (escalar)`);
      caidos.push({ slug: feed.slug, motivo: "robots-disallow" });
      break;
    }

    await rateLimiter.wait(host);

    try {
      const bytes = await fetcher.get({ url: feed.url });
      const text = Buffer.from(bytes);
      const sha = createHash("sha256").update(text).digest("hex").slice(0, 8);
      const nItems = (text.toString("utf-8").match(/<item[\s>]/g) ?? []).length;
      const outPath = join(FIXTURES_DIR, `${feed.slug}.xml`);
      writeFileSync(outPath, text);
      console.log(
        `${feed.slug} ${text.byteLength} ${sha} ${nItems} ${new Date().toISOString()}`,
      );
      vivos.push(feed.slug);
    } catch (err) {
      if (err instanceof FetchError) {
        console.log(`[fetch-error] ${feed.slug} status=${err.status} — PARANDO ese feed`);
        caidos.push({ slug: feed.slug, motivo: `FetchError ${err.status}` });
        continue;
      }
      if (err instanceof RetryableError) {
        console.log(`[retryable] ${feed.slug} status=${err.status} — PARANDO ese feed`);
        caidos.push({ slug: feed.slug, motivo: `RetryableError ${err.status}` });
        continue;
      }
      console.log(`[error-desconocido] ${feed.slug} ${String(err)}`);
      caidos.push({ slug: feed.slug, motivo: String(err) });
    }
  }

  console.log(`\n[resumen] vivos=${vivos.length} caidos=${caidos.length}`);
  console.log(`[vivos] ${vivos.join(", ")}`);
  if (caidos.length > 0) {
    console.log(`[caidos] ${JSON.stringify(caidos)}`);
  }
  if (vivos.length < 3) {
    console.error("[PISO-DURO] <3 feeds vivos — PARAR la fase y escalar (NEWS-02 en riesgo)");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("[probe-feeds] error fatal:", err);
  process.exitCode = 1;
});
