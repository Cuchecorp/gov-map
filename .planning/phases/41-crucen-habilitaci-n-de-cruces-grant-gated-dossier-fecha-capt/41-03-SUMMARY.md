---
phase: 41-crucen-habilitaci-n-de-cruces-grant-gated-dossier-fecha-capt
plan: 03
subsystem: legal
tags: [legal-dossier, ley-21719, cruces, lobby, signoff, gated, deny-by-default]

# Dependency graph
requires:
  - phase: 36
    provides: "cruce_senal (0039) + RPC cruces_de_parlamentario (0040) — la superficie que el dossier describe"
  - phase: 37
    provides: "app/lib/cruces-gate.ts (crucesPublicEnabled, Candado B) + CrucesSection/CrucesView (framing §9.1)"
  - phase: 41
    provides: "0041 (fecha_captura en el RPC) + 0042 (grant gated, no aplicado) — referenciadas en §4/§8 del dossier"
provides:
  - "docs/legal/41-LEGAL-DOSSIER-CRUCES.md — dossier canonico de cruces, signoff: pending, jamas firmado"
  - "twin byte-identico en el phase-dir (41-LEGAL-DOSSIER.md) listo para que el humano firme AMBOS"
  - "estructuracion de la superficie de riesgo de las señales de cruce (agregacion intra-bloque lobby->sector) para asesoria legal"
affects: [Phase 39 (firma humana del dossier), operador (apply 0042 + flip crucesPublicEnabled post-firma)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dossier legal como material de PREPARACION (no dictamen), nacido signoff: pending; firma = accion humana exclusiva (espejo F13/F17)"
    - "Twin byte-identico (docs/legal + phase-dir) verificado por cmp/sha256; el twin dropea el sufijo de bloque"
    - "grep-hygiene: la nota NO embebe la subcadena literal 'signoff: approved' (un gate-check la greaa)"

key-files:
  created:
    - "docs/legal/41-LEGAL-DOSSIER-CRUCES.md"
    - ".planning/phases/41-crucen-habilitaci-n-de-cruces-grant-gated-dossier-fecha-capt/41-LEGAL-DOSSIER.md"
  modified: []

key-decisions:
  - "Numeracion del dossier = la Phase del GATE LEGAL que lo PRODUCE (41), no la de la capability (36/37) — espejo F13->Phase13, F17->Phase17 (correccion del validador sobre el draft Sonnet-3 que proponia 36)"
  - "CRUCES-especifico, NO copia de NET: §1 composicion intra-bloque lobby-pura (lobby_sector); §2 nuclear = agregacion por sector se lee como afinidad/captura (sin aristas/caminos); §3 SIN partido/SIN sentido-de-voto (el RPC no los emite); §6 fuente unica lobby (NO CC BY 4.0)"
  - "nota reworded para NO contener la subcadena literal 'signoff: approved' (grep-hygiene del gate-check); estado verificable vive en el campo YAML signoff: pending"
  - "Marco temporal Ley 21.719 reusado POR REFERENCIA al 13-MONEY (no re-litigado)"

patterns-established:
  - "Dossier de cruces nace signoff: pending; §9 checklist sin marcar; asesor/fecha/observaciones vacios — un agente NUNCA firma (gate 3 LOCKED)"
  - "Encender crucesPublicEnabled = los 3 pasos juntos post-firma: firmar dossier (humano, Phase 39) -> aplicar 0042 (operador) -> flip CRUCES_PUBLIC_ENABLED (operador)"

requirements-completed: [CRUCEN-03]

# Metrics
duration: ~12min
completed: 2026-06-24
---

# Phase 41 Plan 03: CRUCEN-03 — Dossier legal de cruces (signoff pending) Summary

**Dossier legal CRUCES-especifico (agregacion intra-bloque lobby->sector) escrito ×2 byte-identicos, nacido `signoff: pending` y jamas firmado: estructura la superficie de riesgo de las señales de cruce para que un abogado la revise, complete y firme (Phase 39, accion humana).**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-24T19:24:45Z
- **Completed:** 2026-06-24T19:37:00Z
- **Tasks:** 2/2
- **Files modified:** 2 (creados)

## Accomplishments

### Task 1 — Dossier canonico CRUCES-especifico (commit `d6ac182`)

`docs/legal/41-LEGAL-DOSSIER-CRUCES.md` escrito como espejo ESTRUCTURAL de `17-LEGAL-DOSSIER-NET.md` (front-matter YAML + §0 proposito/descargo + §1 superficie + §2 riesgo nuclear + §3 datos sensibles + §4 minimizacion/doble candado + §5 proposito + §6 atribucion + §7 base de licitud + §8 gate + §9 checklist + Anexo de supuestos), pero con contenido CRUCES-especifico (NO copia de NET):

- **Front-matter VERBATIM** de 41-RESEARCH §CRUCEN-03 (lineas 299-310): `documento: 41-LEGAL-DOSSIER-CRUCES`, `alcance: CRUCES (señales parlamentario↔sector)`, `signoff: pending`, `asesor: ""`, `fecha_signoff: ""`, `observaciones: ""`, `depende_de` (Phase 39 + CRUCEN-03), `nota` reworded SIN la subcadena literal `signoff: approved`.
- **§1** = composicion INTRA-bloque: señal LOBBY-PURA `tipo_senal='lobby_sector'` (la variante `lobby_sector_aporte` reservada a Phase 40, OFF); explicitamente NO el tri-bloque VOTE/INT/MONEY de NET; las señales de voto arrancan OFF.
- **§2 nuclear** = la AGREGACION por sector se lee como insinuacion de afinidad/captura/conflicto. CRUCES NO tiene aristas/caminos/relaciones de dos nodos (distinto de NET). Enumera las garantias de framing YA implementadas (conteo neutro unico, sin verbo causal/score/afinidad/ranking, carril aislado §9.1, contraparte cruda + IdentityMarker, provenance por evidencia FND-08).
- **§3** = contrapartes terceras de lobby (nombre crudo + IdentityMarker). SIN `partido`, SIN sentido-de-voto — el RPC `0040`/`0041` no los emite; un §3 copiado de NET inventaria atributos inexistentes.
- **§4** = minimizacion + doble candado en tabla: Candado A parte1 = RLS deny sobre `cruce_senal` (`0039`); parte2 = RPC sin grant (`0040`/`0041`) + grant gated `0042_cruces_grant_anon.sql` (NO aplicado). Candado B = `crucesPublicEnabled` default OFF (`cruces-gate.ts`).
- **§6** = fuente UNICA = lobby (`leylobby.gob.cl` / `camara.cl`), NO CC BY 4.0 (InfoProbidad, la unica CC BY 4.0, no esta en esta superficie); la tabla de 5 filas de NET colapsada a una.
- **§7** = interes legitimo + factor adicional = agregacion por sector; cada afirmacion difiere ("no se concluye" / "A confirmar por el asesor" / "PENDIENTE DE VALIDACION LEGAL"); cierra "el abogado dictamina y firma".
- **§8** = encender `crucesPublicEnabled` depende de la firma legal (estado aprobado) + aplicar `0042_cruces_grant_anon.sql`; los 3 pasos de encendido documentados (NO ejecutados).
- **§9** = checklist con TODAS las casillas en blanco (`[ ]`) y los `____` vacios; decision de sign-off sin marcar.
- Marco temporal Ley 21.719 reusado POR REFERENCIA al `13-LEGAL-DOSSIER.md` (no re-litigado).

### Task 2 — Twin byte-identico en el phase-dir (commit `7b01957`)

`.planning/phases/41-crucen-.../41-LEGAL-DOSSIER.md` creado por copia EXACTA del canonico (el twin dropea el sufijo `-CRUCES`, convencion confirmada por `17-LEGAL-DOSSIER.md` / `13-LEGAL-DOSSIER.md`). Verificado: `cmp -s` clean, `sha256sum` identico (`15b13be9…`), 0 bytes CR (LF puro). Ambos nacen identicos porque, al firmar, el humano actualiza AMBOS (§9: "este archivo y su copia en docs/legal/").

## Verification

- `grep "signoff:" docs/legal/41-LEGAL-DOSSIER-CRUCES.md` → el campo YAML (linea 4) es `signoff: pending`; las otras coincidencias son menciones en prosa, todas `pending`. **Gate 3 OK.**
- `grep -c "signoff: approved"` = **0** en AMBOS archivos (grep-hygiene del `nota`). **OK.**
- `grep -c "^- \[x\]\|^- \[X\]"` = **0** en AMBOS (cero casillas marcadas). **OK.**
- `cmp -s` canonico vs twin → byte-identico; `sha256` match (`15b13be9bf636eaf…`). **OK.**
- CR bytes (via `tr -cd '\r' | wc -c`) = **0** en AMBOS (LF puro). **OK.**
- Contenido CRUCES-especifico: §1 `lobby_sector` intra-bloque; §2 agregacion por sector (no aristas/caminos); §3 sin partido/sentido-de-voto; §6 fuente unica lobby (no CC BY 4.0); §8 referencia `0042_cruces_grant_anon`. **OK.**

## Gate 3 — firma = accion humana (EXPLICITO)

**El dossier NACE `signoff: pending` y NUNCA fue firmado por el agente.** `asesor` / `fecha_signoff` / `observaciones` quedan vacios; las 8 casillas del checklist §9 quedan en blanco (`[ ]`); la subcadena literal `signoff: approved` NO aparece en ninguna parte (incl. el `nota`). La firma es **accion humana exclusiva (Phase 39)**, espejo del patron F13 (MONEY) / F17 (NET). Encender `crucesPublicEnabled` requiere los 3 pasos juntos POST-firma: (1) firmar el dossier (humano), (2) aplicar `0042_cruces_grant_anon.sql` (operador, con precondicion fail-loud sobre `0041`), (3) flip `CRUCES_PUBLIC_ENABLED=true` (operador). Un agente NUNCA cruza este gate.

## Deviations from Plan

None — plan ejecutado exactamente como fue escrito. Ningun Rule 1-4 aplicado. CERO DDL, CERO grant, CERO flip, CERO firma.

## Known Stubs

None. El dossier es un artefacto legal completo y autocontenido; su estado `pending` es intencional (gate 3), no un stub — su resolucion (firma) es la deuda explicita de operador Phase 39, ya registrada en STATE.md.

## Self-Check: PASSED

- FOUND: docs/legal/41-LEGAL-DOSSIER-CRUCES.md
- FOUND: .planning/phases/41-crucen-habilitaci-n-de-cruces-grant-gated-dossier-fecha-capt/41-LEGAL-DOSSIER.md
- FOUND commit: d6ac182 (Task 1 — dossier canonico)
- FOUND commit: 7b01957 (Task 2 — twin byte-identico)
