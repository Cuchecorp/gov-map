// spike.test.ts — gate vitest del SPIKE desechable (Phase 8, VOTE-01).
//
// DOS mitades:
//  - OFFLINE (siempre, sin red, siempre verde): prueba parseCamaraVotoDetalle +
//    parseCamaraVotacion + reconciliarVotosCamara sobre el FIXTURE REAL capturado LIVE
//    en v1.0 (camara-votacion-detalle-real.xml, vote 88813 / boletin 14309-04, 58 si /
//    81 no / 16 No Vota). Mantiene la suite verde sin tocar el WAF y satisface el gate.
//  - LIVE (solo con VOTE_SPIKE_LIVE=1): invoca runSpike sobre la muestra LOCKED y
//    asserta los 4 criterios contra la respuesta fresca de opendata.camara.cl. SKIP por
//    defecto -> CI no quema el WAF. Patron LIVE-gated verbatim de packages/llm/smoke.test.ts.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseCamaraVotacion,
  parseCamaraVotoDetalle,
  reconciliarVotosCamara,
  findWorkspaceRoot,
  cargarMaestra,
} from "@obs/tramitacion";
import type { Parlamentario } from "@obs/core";
import { runSpike, imprimirFindings } from "./spike";

const ROOT = findWorkspaceRoot(process.cwd());
const FIXTURE = resolve(
  ROOT,
  "packages/tramitacion/test/fixtures/camara-votacion-detalle-real.xml",
);

function maestraReal(): Parlamentario[] {
  return cargarMaestra(ROOT, () => {});
}

// ── Mitad OFFLINE: siempre corre, sin red, prueba el fixture real ──────────────
describe("spike OFFLINE — fixture real v1.0 (camara-votacion-detalle-real.xml)", () => {
  const detalleXml = readFileSync(FIXTURE, "utf8");

  it("parseCamaraVotoDetalle devuelve >=1 voto con DIPID y opcion poblados", () => {
    const crudos = parseCamaraVotoDetalle(detalleXml);
    expect(crudos.length).toBeGreaterThanOrEqual(1);
    expect(
      crudos.every(
        (c) => c.diputadoId.length > 0 && (c.opcion === "si" || c.opcion === "no"),
      ),
    ).toBe(true);
  });

  it("conteos nominales reconcilian (count(si)===58, count(no)===81)", () => {
    const crudos = parseCamaraVotoDetalle(detalleXml);
    const countSi = crudos.filter((c) => c.opcion === "si").length;
    const countNo = crudos.filter((c) => c.opcion === "no").length;
    expect(countSi).toBe(58);
    expect(countNo).toBe(81);
    // El detalle real trae 16 "No Vota" (cod 4) que NO son nominales -> se omiten.
    expect(crudos.length).toBe(139);
  });

  it("totales del header de la votacion coinciden con los nominales (Pitfall 3)", () => {
    // El fixture es el detalle (raiz <Votacion> con totales) -> parseCamaraVotacion lo lee.
    const [votacion] = parseCamaraVotacion(detalleXml);
    expect(votacion).toBeDefined();
    expect(votacion!.id).toBe("camara:88813");
    expect(votacion!.boletin).toBe("14309-04");
    expect(votacion!.total_si).toBe(58);
    expect(votacion!.total_no).toBe(81);
  });

  it("DIPID 815 (Bobadilla) reconcilia a confirmado/determinista; misses fail-closed", () => {
    const crudos = parseCamaraVotoDetalle(detalleXml);
    const votos = reconciliarVotosCamara(crudos, "camara:88813", maestraReal());

    const v815 = votos.find((x) => x.fuente_voter_id === "815");
    expect(v815).toBeDefined();
    expect(v815!.estado_vinculo).toBe("confirmado");
    expect(v815!.metodo).toBe("determinista");
    expect(v815!.parlamentario_id).not.toBeNull();

    // Fail-closed: los no mapeados quedan null/no_confirmado, sin crash.
    const noConf = votos.filter((x) => x.estado_vinculo === "no_confirmado");
    expect(noConf.every((x) => x.parlamentario_id === null && x.metodo === null)).toBe(
      true,
    );

    // Ratio de mapeo sobre el fixture real (legislatura vigente) debe ser alto.
    const confirmados = votos.filter((x) => x.estado_vinculo === "confirmado").length;
    expect(confirmados / votos.length).toBeGreaterThanOrEqual(0.95);
  });
});

// ── Mitad LIVE-gated: solo con VOTE_SPIKE_LIVE=1 (SKIP en CI) ───────────────────
const LIVE = process.env.VOTE_SPIKE_LIVE === "1";

// Muestra LOCKED (CONTEXT): 2 boletines cross-camara de v1.0 + cobertura actual via
// las votaciones que el propio getVotaciones_Boletin devuelva (no existe enumeracion
// por anno). Si la muestra reciente no se amplia, degrada a estos 2 (cobertura reducida).
const MUESTRA = ["14309", "18296"];

(LIVE ? describe : describe.skip)(
  "spike LIVE — opendata.camara.cl (VOTE_SPIKE_LIVE=1)",
  () => {
    it("getVotacion_Detalle entrega votos por diputado mapeables, con totales reconciliados", async () => {
      const r = await runSpike({ boletines: MUESTRA, maestra: maestraReal() });
      imprimirFindings(r);

      // Cobertura: al menos un boletin de la muestra devolvio detalle.
      expect(r.boletinesConDetalle).toBeGreaterThanOrEqual(1);
      expect(r.porVotacion.length).toBeGreaterThanOrEqual(1);

      for (const v of r.porVotacion) {
        // (a) DIPID + Opcion no null.
        expect(v.camposPoblados).toBe(true);
        // (b) Totales reconcilian.
        expect(v.totalesReconcilian).toBe(true);
        // (c) DIPID mapea a id_diputado_camara (>= 0.95).
        expect(v.ratioMapeo).toBeGreaterThanOrEqual(0.95);
      }

      // (d) Comportamiento de rate: sin tormenta de errores (429/RetryableError).
      const errores = r.requests.filter((x) => x.status === "error").length;
      expect(errores).toBeLessThanOrEqual(Math.floor(r.requests.length / 2));
    });
  },
);
