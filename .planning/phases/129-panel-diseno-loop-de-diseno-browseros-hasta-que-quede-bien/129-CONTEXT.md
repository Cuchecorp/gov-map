# Phase 129: PANEL-DISEÑO — Loop BrowserOS hasta que quede bien - Context

**Gathered:** 2026-07-30 (auto — decisiones operacionales; el checkpoint de operador es el
VEREDICTO de cierre del loop, no esta discusión)
**Status:** Ready for planning/execution

<domain>
## Phase Boundary
Loop deploy→captura BrowserOS→crítica Opus→corrección hasta veredicto de cierre; cada criterio
visual con fragmento DOM + captura contra baseline `spikes/assets/v13-baseline-*.png`; densidad
390px (O-7=4); cierra B-02 (muerte del tile materia en el DOM del deploy) y H-01 (/comparar sin
error boundary post-hidratación). Requirements: PANEL-09.
</domain>

<decisions>
- **D-01 Deploy** (gotchas LOCKED): build OpenNext en Docker `node:22-slim`; robocopy a
  `C:/Temp/obs-build` purgando `.pnpm-store` y re-escribiendo helper scripts tras `/MIR`; wrangler
  global de AppData (el del PATH está sombreado por un paquete Python); `MSYS_NO_PATHCONV=1`;
  500s en ventana de propagación 10-30 s NO son fallo. Sitio: observatorio-congreso.thevalis.workers.dev.
- **D-02 Instrumento BrowserOS** (gotchas pagados): `save_screenshot` con path ABSOLUTO (resuelve
  contra el cwd de BrowserOS); sleep 8-10 s entre screenshots; `CDP request timeout` con exit 0 ⇒
  verificar que la captura EXISTE y pesa >0; scroll vía `evaluate_script` (el tool scroll puede no
  mover); fragmentos DOM por `textContent` JAMÁS `innerText`; HTML del Worker 1 línea ⇒
  `grep -o | wc -l`; conteos "2" = HTML + payload RSC (no duplicación); patrón `.` no matchea `ó`
  multibyte.
- **D-03 Loop**: capturas de `/` (desktop + 390px vía iframe same-origin, precedente v8.0) +
  crítica de agente Opus contra baseline + correcciones commiteadas + re-deploy si hace falta;
  máximo 3 iteraciones antes de presentar al operador lo que haya.
- **D-04 B-02**: DOM del deploy sin "(sin materia)" y sin tombstone (grep -o == 0 apareado con
  control positivo de tiles presentes).
- **D-05 H-01**: /comparar re-verificado tras el deploy — sin error boundary transitorio
  post-hidratación; si reaparece, causa raíz con evidencia (jamás "no reproducible" a secas).
- **D-06 Cosmético pendiente de 128**: concordancia de plural "1 citaciones del Senado" — fix en
  el loop.
- **D-07 CHECKPOINT OPERADOR**: veredicto "queda bien" VERBATIM sobre capturas del deploy real —
  ausencia = handoff documentado, jamás PASS.
</decisions>

<canonical_refs>
- `.planning/ROADMAP.md` §Phase 129 (4 SC) · REQUIREMENTS PANEL-09
- `.planning/spikes/assets/v13-baseline-landing.png`, `v13-baseline-panel-mid.png`, `v13-baseline-panel.png`
- `128-VERIFICATION.md` (estado entrante: panel correcto por tests; juicio visual diferido aquí)
- Memoria deploy: `frontend-deploy-cloudflare`, gotchas v10/v12
</canonical_refs>
