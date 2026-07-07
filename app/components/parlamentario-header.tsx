import { Breadcrumbs } from "@/components/breadcrumbs";
import { CamaraChip } from "@/components/camara-chip";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { formatNombre } from "@/lib/format";
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
  // TODAS son columnas públicas de `ParlamentarioPublicoRow` — NUNCA partido/
  // afiliación (LEGAL-03, ver docstring). El `periodo` (0020) se añade aparte
  // porque va en Mono (UI-SPEC: fechas/IDs en Geist Mono); si es null se OMITE
  // la etiqueta entera (honesto, sin "Período " suelto).
  const cargoPartes = [
    parlamentario.distrito ? `Distrito ${parlamentario.distrito}` : null,
    parlamentario.circunscripcion
      ? `Circunscripción ${parlamentario.circunscripcion}`
      : null,
    parlamentario.region,
  ].filter((p): p is string => Boolean(p));

  const periodo = parlamentario.periodo;

  // Display-only (F54 Contract 1): mismo string formateado en breadcrumb y h1.
  // El dato crudo `parlamentario.nombre` sigue intacto como clave/param/href.
  const nombreDisplay = formatNombre(parlamentario.nombre);

  return (
    <header>
      {/*
        53-03 (UX-01, 53-UI-SPEC §(b)) — Breadcrumb ligero, PRIMER elemento del
        header (sobre el h1). El nombre viene de `parlamentario.nombre` (columna
        pública del RPC `parlamentario_publico`, ya deduplicado con React.cache F52)
        → cero RPC extra (53-RESEARCH Open Question 2). As-shipped: NO se aplica
        Title Case (eso es F54). Es un <nav>, no re-nivela el h1 ni mueve mt-12;
        renderiza sólo labels de ruta + el nombre público ya visible en el h1 (sin
        PII/partido/foto — LEGAL-03 intacto).
      */}
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Parlamentarios", href: "/parlamentarios" },
          { label: nombreDisplay },
        ]}
      />
      <div className="flex flex-wrap gap-2">
        <CamaraChip camara={parlamentario.camara} />
      </div>

      <h1 className="text-3xl font-semibold leading-tight mt-4">
        {nombreDisplay}
      </h1>

      {(cargoPartes.length > 0 || periodo) && (
        <p className="text-sm font-normal text-muted-foreground mt-1">
          {cargoPartes.join(" · ")}
          {periodo && (
            <>
              {cargoPartes.length > 0 && " · "}
              Período <span className="font-mono">{periodo}</span>
            </>
          )}
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
