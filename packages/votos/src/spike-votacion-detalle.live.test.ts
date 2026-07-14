// spike-votacion-detalle.live.test — SPIKE LIVE gated (VOTOS_LIVE=1) del endpoint REAL
// getVotacion_Detalle de opendata.camara.cl. SKIP por defecto → CI no quema el WAF (el archivo
// está EXCLUIDO del glob de vitest en packages/votos/vitest.config.ts; el gate describe.skip es
// defensa en profundidad). Espeja el patrón de run-camara-votos.live.test.ts.
//
// Cierra la mitad LIVE del SPIKE de Phase 64 (Plan 01 fijó la semántica offline):
//  (STAGE 1, dos-etapas LOCKED) por cada votación, persiste el crudo XML a R2 content-addressed
//    vía R2Store.putImmutable (If-None-Match:*, 412=idempotente OK) ANTES de parsear. R2 es la
//    verdad cruda; el parse es un derivado reconstruible.
//  (STAGE 2) parsea el crudo LIVE con parseCamaraVotoDetalle (semántica fijada en Plan 01:
//    0→no 1→si 2→abstencion 4→ausente; pareo desde el bloque hermano <Pareos>) y hace un
//    cross-check por bucket semántico Σ(roster) == Total* del MISMO XML LIVE — un mismatch
//    hace expect-fail RUIDOSO (SC#3 LIVE).
//  (HUNT) escanea las votaciones para OBSERVAR un <Pareos> no vacío y (si existe) una votación
//    con TotalDispensados>0, y registra lo observado. Si no aparece en la muestra → "no
//    observado" (fail-closed documentado, NUNCA fabricado).
//
// Rate-limit 2-3s LOCKED: los fetch son SERIALES (sin Promise.all); el HostRateLimiter interno
// de buildCamaraConnector() impone el delay — NO se override. UA identificatorio vía Fetcher.
// NO escribe a Supabase (eso es Phase 66). Cero paquetes nuevos.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  caracterizarVotacionDetalle,
  findWorkspaceRoot,
  parseCamaraVotoDetalle,
} from "@obs/tramitacion";
import { R2Store, sha256Hex } from "@obs/ingest";
import { buildCamaraConnector } from "./run-camara-votos";

const LIVE = process.env.VOTOS_LIVE === "1";

// IDs confirmados LIVE (RESEARCH 2026-07-13, HTTP 200). Se recorren SERIALMENTE.
const VOTACION_IDS = ["89178", "89179", "89180", "88813", "89000"];

/** loadEnv BOM-safe (mismo patrón que run-votos-masivo-cli.ts). */
function loadEnv(root: string): Record<string, string> {
  const raw = readFileSync(join(root, ".env"), "utf8").replace(/^﻿/, "");
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]!] = m[2]!.trim().replace(/^['"]|['"]$/g, "");
  }
  return out;
}

(LIVE ? describe : describe.skip)(
  "SPIKE getVotacion_Detalle LIVE — opendata.camara.cl (VOTOS_LIVE=1)",
  () => {
    it(
      "persiste el crudo LIVE a R2 (STAGE 1), cross-check ruidoso, caza Pareo/Dispensado",
      async () => {
        const root = findWorkspaceRoot(process.cwd());
        const env = loadEnv(root);

        // R2 creds obligatorias: si faltan → falla RUIDOSO (nunca persist silencioso).
        const faltantes = [
          "R2_ACCESS_KEY_ID",
          "R2_SECRET_ACCESS_KEY",
          "R2_ENDPOINT_URL",
          "R2_BUCKET",
        ].filter((k) => !env[k]);
        expect(
          faltantes,
          `Faltan credenciales R2 en .env: ${faltantes.join(", ")} — STAGE 1 requiere R2`,
        ).toEqual([]);

        const r2 = new R2Store({
          accessKeyId: env.R2_ACCESS_KEY_ID!,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
          endpoint: env.R2_ENDPOINT_URL!,
          bucket: env.R2_BUCKET!,
        });

        const camara = buildCamaraConnector();
        const date = new Date().toISOString().slice(0, 10);

        // Acumuladores del HUNT (SC#2, mitad LIVE).
        const r2Paths: string[] = [];
        let pareoObservado = false;
        let dispensadoObservado = false;

        // Recorrido SERIAL (NO Promise.all): el HostRateLimiter interno impone el delay 2-3s
        // LOCKED entre requests al mismo host. Persistir ≥1 crudo satisface SC#1.
        for (const id of VOTACION_IDS) {
          let xml: string;
          try {
            xml = await camara.fetchVotacionDetalle(id);
          } catch (err) {
            // El endpoint puede degradar (WAF/5xx): se registra y se sigue con el siguiente id
            // (fallback honesto SC#4, documentado en el .md). No aborta la corrida.
            console.log(
              `[spike-detalle] fetch FALLÓ para votacionId=${id}: ${
                err instanceof Error ? err.message : String(err)
              } — continúa (ver fallback SC#4)`,
            );
            continue;
          }

          // STAGE 1 (dos-etapas LOCKED): crudo → R2 content-addressed ANTES de parsear.
          const body = new TextEncoder().encode(xml);
          const sha = await sha256Hex(body);
          const { r2Path, existed } = await r2.putImmutable(
            "camara-opendata",
            "getVotacion_Detalle",
            date,
            sha,
            "xml",
            body,
          );
          expect(r2Path.length, "putImmutable debe devolver un r2Path no-vacío").toBeGreaterThan(0);
          r2Paths.push(r2Path);
          console.log(
            `[spike-detalle] STAGE1 votacionId=${id} → r2Path=${r2Path} existed=${existed}`,
          );

          // STAGE 2: parse del crudo LIVE + cross-check por bucket semántico contra el header
          // del MISMO XML. Un mismatch hace expect-fail RUIDOSO (SC#3 LIVE).
          const votos = parseCamaraVotoDetalle(xml);
          const header = caracterizarVotacionDetalle(xml);
          const pareados = header.pareados;

          const sumSi = votos.filter((v) => v.opcion === "si").length;
          const sumNo = votos.filter((v) => v.opcion === "no").length;
          const sumAbs = votos.filter((v) => v.opcion === "abstencion").length;
          const sumPareo = votos.filter((v) => v.opcion === "pareo").length;

          console.log(
            `[spike-detalle] votacionId=${id} roster: si=${sumSi} no=${sumNo} abs=${sumAbs} ` +
              `pareo=${sumPareo} | header: Afirm=${header.afirmativos} Neg=${header.negativos} ` +
              `Abst=${header.abstenciones} Disp=${header.dispensados}`,
          );

          expect(sumSi, `si Σ==TotalAfirmativos (votacionId=${id})`).toBe(header.afirmativos);
          expect(sumNo, `no Σ==TotalNegativos (votacionId=${id})`).toBe(header.negativos);
          expect(sumAbs, `abstencion Σ==TotalAbstenciones (votacionId=${id})`).toBe(
            header.abstenciones,
          );

          // HUNT (a): Pareo. Si <Pareos> no vacío → confirma que el parser emite "pareo" para
          // esos DIPID (Plan 01: re-etiqueta desde el bloque hermano, NUNCA código 3).
          if (pareados.length > 0) {
            pareoObservado = true;
            for (const dipid of pareados) {
              const fila = votos.find((v) => v.diputadoId === dipid);
              expect(
                fila?.opcion,
                `DIPID ${dipid} está en <Pareos> → el parser debe emitir "pareo" (votacionId=${id})`,
              ).toBe("pareo");
            }
            console.log(
              `[spike-detalle] PAREO OBSERVADO en votacionId=${id}: DIPID pareados=${pareados.join(
                ",",
              )} (parser los emite como "pareo")`,
            );
          }

          // HUNT (b): Dispensado. Si TotalDispensados>0 → inspecciona las filas "ausente" para
          // determinar si "Dispensado" es una Opcion distinta o se pliega a "No Vota" (código 4).
          if (header.dispensados > 0) {
            dispensadoObservado = true;
            const ausentes = votos.filter((v) => v.opcion === "ausente").length;
            console.log(
              `[spike-detalle] DISPENSADO OBSERVADO en votacionId=${id}: TotalDispensados=${header.dispensados} ` +
                `| filas ausente en roster=${ausentes} → inspeccionar si "Dispensado" es Opcion propia o se ` +
                `pliega a "No Vota" (código 4). Registrar el bucket en el .md.`,
            );
          }
        }

        // SC#1: al menos un crudo LIVE persistido content-addressed en R2.
        expect(
          r2Paths.length,
          "≥1 crudo LIVE persistido a R2 (SC#1) — si 0, el endpoint degradó: ver fallback SC#4",
        ).toBeGreaterThanOrEqual(1);

        // HUNT: registro honesto de lo NO observado en la ventana (fail-closed, nunca fabricado).
        if (!pareoObservado) {
          console.log(
            "[spike-detalle] PAREO: NO observado en la muestra (bloque <Pareos> vacío en todas). " +
              "Se conserva el fallback y se anota para re-probe en Phase 66 — NO se fabrica un código.",
          );
        }
        if (!dispensadoObservado) {
          console.log(
            "[spike-detalle] DISPENSADO: NO observado (TotalDispensados=0 en toda la muestra). " +
              "El bucket 'No Vota' (código 4) vs TotalDispensados queda para re-probe en Phase 66.",
          );
        }

        console.log(
          `[spike-detalle] RESUMEN: crudos R2=${r2Paths.length} | pareoObservado=${pareoObservado} ` +
            `| dispensadoObservado=${dispensadoObservado} | r2Paths=${JSON.stringify(r2Paths)}`,
        );
      },
    );
  },
);
