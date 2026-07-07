import Link from "next/link";

import { CamaraChip } from "@/components/camara-chip";
import { formatNombre } from "@/lib/format";
import type { ParlamentarioListadoRow } from "@/lib/types";

/**
 * ParlamentarioDirectoryRow — fila del directorio /parlamentarios (SC2).
 * Server Component presentacional. Espeja la composición de cargo de
 * `ParlamentarioHeader` (distrito/circunscripción/región) + `CamaraChip`,
 * envuelto en un `<Link href="/parlamentario/{id}">` para enlazar a la ficha.
 *
 * Consume `ParlamentarioListadoRow` (las 7 columnas seguras del RPC
 * `parlamentarios_publico`), NO `ParlamentarioPublicoRow`. SIN foto, SIN partido
 * (LEGAL-03): el tipo no trae `partido`/`rut`/`email` ni URL de foto, así que la
 * fila no puede renderizarlos ni por accidente. El enlace usa el id D####/S####.
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
      className="block rounded-lg border border-border bg-card px-4 py-3 hover:border-foreground/20 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex flex-wrap items-center gap-2">
        <CamaraChip camara={p.camara} />
        <span className="text-base font-semibold">{formatNombre(p.nombre)}</span>
      </div>
      {cargoPartes.length > 0 && (
        <p className="mt-1 text-sm font-normal text-muted-foreground">
          {cargoPartes.join(" · ")}
        </p>
      )}
    </Link>
  );
}
