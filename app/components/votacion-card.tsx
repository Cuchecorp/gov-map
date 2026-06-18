import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { CamaraChip } from "@/components/camara-chip";
import { EtapaBadge } from "@/components/etapa-badge";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { VotacionBar } from "@/components/votacion-bar";
import { VotoDetalle } from "@/components/voto-detalle";
import { fechaCorta } from "@/lib/format";
import type { VotacionRow } from "@/lib/types";
import { sourceLabel } from "@/lib/types";

/**
 * VotacionCard — tarjeta de resultado de votación (UI-SPEC §3.3).
 * CamaraChip + fecha + etapa + quórum, VotacionBar CSS, totales en texto,
 * ResultadoBadge, ProvenanceBadge, y para el Senado el VotoDetalle expandible.
 */
export function VotacionCard({ votacion }: { votacion: VotacionRow }) {
  const fecha = votacion.fecha ? new Date(votacion.fecha) : null;
  const capturedAt = votacion.fecha_captura
    ? new Date(votacion.fecha_captura)
    : null;
  const esSenado = votacion.camara === "senado";

  return (
    <Card className="mb-6 last:mb-0">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CamaraChip camara={votacion.camara} />
          {fecha && (
            <span className="font-mono text-sm text-muted-foreground leading-none">
              {fechaCorta(fecha)}
            </span>
          )}
        </div>
        {votacion.etapa && (
          <p className="text-sm text-muted-foreground">Etapa: {votacion.etapa}</p>
        )}
        {votacion.quorum && (
          <p className="text-sm text-muted-foreground">
            Quórum: {votacion.quorum}
          </p>
        )}
      </CardHeader>

      <CardContent>
        <VotacionBar
          si={votacion.total_si}
          no={votacion.total_no}
          abstencion={votacion.total_abstencion}
          pareo={votacion.total_pareo}
        />

        <p className="text-sm text-muted-foreground mt-3">
          Sí: {votacion.total_si} · No: {votacion.total_no} · Abst.:{" "}
          {votacion.total_abstencion} · Pareo: {votacion.total_pareo}
        </p>

        {votacion.resultado && (
          <div className="mt-3">
            <span className="sr-only">Resultado: </span>
            <EtapaBadge estado={votacion.resultado} />
          </div>
        )}

        <div className="mt-4">
          <ProvenanceBadge
            capturedAt={capturedAt}
            sourceName={sourceLabel(votacion.origen)}
            sourceUrl={votacion.enlace || null}
          />
        </div>

        {esSenado && <VotoDetalle votos={votacion.voto ?? []} />}
      </CardContent>
    </Card>
  );
}
