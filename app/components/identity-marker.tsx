/**
 * IdentityMarker — marca inline "identidad no verificada" (UI-SPEC §5).
 *
 * Guarda de identidad en la capa pública (TRAM-06, riesgo existencial #1):
 * cuando un voto del Senado lista un nombre que NO pudo asociarse de forma
 * confirmada a un parlamentario del registro, el nombre se muestra crudo
 * acompañado de esta marca — NUNCA como enlace a una ficha.
 *
 * El texto es SIEMPRE "identidad no verificada" — nunca "dudoso", "posible"
 * o cualquier matiz que insinúe una inferencia (UI-SPEC §9.3 regla 4).
 */
export function IdentityMarker() {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 ml-1 rounded
                 bg-identity-warn-bg text-identity-warn-fg
                 border border-identity-warn-border
                 text-sm font-normal"
      title="El nombre en la fuente no pudo asociarse de forma confirmada a un parlamentario del registro. Se muestra tal como aparece en la fuente oficial."
      aria-label="identidad no verificada"
    >
      identidad no verificada
      <span aria-hidden="true">⚠</span>
    </span>
  );
}
