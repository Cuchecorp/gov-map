/**
 * Wrapper sobre robots-parser@3 (FND-01).
 *
 * Evalua robots.txt con el User-Agent identificatorio LOCKED y cachea el
 * archivo por host (un fetch por host, no por URL). Politica de ingesta
 * respetuosa centralizada: el framework decide si una URL puede pedirse.
 */
import robotsParser from "robots-parser";

/** User-Agent identificatorio LOCKED (PROJECT.md / RESEARCH). */
export const IDENTIFIED_UA =
  "Bot-Ciudadano/1.0 (consulta ciudadana Chile; contacto@dominio.cl)";

/** Interfaz minima que devuelve robots-parser. */
interface ParsedRobots {
  isAllowed(url: string, ua?: string): boolean | undefined;
}

export interface RobotsGuardOptions {
  /** fetch inyectable para tests sin red. Default: fetch global. */
  fetchFn?: typeof fetch;
  /** UA con el que se evalua robots.txt. Default: IDENTIFIED_UA. */
  ua?: string;
}

export class RobotsGuard {
  private readonly fetchFn: typeof fetch;
  private readonly ua: string;
  /** Cache de parsers por host (origin). */
  private readonly cache = new Map<string, Promise<ParsedRobots>>();

  constructor(opts: RobotsGuardOptions = {}) {
    this.fetchFn = opts.fetchFn ?? fetch;
    this.ua = opts.ua ?? IDENTIFIED_UA;
  }

  /**
   * Devuelve true si la URL puede pedirse segun robots.txt del host.
   * Fail-open: si robots.txt no existe (404) o falla, se permite por defecto.
   */
  async isAllowed(url: string): Promise<boolean> {
    const origin = new URL(url).origin;
    const parser = await this.parserFor(origin);
    // robots-parser devuelve undefined si no hay regla aplicable => permitido.
    return parser.isAllowed(url, this.ua) !== false;
  }

  private parserFor(origin: string): Promise<ParsedRobots> {
    let cached = this.cache.get(origin);
    if (!cached) {
      cached = this.loadRobots(origin);
      this.cache.set(origin, cached);
    }
    return cached;
  }

  private async loadRobots(origin: string): Promise<ParsedRobots> {
    const robotsUrl = `${origin}/robots.txt`;
    try {
      const res = await this.fetchFn(robotsUrl, {
        headers: { "User-Agent": this.ua },
      });
      if (!res.ok) {
        // Sin robots.txt accesible => permitir todo (fail-open).
        return robotsParser(robotsUrl, "");
      }
      const body = await res.text();
      return robotsParser(robotsUrl, body);
    } catch {
      return robotsParser(robotsUrl, "");
    }
  }
}
