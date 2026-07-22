/**
 * validacion-fuente.tsx — Sección "Valida este dato en la fuente"
 *
 * TRACE-01: deep-links fail-honest (Senado SIEMPRE, Cámara condicional, BCN omitido)
 * TRACE-02: URLs reproducibles para validación empírica por curl
 * TRACE-03: fecha de captura visible + respaldo R2 (fecha + hash, SIN descarga)
 *
 * Security:
 *   T-89-06: allowlist prefijo "tramitacion/*" para respaldo R2; jamás exponer r2_path como href
 *   T-89-07: hosts fijos + encodeURIComponent; sin URL libre del usuario
 *   T-89-08: safeExternalHref en todo href externo
 *   T-89-09: source_snapshot no es PII_TABLE — read directo permitido bajo Camino A
 */

import { safeExternalHref } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface SourceSnapshotRecord {
  content_hash: string;
  fetched_at: string;
  r2_path: string;
}

export interface ValidacionFuenteProps {
  /** Boletín completo con sufijo (e.g. "14309-04"). SIEMPRE disponible. */
  boletin: string;
  /** ID de tramitación en la Cámara; null → fila Cámara omitida (fail-honest). */
  prm_id_camara: string | null;
  /** ISO string de fecha_captura del proyecto. */
  fecha_captura: string;
  /** Registro de source_snapshot (o null). Sólo se muestra si r2_path empieza con "tramitacion/". */
  snapshot: SourceSnapshotRecord | null;
}

// ── Helper: allowlist de prefijo R2 (T-89-06) ────────────────────────────────

/**
 * Devuelve true SOLO si el r2_path empieza con "tramitacion/" (allowlist).
 * Protege contra exponer keys de dominios PII (infoprobidad/, servel/, money/, rut/).
 */
export function esR2PathPermitido(r2_path: string): boolean {
  return r2_path.startsWith("tramitacion/");
}

// ── Construcción de URLs (T-89-07) ───────────────────────────────────────────

/**
 * URL de tramitación del Senado. SIEMPRE construible con el boletín en mano.
 * Boletín COMPLETO con sufijo (sin sufijo → devuelve lista, no ficha).
 */
export function buildSenadoUrl(boletin: string): string {
  return `https://tramitacion.senado.cl/appsenado/templates/tramitacion/index.php?boletin_ini=${encodeURIComponent(boletin)}`;
}

/**
 * URL de tramitación de la Cámara. SOLO cuando prm_id_camara != null.
 */
export function buildCamaraUrl(boletin: string, prmId: string): string {
  return `https://www.camara.cl/legislacion/proyectosdeley/tramitacion.aspx?prmID=${encodeURIComponent(prmId)}&prmBOLETIN=${encodeURIComponent(boletin)}`;
}

// ── Componente principal ──────────────────────────────────────────────────────

/**
 * ValidacionFuenteSection — sección "Valida este dato en la fuente".
 *
 * Server component: recibe los datos ya resueltos por page.tsx.
 * Nunca hace fetch propio; page.tsx resuelve source_snapshot antes de pasar snapshot.
 */
export function ValidacionFuenteSection({
  boletin,
  prm_id_camara,
  fecha_captura,
  snapshot,
}: ValidacionFuenteProps) {
  // Construcción de URLs con hosts fijos + encodeURIComponent (T-89-07)
  const rawSenadoUrl = buildSenadoUrl(boletin);
  const rawCamaraUrl =
    prm_id_camara !== null ? buildCamaraUrl(boletin, prm_id_camara) : null;

  // Guard anti-XSS: solo http/https (T-89-08). Con hosts fijos esto nunca debería
  // fallar, pero el guard es obligatorio en TODO href externo (#9).
  const senadoUrl = safeExternalHref(rawSenadoUrl);
  const camaraUrl = rawCamaraUrl !== null ? safeExternalHref(rawCamaraUrl) : null;

  // Fecha de captura (para ProvenanceBadge-style inline)
  const fechaDisplay = formatFechaCaptura(fecha_captura);

  // Respaldo R2: solo cuando el prefijo está en la allowlist (T-89-06)
  const respaldo =
    snapshot !== null && esR2PathPermitido(snapshot.r2_path) ? snapshot : null;

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <h2 className="text-xl font-semibold">Valida este dato en la fuente</h2>

      {/* Fecha de captura */}
      <p className="text-xs text-muted-foreground">
        según fuente al{" "}
        <span className="font-mono">{fechaDisplay}</span>
      </p>

      {/* Links de fuente */}
      <ul className="space-y-3">
        {/* Senado — SIEMPRE (si la URL supera el guard) */}
        {senadoUrl !== null && (
          <li>
            <a
              href={senadoUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Ver en el Senado (abre en nueva pestaña)"
              className="inline-flex flex-col min-h-11 justify-center gap-0.5 text-[color:var(--accent-product)] underline underline-offset-2 hover:opacity-80 focus-visible:outline-[2px] focus-visible:outline-[color:var(--accent-product)]"
            >
              <span className="text-sm font-normal">Ver en el Senado ↗</span>
              <span className="text-xs text-muted-foreground no-underline">
                Ficha de tramitación oficial
              </span>
            </a>
          </li>
        )}

        {/* Cámara — SOLO si prm_id_camara != null (fail-honest) */}
        {camaraUrl !== null && (
          <li>
            <a
              href={camaraUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Ver en la Cámara (abre en nueva pestaña)"
              className="inline-flex flex-col min-h-11 justify-center gap-0.5 text-[color:var(--accent-product)] underline underline-offset-2 hover:opacity-80 focus-visible:outline-[2px] focus-visible:outline-[color:var(--accent-product)]"
            >
              <span className="text-sm font-normal">Ver en la Cámara ↗</span>
              <span className="text-xs text-muted-foreground no-underline">
                Ficha de tramitación oficial
              </span>
            </a>
          </li>
        )}

        {/* BCN: OMITIDO del DOM — sin idNorma no se muestra fila, ni placeholder.
            Fail-honest LOCKED: no hay link genérico de búsqueda BCN. */}
      </ul>

      {/* Respaldo R2 — solo si allowlist de prefijo pasa (T-89-06) */}
      {respaldo !== null && (
        <div className="pt-2 border-t border-border space-y-1">
          <p className="text-xs text-muted-foreground">
            Respaldo del{" "}
            <span className="font-mono">{formatFethedAt(respaldo.fetched_at)}</span>
            {" · "}
            hash{" "}
            <span className="font-mono">
              {respaldo.content_hash.slice(0, 12)}…
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Esto decía la fuente ese día.
          </p>
          {/* NUNCA un href con r2_path (T-89-06, precedente page.tsx:322-328) */}
        </div>
      )}
    </div>
  );
}

// ── Skeleton (shape-matched para Suspense fallback) ───────────────────────────

export function ValidacionFuenteSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4" aria-hidden="true">
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-3 w-48" />
      <div className="space-y-3">
        <Skeleton className="h-11 w-44 rounded" />
        <Skeleton className="h-11 w-44 rounded" />
      </div>
    </div>
  );
}

// ── Utilidades de formato (server-safe, sin date-fns) ────────────────────────

function formatFechaCaptura(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-CL", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "America/Santiago",
    });
  } catch {
    return iso;
  }
}

function formatFethedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-CL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "America/Santiago",
    });
  } catch {
    return iso;
  }
}
