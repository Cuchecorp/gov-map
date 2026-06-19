// run-camara-votos.live.test — corrida LIVE ACOTADA del runner de producción, gateada por
// VOTOS_LIVE=1 (SKIP por defecto → CI no quema el WAF gubernamental). Espeja el patrón
// `VOTE_SPIKE_LIVE` del spike de Phase 8.
//
// Corre `runCamaraVotos` con boletines explícitos de Leg-58 (los confirmados LIVE en Phase 8:
// 14309 / 18296) y un `limite` pequeño, con un `InMemoryTramitacionWriter` — NO escribe a la DB
// (la escritura real a Supabase es paso de operador, Task 3). Respeta el delay 2-3s LOCKED del
// HostRateLimiter (no se override). Asserts: la corrida no lanza; hay ≥1 votación con ≥1 voto
// confirmado; los errores de runIngest se registran (no abortan); NINGÚN voto carece de
// provenance (la votación que lo contiene lleva origen/fecha_captura/enlace).

import { describe, expect, it } from "vitest";
import { InMemoryTramitacionWriter, cargarMaestra, findWorkspaceRoot } from "@obs/tramitacion";
import type { Parlamentario } from "@obs/core";
import { runCamaraVotos } from "./run-camara-votos";

const LIVE = process.env.VOTOS_LIVE === "1";

// Muestra LOCKED (CONTEXT/Phase 8): 2 boletines cross-cámara de Leg-58 confirmados LIVE.
const MUESTRA = ["14309", "18296"];

function maestraReal(): Parlamentario[] {
  return cargarMaestra(findWorkspaceRoot(process.cwd()), () => {});
}

(LIVE ? describe : describe.skip)(
  "runCamaraVotos LIVE — opendata.camara.cl (VOTOS_LIVE=1)",
  () => {
    it("ingiere voto individual por diputado, cruza por DIPID y NUNCA emite fila sin provenance", async () => {
      const writer = new InMemoryTramitacionWriter();
      const res = await runCamaraVotos({
        boletines: MUESTRA,
        limite: MUESTRA.length,
        writer, // in-memory: NO escribe DB (eso es Task 3, paso de operador)
        maestra: maestraReal(),
        log: (m) => console.log(`[votos-live] ${m}`),
      });

      // La corrida no lanza y produce ≥1 votación con detalle voto-a-voto.
      expect(res.votaciones).toBeGreaterThanOrEqual(1);
      expect(res.votos).toBeGreaterThanOrEqual(1);

      // Los errores se REGISTRAN (no abortan la corrida): es un arreglo, no una excepción.
      expect(Array.isArray(res.errores)).toBe(true);

      const votos = [...writer.votos.values()];
      // ≥1 voto confirmado (DIPID mapea a id_diputado_camara en la maestra vigente).
      const confirmados = votos.filter((v) => v.estado_vinculo === "confirmado");
      expect(confirmados.length).toBeGreaterThanOrEqual(1);
      // Los confirmados llevan parlamentario_id (vía EnlaceConfirmado); los misses, null.
      expect(confirmados.every((v) => v.parlamentario_id != null)).toBe(true);
      expect(
        votos
          .filter((v) => v.estado_vinculo === "no_confirmado")
          .every((v) => v.parlamentario_id == null),
      ).toBe(true);

      // NINGÚN voto sin provenance: cada voto pertenece a una votación con origen/fecha/enlace.
      for (const votacion of writer.votaciones.values()) {
        expect(votacion.origen.length).toBeGreaterThan(0);
        expect(votacion.fecha_captura.length).toBeGreaterThan(0);
        expect(votacion.enlace.length).toBeGreaterThan(0);
      }
    });
  },
);
