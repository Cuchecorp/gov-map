/**
 * BaseConnector — Template Method del flujo invariante de ingesta
 * (FND-01, FND-02, FND-03, FND-04, FND-08).
 *
 * Define el orden NO sobreescribible:
 *   cache -> robots -> rate-limit -> fetch -> drift -> R2 -> snapshot
 * Cada conector futuro (Fases 5-7) implementa solo los hooks `endpoints`,
 * `validateShape` y `fingerprint`. La politica (rate-limit, robots, cache,
 * inmutabilidad, provenance) vive UNA sola vez aqui: ningun conector puede
 * saltarse `rateLimiter.wait` ni meter crudo en Postgres.
 *
 * Los colaboradores se inyectan por constructor (ConnectorDeps) para testear
 * sin red y para que el worker de Plan 03 instancie implementaciones reales
 * (aws4fetch/supabase-js).
 */
import { type Provenance, makeProvenance } from "@obs/core";
import type { IngestRun } from "@obs/core";
import { sha256Hex } from "./r2-store";
import type { DriftResult } from "./drift";
import type { SnapshotRef } from "./snapshot";

/** Spec de un request a una fuente. */
export interface RequestSpec {
  url: string;
  /**
   * Host del request. DEPRECATED como fuente de verdad (WR-01): el framework
   * deriva SIEMPRE el host de `new URL(url).host` para rate-limit/robots, de
   * modo que un conector no pueda spoofear un host distinto del fetcheado y
   * saltarse el rate-limiter. Se conserva opcional por compatibilidad.
   */
  host?: string;
  /** Recurso logico (mapea a source_snapshot.resource). */
  resource: string;
  /** Llave logica del endpoint (para drift por source,resource). */
  key: string;
  params?: Record<string, unknown>;
  /** Extension del crudo en R2 (json|xml|html). Default json. */
  ext?: string;
}

/** Colaboradores inyectables del flujo invariante. */
export interface ConnectorDeps {
  cache: {
    dailyKey(source: string, spec: RequestSpec, now: Date): Promise<string>;
    hasToday(source: string, spec: RequestSpec, now: Date): Promise<boolean>;
  };
  robots: { isAllowed(url: string): Promise<boolean> };
  rateLimiter: { wait(host: string): Promise<void> };
  /**
   * Gate de rate-limit DURABLE compartido entre invocaciones/isolates (CR-02).
   * El `rateLimiter` en proceso es solo un fast-path dentro de un batch; este
   * gate (respaldado en Postgres) es la AUTORIDAD del 2-3s/host cross-invocacion.
   * Opcional: si no se inyecta (tests), solo aplica el limiter en proceso.
   */
  hostThrottle?: { reserve(host: string): Promise<void> };
  fetcher: { get(spec: RequestSpec): Promise<Uint8Array> };
  drift: {
    check(source: string, resource: string, fp: string): Promise<DriftResult>;
    alert(source: string, resource: string, result: DriftResult): Promise<void>;
  };
  r2: {
    putImmutable(
      source: string,
      resource: string,
      date: string,
      sha: string,
      ext: string,
      body: Uint8Array,
    ): Promise<{ r2Path: string; existed: boolean }>;
  };
  snapshot: {
    write(input: {
      source: string;
      resource: string;
      cacheKey: string;
      r2Path: string;
      contentHash: string;
      fingerprint: string;
      dateBucket: string;
      provenance: Provenance;
      ingestRunId?: number;
    }): Promise<SnapshotRef>;
  };
  log: { skip(spec: RequestSpec, reason: string): Promise<void> };
  /** Inyectable para tests deterministas. Default: () => new Date(). */
  now?: () => Date;
}

function dateBucket(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export abstract class BaseConnector<Raw> {
  protected abstract sourceId: string;
  /** Hook: endpoints concretos a pedir. */
  protected abstract endpoints(): RequestSpec[];
  /** Hook: shape-guard SUAVE (no zod estricto) — devuelve la forma cruda. */
  protected abstract validateShape(body: unknown): Raw;
  /** Hook: fingerprint estructural del crudo (para drift). */
  protected abstract fingerprint(raw: Raw): string | Promise<string>;

  constructor(protected readonly deps: ConnectorDeps) {}

  private nowDate(): Date {
    return (this.deps.now ?? (() => new Date()))();
  }

  /**
   * Flujo invariante. Por cada endpoint:
   * cache.hasToday(skip) -> robots(skip+log) -> rateLimiter.wait ->
   * fetcher.get -> validateShape -> fingerprint -> drift.check/alert(no bloquea)
   * -> sha256 -> r2.putImmutable -> snapshot.write(con provenance).
   */
  async run(_ctx: IngestRun): Promise<SnapshotRef[]> {
    const refs: SnapshotRef[] = [];
    const now = this.nowDate();

    for (const spec of this.endpoints()) {
      // Host DERIVADO de la URL real (WR-01): nunca se confia en spec.host,
      // para que el rate-limit/robots no puedan spoofearse contra el target.
      const host = new URL(spec.url).host;

      // 1. Cache diaria (FND-03): si ya hay snapshot de hoy, no re-pedir.
      if (await this.deps.cache.hasToday(this.sourceId, spec, now)) continue;

      // 2. robots.txt (FND-01): si no esta permitido, saltar con log.
      if (!(await this.deps.robots.isAllowed(spec.url))) {
        await this.deps.log.skip(spec, "robots-disallow");
        continue;
      }

      // 3a. Gate DURABLE por host (CR-02): la autoridad del 2-3s/host vive en
      //     Postgres y serializa entre invocaciones/isolates, no solo en proceso.
      if (this.deps.hostThrottle) {
        await this.deps.hostThrottle.reserve(host);
      }

      // 3b. Rate-limit serial por host EN PROCESO (FND-01) — fast-path dentro
      //     del batch. NUNCA opcional; host derivado de la URL (no spec.host).
      await this.deps.rateLimiter.wait(host);

      // 4. Fetch con UA identificatorio; 429/5xx => throw (backoff via cola).
      const body = await this.deps.fetcher.get(spec);

      // Captura de provenance al momento del fetch (FND-08).
      const provenance = makeProvenance(this.sourceId, spec.url);

      // 5. Shape-guard suave + fingerprint estructural.
      const raw = this.validateShape(this.decodeJson(body));
      const fp = await this.fingerprint(raw);

      // 6. Drift (FND-04): registra alerta si cambio, NO detiene la ingesta.
      const drift = await this.deps.drift.check(this.sourceId, spec.resource, fp);
      if (drift.changed) {
        await this.deps.drift.alert(this.sourceId, spec.resource, drift);
      }

      // 7. R2 content-addressed inmutable (FND-02).
      const sha = await sha256Hex(body);
      const date = dateBucket(now);
      const ext = spec.ext ?? "json";
      const { r2Path } = await this.deps.r2.putImmutable(
        this.sourceId,
        spec.resource,
        date,
        sha,
        ext,
        body,
      );

      // 8. Snapshot + provenance (FND-08). El crudo NUNCA entra a Postgres.
      const cacheKey = await this.deps.cache.dailyKey(this.sourceId, spec, now);
      const ref = await this.deps.snapshot.write({
        source: this.sourceId,
        resource: spec.resource,
        cacheKey,
        r2Path,
        contentHash: sha,
        fingerprint: fp,
        dateBucket: date,
        provenance,
      });
      refs.push(ref);
    }

    return refs;
  }

  /** Decodifica el crudo como JSON para los hooks de forma. Tolerante. */
  protected decodeJson(body: Uint8Array): unknown {
    const text = new TextDecoder().decode(body);
    try {
      return JSON.parse(text);
    } catch {
      // Shape-guard suave: si no es JSON, devolver el texto (XML/HTML crudo).
      return text;
    }
  }
}
