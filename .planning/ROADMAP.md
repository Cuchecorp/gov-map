**Plans:** 3 plans

Plans:
- [ ] 15-01-PLAN.md — Migración `0024_servel.sql` + pgTAP `0025_servel.test.sql`: tabla `aporte` (public-read, versionada, `eleccion` NOT NULL + `candidato_nombre_verbatim`), sub-maestra `donante` (deny-by-default + revoke, Ley 21.719), marcador `aportes_ingesta_estado`, RPC `aportes_de_parlamentario` (security-definer, orden eleccion DESC/fecha DESC, nunca proyecta RUT de donante); apply remoto + pgTAP (operador)
- [ ] 15-02-PLAN.md — Conector SERVEL en `@obs/dinero`: parser xlsx (`exceljs`, tras checkpoint de legitimidad) con gate de header-text → THROW en drift; drift BLOQUEANTE run-level + reconciliación de completitud (Content-MD5/byte-length → cuarentena, 0 filas, nunca parcial); crudo → Supabase Storage (clave versionada); host EXACTO SERVEL via extraHosts (no sufijo); enlace RUT-exacto del candidato (null hoy, fail-closed); bucket + corrida LIVE (operador)
- [ ] 15-03-PLAN.md — Sección `/parlamentario/[id]` "Aportes de campaña registrados en SERVEL": carril propio (mt-12) gateado por moneyPublicEnabled() (default OFF, heading ausente del HTML), 3 estados honestos, agrupación por periodo electoral + caveat de candidatura anterior, donante como sujeto propio (RUT nunca renderizado), atribución "términos por verificar", rama SERVEL en sourceLabel

