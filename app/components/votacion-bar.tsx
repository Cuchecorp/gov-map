/**
 * VotacionBar — barra horizontal SI/NO/Abstención/Pareo (UI-SPEC §3.3).
 * CSS puro (NO Recharts/visx). 4 segmentos con aria-label por segmento; NUNCA
 * transmite información solo por color (los totales se repiten en texto en la
 * VotacionCard). Total 0 → barra muted "Sin datos de votación".
 */
export interface VotacionBarProps {
  si: number;
  no: number;
  abstencion: number;
  pareo: number;
}

export function VotacionBar({ si, no, abstencion, pareo }: VotacionBarProps) {
  const total = si + no + abstencion + pareo;

  if (total === 0) {
    return (
      <div className="flex h-4 rounded-full overflow-hidden w-full bg-muted items-center justify-center">
        <span className="text-sm text-muted-foreground">
          Sin datos de votación
        </span>
      </div>
    );
  }

  const pct = (n: number) => (n / total) * 100;

  const segments = [
    { n: si, className: "bg-green-500", label: `Sí: ${si}` },
    { n: no, className: "bg-red-500", label: `No: ${no}` },
    { n: abstencion, className: "bg-amber-400", label: `Abstención: ${abstencion}` },
    { n: pareo, className: "bg-slate-400", label: `Pareo: ${pareo}` },
  ];

  return (
    <div
      className="flex h-4 rounded-full overflow-hidden w-full"
      role="img"
      aria-label={`Resultado de votación — Sí: ${si}, No: ${no}, Abstención: ${abstencion}, Pareo: ${pareo}`}
    >
      {segments.map((seg) =>
        seg.n > 0 ? (
          <div
            key={seg.label}
            style={{ width: `${pct(seg.n)}%` }}
            className={seg.className}
            aria-label={seg.label}
          />
        ) : null
      )}
    </div>
  );
}
