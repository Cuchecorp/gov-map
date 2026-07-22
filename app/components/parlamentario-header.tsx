import { Breadcrumbs } from "@/components/breadcrumbs";
import { CamaraChip } from "@/components/camara-chip";
import { PartidoChip } from "@/components/partido-chip";
import { ComisionesDeParlamentario } from "@/components/comisiones-de-parlamentario";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { formatNombre } from "@/lib/format";
import { sourceLabel } from "@/lib/types";
import type { ComisionRow, ParlamentarioPublicoRow } from "@/lib/types";

/**
 * ParlamentarioHeader — cabecera REUSABLE de la ficha del parlamentario
 * (UI-SPEC §3.1). Es el shell que las Phases 11–16 (INT/MONEY) reusan tal cual.
 *
 * CamaraChip + PartidoChip (fila de chips) + nombre (<h1>) + cargo
 * (distrito/circunscripción + región) + bloque de comisiones + ProvenanceBadge
 * obligatorio. SIN foto (la maestra no trae URL de foto con fuente → nada, nunca
 * una silueta placeholder que se lea como ficha policial, §3.1). SIN profesión
 * (bio 0 filas → el campo se OMITE, nunca "sin profesión").
 *
 * REVERSIÓN LEGAL-03 (decisión OPERADOR 2026-07-21, 91-CONTEXT / PROJECT.md):
 * el partido del CARGO ELECTO se muestra como dato PÚBLICO esencial de
 * accountability. La retención previa (0020: `parlamentario_publico` no emitía
 * partido) se revierte en 0060 vía `parlamentario_publico_v2`, que deriva el
 * partido de la MILITANCIA VIGENTE con su propia `fecha_captura`/`origen` para el
 * rótulo "según fuente al [fecha]". El PartidoChip es NEUTRO — el color jamás
 * codifica bloque/afinidad (anti-insinuación) — y se OMITE si no hay partido.
 * Nunca RUT/email/terceros: el piso de PII de minimización PLENA se conserva.
 */
export function ParlamentarioHeader({
  parlamentario,
  comisiones = [],
}: {
  parlamentario: ParlamentarioPublicoRow;
  /** Comisiones de la bio oficial (BIO-02). Vacío → leyenda empty honesta. */
  comisiones?: ComisionRow[];
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
      {/* Fila de chips: cámara PRIMERO, partido DESPUÉS (UI-SPEC §Component 1).
          El PartidoChip se OMITE (null) si no hay partido; el subtexto
          "según fuente al [fecha]" vive en su tooltip (no inline, para no
          romper el wrap en móvil). `partido_origen` cae a `origen` de cabecera
          si el RPC no trae origen de militancia. */}
      <div className="flex flex-wrap gap-2">
        <CamaraChip camara={parlamentario.camara} />
        <PartidoChip
          partido={parlamentario.partido}
          fechaCaptura={parlamentario.partido_fecha_captura}
          origen={parlamentario.partido_origen ?? parlamentario.origen}
        />
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

      {/* Comisiones de la bio oficial (BIO-02): bloque bajo el cargo, ANTES del
          ProvenanceBadge. Vacío → leyenda empty honesta (el propio componente). */}
      <div className="mt-4">
        <ComisionesDeParlamentario comisiones={comisiones} />
      </div>

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
