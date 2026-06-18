/**
 * DummyConnector — ejercita el framework end-to-end SIN tocar ninguna fuente
 * gubernamental real (Camara/Senado/BCN son Fases 5-7).
 *
 * Es el walking skeleton de ingesta: implementa los tres hooks
 * (endpoints/validateShape/fingerprint) sobre un endpoint de prueba, y hereda
 * todo el flujo invariante (cache->robots->rate-limit->fetch->drift->R2->
 * snapshot + provenance) de BaseConnector sin reescribir nada.
 */
import { BaseConnector, type RequestSpec } from "./base-connector";
import { fingerprint } from "./drift";

/** Forma cruda del dummy: passthrough, sin validacion estricta. */
export type DummyRaw = unknown;

export class DummyConnector extends BaseConnector<DummyRaw> {
  protected sourceId = "dummy";

  /** Un unico endpoint de prueba (NO es una fuente real). */
  protected endpoints(): RequestSpec[] {
    return [
      {
        url: "https://dummy.local/echo",
        host: "dummy.local",
        resource: "echo",
        key: "echo",
        params: { probe: 1 },
        ext: "json",
      },
    ];
  }

  /** Shape-guard SUAVE: passthrough (la validacion estricta es Fase 5+). */
  protected validateShape(body: unknown): DummyRaw {
    return body;
  }

  /** Fingerprint estructural sobre el objeto crudo. */
  protected fingerprint(raw: DummyRaw): Promise<string> {
    return fingerprint(raw);
  }
}
