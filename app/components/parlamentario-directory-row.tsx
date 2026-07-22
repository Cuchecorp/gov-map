import Link from "next/link";

import { CamaraChip } from "@/components/camara-chip";
import { PartidoChip } from "@/components/partido-chip";
import { formatNombre } from "@/lib/format";
import type { ParlamentarioListadoRow } from "@/lib/types";

/**
 * ParlamentarioDirectoryRow — fila del directorio /parlamentarios (SC2).
 * Server Component presentacional. Espeja la composición de cargo de
 * `ParlamentarioHeader` (distrito/circunscripción/región) + `CamaraChip`,
 * envuelto en un `<Link href="/parlamentario/{id}">` para enlazar a la ficha.
 *
 * Consume `ParlamentarioListadoRow` (RPC `parlamentarios_publico_v2`, super-set de
 * 0060). BIO-03: REVIERTE la omisión LEGAL-03 del partido (decisión operador
 * 2026-07-21) — la fila muestra el PartidoChip NEUTRO (partido/fecha/origen de la
 * militancia vigente, omitido honestamente si null). El row-type NO trae `rut`/
 * `email` ni URL de foto, así que la fila no puede renderizarlos ni por accidente.
 * El enlace usa el id D####/S####. Sin foto.
 *
 * WR-04: la fila ENTERA es un `<Link>` (anchor). El PartidoChip usa `tooltip={false}`
 * → Badge PLANO (procedencia en title/aria-label), NUNCA un TooltipTrigger Radix
 * interactivo anidado dentro del anchor (focus-stop inválido + click en conflicto).
 */
export function ParlamentarioDirectoryRow({
  parlamentario: p,
}: {
  parlamentario: ParlamentarioListadoRow;
}) {
  // Cargo: distrito (Cámara) o circunscripción (Senado) + región, si están.
  // region/distrito/circunscripcion son NULLABLE (Pitfall 5) → se omiten si faltan.
  const cargoPartes = [
    p.distrito ? `Distrito ${p.distrito}` : null,
    p.circunscripcion ? `Circunscripción ${p.circunscripcion}` : null,
    p.region,
  ].filter((part): part is string => Boolean(part));

  return (
    <Link
      href={`/parlamentario/${p.id}`}
      className="block rounded-[var(--radius-tile)] border border-border bg-card px-4 py-3 hover:border-foreground/20 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex flex-wrap items-center gap-2">
        <CamaraChip camara={p.camara} />
        <span className="text-base font-semibold">{formatNombre(p.nombre)}</span>
        <PartidoChip
          partido={p.partido}
          fechaCaptura={p.partido_fecha_captura}
          origen={p.partido_origen}
          tooltip={false}
        />
      </div>
      {cargoPartes.length > 0 && (
        <p className="mt-1 text-sm font-normal text-muted-foreground">
          {cargoPartes.join(" · ")}
        </p>
      )}
    </Link>
  );
}
