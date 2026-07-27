/**
 * Drift canary del endpoint Workers AI (INTEG-03).
 *
 * Problema: Workers AI puede cambiar el modelo servido bajo el mismo nombre de path
 * sin aviso. Si el modelo real que procesa las requests ya no es
 * "@cf/ibm-granite/granite-4.0-h-micro", los números del veredicto full-40
 * (107-VEREDICTO-LIVE-FULL-2026-07-27.md) dejan de ser válidos y el operador
 * NO debería confiar en ellos para flipear CLASIFICACION_ESCALERA=1.
 *
 * Esta prueba detecta ese drift: hace una probe mínima (1 caso del GOLDEN_SET_GATE)
 * vía GraniteProvider y captura el campo `model` devuelto en el body de la completion.
 * Si difiere del modelo pinneado → FALLA con mensaje explícito de invalidación del veredicto.
 * Si coincide → PASA + imprime confirmación de provenance.
 *
 * Gate LIVE: CLASIFICACION_DRIFT_CHECK === "1" + WORKERS_AI_API_TOKEN + CLOUDFLARE_ACCOUNT_ID.
 * Skip limpio sin el flag (nunca corre en CI — CI no setea CLASIFICACION_DRIFT_CHECK).
 *
 * Provenance pinneado (107-VEREDICTO-LIVE-FULL-2026-07-27.md):
 *   modelo  : @cf/ibm-granite/granite-4.0-h-micro
 *   endpoint: https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/v1
 *   fecha   : 2026-07-27
 *
 * Para activar (fuera de CI):
 *   CLASIFICACION_DRIFT_CHECK=1 \
 *   WORKERS_AI_API_TOKEN=<token> \
 *   CLOUDFLARE_ACCOUNT_ID=<account_id> \
 *   pnpm --filter @obs/cruces exec vitest run src/drift-canary.test.ts
 */
import { describe, it, expect } from "vitest";
import { GOLDEN_SET_GATE, inputDeCaso } from "./golden/golden-set";

// Modelo pinneado del veredicto full-40 (2026-07-27). NO cambiar sin re-correr el benchmark.
const MODELO_PINNEADO = "@cf/ibm-granite/granite-4.0-h-micro";

// Fecha del veredicto pinneado — incluida en el informe de confirmación de provenance.
const FECHA_PINNEADA = "2026-07-27";

const LIVE = process.env.CLASIFICACION_DRIFT_CHECK === "1";

(LIVE ? describe : describe.skip)(
  "drift canary Workers AI — compara modelo servido vs pinneado (CLASIFICACION_DRIFT_CHECK=1)",
  () => {
    it.skipIf(
      !process.env.WORKERS_AI_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID,
    )(
      "el modelo servido por Workers AI debe coincidir con el pinneado; cualquier drift invalida el veredicto",
      async () => {
        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
        const workerToken = process.env.WORKERS_AI_API_TOKEN!;

        // Pitfall 1 (T-109-07): ACCOUNT_ID interpolado en baseURL, nunca hardcodeado.
        const baseURL = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`;
        const endpoint = `${baseURL}/chat/completions`;

        // Primer caso ficha del GOLDEN_SET_GATE como probe mínima.
        const casoFicha = GOLDEN_SET_GATE.find((c) => c.tipo === "ficha");
        if (!casoFicha) {
          throw new Error("GOLDEN_SET_GATE no tiene casos de tipo 'ficha' — revisar casos.json");
        }
        const d = inputDeCaso(casoFicha);
        if (d.tipo !== "ficha") {
          throw new Error("inputDeCaso devolvió tipo inesperado");
        }

        // Probe directa vía fetch para capturar `model` del body de la completion.
        // GraniteProvider usa tool_choice forzado; aquí hacemos la probe cruda para acceder
        // al campo model tal como lo devuelve Workers AI (RESEARCH §7).
        // La probe es mínima: content reducido, sin schema zod, sin repair loop.
        const probeBody = {
          model: MODELO_PINNEADO,
          max_tokens: 32,
          messages: [
            {
              role: "user" as const,
              content:
                // Texto reducido — el objetivo no es la clasificación sino capturar model servido.
                `Clasifica en JSON: ${d.input.materia ?? d.input.titulo ?? d.input.idea_matriz ?? "infraestructura"}`,
            },
          ],
        };

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${workerToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(probeBody),
        });

        if (!res.ok) {
          throw new Error(
            `[drift-canary] probe HTTP falló: ${res.status} ${res.statusText} — ` +
              `verificar WORKERS_AI_API_TOKEN y CLOUDFLARE_ACCOUNT_ID`,
          );
        }

        const body = (await res.json()) as { model?: string; choices?: unknown[] };
        const modeloServido = body.model ?? "(campo model ausente en body)";

        if (modeloServido !== MODELO_PINNEADO) {
          // El veredicto full-40 fue medido con MODELO_PINNEADO. Si el modelo cambió,
          // los números de paridad ya no son válidos para decidir la promoción.
          throw new Error(
            `[DRIFT DETECTADO] modelo servido: "${modeloServido}" ≠ pinneado: "${MODELO_PINNEADO}" ` +
              `— veredicto full-40 (${FECHA_PINNEADA}) INVALIDADO. ` +
              `Re-correr el benchmark con el modelo actual antes de promover.`,
          );
        }

        // Provenance confirmada: el modelo servido coincide con el pinneado del veredicto.
        console.log(
          `[drift-canary] provenance OK:\n` +
            `  modelo servido : ${modeloServido}\n` +
            `  modelo pinneado: ${MODELO_PINNEADO}\n` +
            `  endpoint       : ${baseURL}\n` +
            `  fecha veredicto: ${FECHA_PINNEADA}\n` +
            `  → El veredicto full-40 sigue siendo válido.`,
        );

        expect(modeloServido).toBe(MODELO_PINNEADO);
      },
    );
  },
);
