// connector-senado — fetch del Senado (tramitacion.senado.cl/wspublico) REUSANDO @obs/ingest.
//
// Análogo a CamaraConnector: reusa la política LOCKED de @obs/ingest
//   assertAllowedUrl(url) → robots.isAllowed(url) → rateLimiter.wait(host) → fetcher.get({url})
// y NO `BaseConnector.run` (caché diaria saltaría re-corridas).
//
// El Senado se consulta con el boletín BASE SIN sufijo de comisión (Pitfall 1): `tramitacion.php`
// y `votaciones.php` esperan `18296`, no `18296-05`. El caller pasa el base.

import {
  Fetcher,
  HostRateLimiter,
  RobotsGuard,
  assertAllowedUrl,
  type AllowlistOptions,
} from "@obs/ingest";
import { RobotsDisallowError } from "./connector-camara";

/** Colaboradores inyectables (reuso de la política de @obs/ingest). */
export interface SenadoConnectorDeps {
  fetcher: Fetcher;
  rateLimiter: HostRateLimiter;
  robots: RobotsGuard;
  allowlist?: AllowlistOptions;
}

const BASE = "https://tramitacion.senado.cl/wspublico";

/**
 * Conector del Senado: fetchea la tramitación (`tramitacion.php`) y las votaciones nominales
 * (`votaciones.php`) por boletín BASE (sin sufijo). Reusa @obs/ingest en el ORDEN LOCKED.
 */
export class SenadoConnector {
  constructor(private readonly deps: SenadoConnectorDeps) {}

  private async fetch(url: string): Promise<string> {
    const parsed = assertAllowedUrl(url, this.deps.allowlist); // SSRF + allowlist (T-05-12)
    if (!(await this.deps.robots.isAllowed(url))) throw new RobotsDisallowError(url);
    await this.deps.rateLimiter.wait(parsed.host); // 2-3s serial por host (T-05-11)
    const body = await this.deps.fetcher.get({ url });
    return new TextDecoder().decode(body);
  }

  /** Fetch del XML de tramitación por boletín base (Pitfall 1: SIN sufijo). */
  async fetchTramitacion(boletinBase: string): Promise<string> {
    const url = `${BASE}/tramitacion.php?boletin=${encodeURIComponent(boletinBase)}`;
    return this.fetch(url);
  }

  /** Fetch del XML de votaciones nominales por boletín base (puede venir vacío — Pitfall 2). */
  async fetchVotaciones(boletinBase: string): Promise<string> {
    const url = `${BASE}/votaciones.php?boletin=${encodeURIComponent(boletinBase)}`;
    return this.fetch(url);
  }
}
