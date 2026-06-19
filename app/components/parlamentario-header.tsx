import { CamaraChip } from "@/components/camara-chip";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { sourceLabel } from "@/lib/types";
import type { ParlamentarioPublicoRow } from "@/lib/types";

/**
 * ParlamentarioHeader — cabecera REUSABLE de la ficha del parlamentario
 * (UI-SPEC §3.1). Es el shell que las Phases 11–16 (INT/MONEY) reusan tal cual.
 *
 * CamaraChip (Cámara/Senado) + nombre (<h1>) + cargo (distrito/circunscripción
 * + región) + ProvenanceBadge obligatorio. SIN foto (la maestra no trae URL de
 * foto con fuente → nada, nunca una silueta placeholder que se lea como ficha
 * policial, §3.1).
 *
 * DECISIÓN LEGAL-03 (deny-by-default): el chip de bancada/partido de §3.1 queda
 * OMITIDO. `partido` es afiliación política (dato sensible Ley 21.719) y
 * `parlamentario` es deny-by-default — anon NUNCA lo lee, y el RPC
 * `parlamentario_publico` no lo emite a propósito. Mostrarlo violaría el piso de
 * PII; la cabecera se queda con cámara + nombre + cargo + provenance.
 */
export function ParlamentarioHeader({
  parlamentario,
}: {
  parlamentario: ParlamentarioPublicoRow;
}) {
  const capturedAt = parlamentario.fecha_captura
    ? new Date(parlamentario.fecha_captura)
    : null;

  // Cargo: distrito (Cámara) o circunscripción (Senado) + región, si están.
  const cargoPartes = [
    parlamentario.distrito ? `Distrito ${parlamentario.distrito}` : null,
    parlamentario.circunscripcion
      ? `Circunscripción ${parlamentario.circunscripcion}`
      : null,
    parlamentario.region,
  ].filter((p): p is string => Boolean(p));

  return (
    <header>
      <div className="flex flex-wrap gap-2">
        <CamaraChip camara={parlamentario.camara} />
      </div>

      <h1 className="text-3xl font-semibold leading-tight mt-4">
        {parlamentario.nombre}
      </h1>

      {cargoPartes.length > 0 && (
        <p className="text-sm font-normal text-muted-foreground mt-1">
          {cargoPartes.join(" · ")}
        </p>
      )}

      <div className="mt-4">
        <ProvenanceBadge
          capturedAt={capturedAt}
          sourceName={sourceLabel(parlamentario.origen)}
          sourceUrl={parlamentario.enlace ?? null}
        />
      </div>
    </header>
  );
}
