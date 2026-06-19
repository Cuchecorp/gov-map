---
quick_id: 260618-r7t
slug: fix-code-review-v1
date: 2026-06-18
status: complete
---

# SUMMARY — Fix de los 43 hallazgos del code review v1.0

**42 de 43 hallazgos resueltos** (#35 diferido a propósito: embedder duplicado, is_known/WARNING-1).
Branch: `fix/code-review-v1`. 16 commits atómicos.

## Verificación
- **Vitest:** todos los paquetes verdes — core, ingest, llm, identity, adjudication, tramitacion, agenda, fichas + app (69 tests). 0 fallos.
- **pgTAP (Supabase local):** 186/186 assertions, 0 fallos (incluye los nuevos 0012 y 0015, y 0003 actualizado).
- **Migraciones aplicadas a Supabase LOCAL y REMOTO** (sa-east-1) vía `db push`: 0012–0017. Objetos verificados en remoto (RPC, índice total, CHECK, trigger).

## Hallazgos por tanda

**Tanda 1 — seguridad + corrupción**
- #1 robots.txt gateado con `assertAllowedUrl` (SSRF). #9 `safeExternalHref` en ProvenanceBadge (XSS de href).
- #5 BOLETIN_RE con guión obligatorio. #6/#24 `parseFechaEsCl`→null + validación día-vs-mes. #4/#21 fechas en UTC determinista. #28 off-by-one Forma B.

**Tanda 2 — atomicidad/idempotencia**
- #7 orden ficha/embedding a prueba de crash. #3 **RPC transaccional `resolver_identidad`** (0015) — verificado con pgTAP. #2 trigger anti-regresión `parlamentario.estado` (0012).
- #19 índice único TOTAL de vínculo (0014, rediseñado tras descubrir que ON CONFLICT no infiere índices parciales). #42 estado `'error'` en proyecto_ficha (0013). #23 upserts aislados. #40/#41 worker: TOCTOU + TypeError ya no drena la cola.

**Tanda 3 — UX/observabilidad**
- #8 ProyectosSimilares degrada honesto. #34 error DB ≠ 404. #33 `React.cache`. #32 conteo por rango. #36 constantes únicas.
- #13/#20/#30 logging en catches. #43 clave de invitado incluye `calidad` (0016).

**Tanda 4 — higiene/DRY/defense-in-depth**
- #10 fecha_captura valida ISO. #11 fold colapsa apóstrofes/guiones. #12/#18 `metodo='determinista'`. #14/#15 gate RUT + RetryableError en embedder. #16/#22 período parametrizable. #17 preserve confirmado solo por id. #25 service-key solo por env. #26 valida semana ISO real. #27 guard path traversal. #29 escape unicode. #31 tipo CuerpoLegal[]. #37/#38/#39 higiene de migraciones (0017).

## Diferido
- **#35** embedder Gemini duplicado en `app/lib/buscar.ts` (is_known/WARNING-1): deliberado por server-only en Next; unificar vía paquete compartido queda en backlog.

## Notas operacionales
- El `.env` tiene un BOM que rompe el CLI `supabase`; se renombra temporalmente al correr comandos del CLI.
- DDL remoto SÍ funciona vía `supabase db push --db-url $SUPABASE_DB_URL` (pooler sa-east-1) — corrige la nota previa de "remoto bloqueado".
