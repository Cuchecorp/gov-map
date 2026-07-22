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
import { enlaceHumanoProyecto } from "@/components/validacion-fuente";
import { fechaCorta, conteoVotacion } from "@/lib/format";
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
  // WR-05: el voto-a-voto se renderiza para AMBAS cámaras. El de la Cámara es el vínculo de
  // identidad MÁS fuerte (determinista por DIPID, confirmado) y se persiste en `voto`; ocultarlo
  // desperdiciaba la escritura y privaba al ciudadano del roll-call. La guarda de identidad de
  // VotoRow es la misma para ambas (solo 'confirmado' enlaza), así que es seguro mostrarlo.
  const tieneDesglose = (votacion.voto?.length ?? 0) > 0;

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

        {votacion.resultado ? (
          <div className="mt-3 space-y-2">
            {/* DESENLACE factual (Phase 22, SC6): resultado + conteo como HECHO de la
                votación — espejo de VotoFichaRow en la ficha del parlamentario. Sin
                adjetivo de juicio ni causalidad (DESIGN-SYSTEM §6/§8). El conteo reusa
                conteoVotacion (en-dash) de format.ts, renderizado en Mono. */}
            <p className="text-sm text-muted-foreground">
              El proyecto fue {votacion.resultado}{" "}
              <span className="font-mono">
                {conteoVotacion(votacion.total_si, votacion.total_no)}
              </span>
            </p>
            <div>
              <span className="sr-only">Resultado: </span>
              <EtapaBadge estado={votacion.resultado} />
            </div>
          </div>
        ) : (
          /* B14 (revierte omisión Phase 22): la ausencia de desenlace es un HECHO
             honesto, no un silencio. Da paridad con la ficha del parlamentario y
             evita que una votación sin resultado se lea como incompleta sin decirlo.
             La barra y los totales (arriba) quedan intactos. Copy sobrio §6/§9.1,
             sin causalidad ni juicio. */
          <p className="mt-3 text-sm text-muted-foreground">
            Desenlace no informado por la fuente.
          </p>
        )}

        <div className="mt-4">
          <ProvenanceBadge
            capturedAt={capturedAt}
            sourceName={sourceLabel(votacion.origen)}
            // El `votacion.enlace` de PROD suele ser el WS XML (wspublico), roto
            // para humanos; se reruta a la ficha humana del Senado por boletín
            // (mismo helper que header/Similares — deep-links humanos).
            sourceUrl={
              enlaceHumanoProyecto(votacion.enlace || "", votacion.boletin) ||
              null
            }
          />
        </div>

        {tieneDesglose && <VotoDetalle votos={votacion.voto ?? []} />}
      </CardContent>
    </Card>
  );
}
