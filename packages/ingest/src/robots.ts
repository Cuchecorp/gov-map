/**
 * Wrapper sobre robots-parser@3 (FND-01).
 *
 * Evalua robots.txt con el User-Agent identificatorio LOCKED y cachea el
 * archivo por host (un fetch por host, no por URL). Politica de ingesta
 * respetuosa centralizada: el framework decide si una URL puede pedirse.
 */
import robotsParser from "robots-parser";
import { type AllowlistOptions, assertAllowedUrl } from "./allowlist";

/** User-Agent identificatorio LOCKED (PROJECT.md / RESEARCH). */
export const IDENTIFIED_UA =
  "Bot-Ciudadano/1.0 (consulta ciudadana Chile; contacto@dominio.cl)";

/** Interfaz minima que devuelve robots-parser. */
interface ParsedRobots {
  isAllowed(url: string, ua?: string): boolean | undefined;
}

/**
 * Sentinela: la carga de robots.txt fallo por error de RED (no 404). El caller
 * hace fail-closed (skip) en vez de asumir allow-all (WR-03).
 */
const NETWORK_ERROR = Symbol("robots-network-error");
/**
 * Sentinela: el origin del fetch de robots.txt no pasa el allowlist (host interno
 * o no-allowlisted). Deny PERMANENTE (cacheable) — la URL real también será
 * rechazada por el fetcher; aquí se evita siquiera emitir el GET (#1).
 */
const HOST_BLOCKED = Symbol("robots-host-blocked");
type RobotsResult = ParsedRobots | typeof NETWORK_ERROR | typeof HOST_BLOCKED;

export interface RobotsGuardOptions {
  /** fetch inyectable para tests sin red. Default: fetch global. */
  fetchFn?: typeof fetch;
  /** UA con el que se evalua robots.txt. Default: IDENTIFIED_UA. */
  ua?: string;
  /**
   * Allowlist para gatear el fetch de robots.txt (#1, code-review v1.0). Cuando
   * se provee, el GET a `${origin}/robots.txt` pasa por `assertAllowedUrl` ANTES
   * de emitirse: un origin interno (loopback, 169.254.169.254, RFC1918) o no
   * gubernamental se rechaza sin tocar la red, cerrando la grieta SSRF previa al
   * gate principal del fetcher (que corre recién en el paso 4). Si se omite, no
   * se gatea — comportamiento histórico usado por tests con hosts ficticios.
   */
  allowlist?: AllowlistOptions;
}

export class RobotsGuard {
  private readonly fetchFn: typeof fetch;
  private readonly ua: string;
  private readonly allowlist?: AllowlistOptions;
  /** Cache de parsers por host (origin). */
  private readonly cache = new Map<string, Promise<RobotsResult>>();

  constructor(opts: RobotsGuardOptions = {}) {
    this.fetchFn = opts.fetchFn ?? fetch;
    this.ua = opts.ua ?? IDENTIFIED_UA;
    this.allowlist = opts.allowlist;
  }

  /**
   * Devuelve true si la URL puede pedirse segun robots.txt del host.
   *
   * WR-03:
   *   - URL malformada => false (skip controlado, no un throw generico).
   *   - robots.txt ausente (404/empty) => fail-OPEN (permitir): es el caso
   *     legitimo de "el host no publica robots".
   *   - error de RED al traer robots.txt (DNS/timeout) => fail-CLOSED (skip):
   *     no asumimos "permite todo" para una request que justo fallo; se difiere.
   */
  async isAllowed(url: string): Promise<boolean> {
    let origin: string;
    try {
      origin = new URL(url).origin;
    } catch {
      // URL malformada: skip controlado, no propagar un error generico.
      return false;
    }
    const parser = await this.parserFor(origin);
    if (parser === NETWORK_ERROR || parser === HOST_BLOCKED) {
      // Fail-closed: error de red al cargar robots.txt, u origin bloqueado por
      // el allowlist (#1). En ambos casos no se permite la URL.
      return false;
    }
    // robots-parser devuelve undefined si no hay regla aplicable => permitido.
    return parser.isAllowed(url, this.ua) !== false;
  }

  private parserFor(origin: string): Promise<RobotsResult> {
    let cached = this.cache.get(origin);
    if (!cached) {
      cached = this.loadRobots(origin);
      this.cache.set(origin, cached);
    }
    return cached;
  }

  private async loadRobots(origin: string): Promise<RobotsResult> {
    const robotsUrl = `${origin}/robots.txt`;
    // #1: gatea el fetch de robots.txt contra el allowlist ANTES de tocar la red.
    // Un origin interno/no-allowlisted se rechaza aquí, sin emitir el GET (la
    // grieta SSRF que existía porque base-connector evalúa robots ANTES del
    // assertAllowedUrl del fetcher). Solo aplica si se configuró un allowlist.
    if (this.allowlist !== undefined) {
      try {
        assertAllowedUrl(robotsUrl, this.allowlist);
      } catch {
        return HOST_BLOCKED;
      }
    }
    let res: Response;
    try {
      res = await this.fetchFn(robotsUrl, {
        headers: { "User-Agent": this.ua },
      });
    } catch {
      // Error de RED (DNS/timeout/conn refused): NO asumir allow-all. Devolver
      // el sentinela para que isAllowed haga fail-closed (skip) — WR-03. No se
      // cachea un resultado de red transitorio (se descarta abajo).
      this.cache.delete(origin);
      return NETWORK_ERROR;
    }
    if (!res.ok) {
      // Sin robots.txt accesible (404/410/etc.): permitir todo (fail-open).
      // Es el caso legitimo de "el host no publica robots".
      return robotsParser(robotsUrl, "");
    }
    const body = await res.text();
    return robotsParser(robotsUrl, body);
  }
}
