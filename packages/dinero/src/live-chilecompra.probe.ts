// Probe LIVE manual (NO es un test de CI): hace requests REALES al REST de ChileCompra
// (api.mercadopublico.cl) y verifica que la forma de la respuesta coincide con los Zod schemas de
// model.ts (BuscarProveedor -> CodigoEmpresa; ordenesdecompra -> Cantidad/Listado). Mirror de
// `live-infoprobidad.probe.ts`.
//
// REQUIERE un ticket real (secreto de operador): exportar MERCADOPUBLICO_TICKET en el entorno
// (NUNCA por argv). Sin ticket, el probe no consulta y reporta el faltante.
//
// Uso (host Windows -> Bash tool / git-bash, NO PowerShell):
//   MERCADOPUBLICO_TICKET=... pnpm --filter @obs/dinero exec tsx src/live-chilecompra.probe.ts "76.123.456-0" [DDMMAAAA]
//   Respeta el delay 2-3s del HostRateLimiter y el UA identificatorio.

import { Fetcher, HostRateLimiter, RobotsGuard } from "@obs/ingest";
import { ChileCompraConnector, ChileCompraBloqueadaError } from "./connector-chilecompra";
import { ddmmaaaaDe } from "./query";
import { BuscarProveedorResponseSchema, OrdenesResponseSchema } from "./model";

async function main() {
  const rut = process.argv[2] ?? "76.123.456-0";
  const dia = process.argv[3] ?? ddmmaaaaDe(new Date());
  const ticket = process.env.MERCADOPUBLICO_TICKET ?? "";

  if (ticket.length === 0) {
    console.error("[probe] FALTA MERCADOPUBLICO_TICKET en el entorno (secreto de operador). Abortando sin consultar.");
    process.exitCode = 4;
    return;
  }

  const connector = new ChileCompraConnector({
    fetcher: new Fetcher(),
    rateLimiter: new HostRateLimiter(),
    robots: new RobotsGuard({ allowlist: {} }),
  });

  console.log(`[probe] fetch LIVE ChileCompra rut="${rut}" dia="${dia}" (delay 2-3s LOCKED)…`);
  try {
    // Paso 1: BuscarProveedor -> CodigoEmpresa.
    const j1 = await connector.buscarProveedor(rut, ticket);
    const p1 = BuscarProveedorResponseSchema.safeParse(j1);
    console.log(`[probe] paso 1 BuscarProveedor — schema coincide? ${p1.success}`);
    if (!p1.success) {
      console.error("[probe] DELTA de forma (BuscarProveedor):", p1.error.issues);
      process.exitCode = 2;
      return;
    }
    const codigo = String(p1.data.CodigoEmpresa);
    console.log(`[probe] CodigoEmpresa=${codigo} NombreEmpresa=${p1.data.NombreEmpresa ?? "(null)"}`);

    // Paso 2: ordenesdecompra.json -> Cantidad/Listado.
    const j2 = await connector.ordenesDeCompra(codigo, dia, ticket);
    const p2 = OrdenesResponseSchema.safeParse(j2);
    console.log(`[probe] paso 2 ordenesdecompra — schema coincide? ${p2.success}`);
    if (!p2.success) {
      console.error("[probe] DELTA de forma (ordenesdecompra):", p2.error.issues);
      process.exitCode = 2;
      return;
    }
    console.log(`[probe] OK — Cantidad=${p2.data.Cantidad} Listado.length=${p2.data.Listado.length}`);
    if (p2.data.Listado[0]) {
      console.log(`[probe] ejemplo orden: Codigo=${p2.data.Listado[0].Codigo} Nombre=${p2.data.Listado[0].Nombre ?? "(null)"}`);
    }
  } catch (err) {
    if (err instanceof ChileCompraBloqueadaError) {
      console.error(`[probe] BLOQUEADA: ChileCompra ${err.status} — ${err.message}`);
      process.exitCode = 3;
    } else {
      console.error(`[probe] error:`, err);
      process.exitCode = 1;
    }
  }
}

void main();
