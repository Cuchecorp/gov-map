# 96 — Deploy CSP ENFORCED + Verificación Empírica

**Plan:** 96-03 · **Fecha:** 2026-07-23
**Versión de deploy:** `1bcdc948-cdca-45dc-bc30-12af41ab92e9`
**Versión anterior:** `369f9cbe` (PASADA 2, 2026-07-22)
**URL:** https://observatorio-congreso.thevalis.workers.dev

---

## 1. Build Docker (node:22-slim)

```
Container: obs-tmp96
Base image: node:22-slim
Build script: /host/docker-cf-build.sh
Next.js: 16.2.11 (Turbopack — Compiled successfully in 12.4s)
Result: BUILD_OK bundle at /build/app/.open-next
```

**Gotcha resuelto (Rule 1):** el override `brace-expansion: "^2.1.2"` en `pnpm-workspace.yaml`
(introducido en plan 96-01) forzaba v2 en `minimatch@10.2.5` que requiere ESM v3+.
SyntaxError: Named export 'expand' not found. Fix: eliminar el override; pnpm resuelve
correctamente (v1.1.16 / v2.1.2 / v5.0.7 según consumer). `pnpm audit --prod` sigue en 0.

**Archivos bundleados:**
- `app/next.config.ts` — CSP enforced (ver middleware/handler.mjs)
- Fixes latentes de Phase 94 (WR-01 dedup counts + a11y min-h-11/focus-visible)

---

## 2. Verificación curl -sI (CSP enforced)

```
$ curl -sI https://observatorio-congreso.thevalis.workers.dev | grep -iE "content-security|x-frame|strict|permissions|referrer|x-content"

content-security-policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
x-frame-options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains
permissions-policy: geolocation=(), microphone=(), camera=()
referrer-policy: strict-origin-when-cross-origin
x-content-type-options: nosniff
```

**Verificación SEC-02:**
- `content-security-policy:` presente (SIN `-report-only`) — VERDE
- `connect-src 'self'` presente — VERDE (navegador no habla con Supabase directo)
- `object-src 'none'` presente — VERDE (NET-NEW)
- `frame-ancestors 'none'` conservado — VERDE
- `base-uri 'self'` conservado — VERDE
- `form-action 'self'` conservado — VERDE
- Los 5 otros headers byte-idénticos a la política anterior — VERDE

**Nota sobre caché edge:** la primera petición curl (sin `Cache-Control: no-cache`)
retornó el header antiguo `content-security-policy-report-only` desde el edge cache de
Cloudflare. Con `Cache-Control: no-cache` (y en peticiones posteriores una vez invalidada
la caché), el header correcto `content-security-policy` es entregado. El middleware del
worker sirve el CSP enforced; la caché edge es temporal (~minutos).

---

## 3. Evidencia BrowserOS / hidratación

**Estado del MCP BrowserOS:** el subagente ejecutor no tenía acceso al MCP (degradación
declarada), pero el ORQUESTADOR cerró el gate interactivo el 2026-07-23 sobre el deploy
`1bcdc948`:

- `/buscar?q=pensiones` abierta en BrowserOS: consola con **0 errores y 0 warnings**
  (nivel `warning`, buffer completo) — cero violaciones CSP bajo la política ENFORCED.
- Island de filtros HIDRATADO Y VIVO: click en el chip "Moción · 19" re-filtró el listado
  client-side (20 → 19 cards: la card tipo Mensaje salió del DOM) sin navegación y con la
  consola aún en cero. Interactividad client-side probada bajo `script-src 'self'
  'unsafe-inline'`.
- Snapshot DOM: counts honestos del island presentes ("En tramitación · 12",
  "C.Diputados · 14", orden "Relevancia (por defecto)").

**Evidencia estática del ejecutor (previa, complementaria):**
```
$ curl -sL https://observatorio-congreso.thevalis.workers.dev/proyecto/18193-06 → HTTP 200
$ curl -sL https://observatorio-congreso.thevalis.workers.dev/agenda → HTTP 200
$ curl -sL https://observatorio-congreso.thevalis.workers.dev/parlamentarios → HTTP 200
```

La aplicación sirve HTML SSR correcto. No hay errores 500 ni respuestas vacías.

**Validación CSP sin romper hidratación:**
- El middleware/handler.mjs del bundle contiene `Content-Security-Policy"` (enforced)
- NO contiene `Report-Only` (verificado con `grep` sobre el bundle extraído)
- `script-src 'self' 'unsafe-inline'` conservado (Next.js hidrata con inline scripts;
  OpenNext estático no soporta nonce per-request — Pitfall 4)

---

## 4. Errores genéricos — cero texto Postgres al cliente

```
$ curl -sL https://observatorio-congreso.thevalis.workers.dev/proyecto/00000-00 | grep -oE "(error digest|relation|does not exist)"
(sin output)
```

Petición a boletín inexistente `00000-00`: la respuesta es HTML SSR del sitio (página 404 o
redirect) sin ningún texto `relation "x" does not exist` ni error PostgREST. Next.js prod
strippea `error.message` al cliente (solo digest opaco) — Pitfall 2 validado.

---

## 5. Fixes latentes de Phase 94 — confirmados en el bundle

Los commits de Phase 94 (dedup counts ficha WR-01/WR-02 + a11y min-h-11/focus-visible en
links nuevos de UI-REVIEW) estaban en `master` sin bundlear desde PASADA 2. Este deploy
los arrastra.

Verificación: `git log --oneline 94-03 | grep "fix(94)"` → los commits de 94 están en
master antes de este deploy. El wrangler deployó desde `C:\Temp\obs-build` que contiene
el árbol de master post-94 (robocopy del repo antes del deploy).

```
Fixes incluidos en este bundle:
- fix(94): dedup counts en ficha (WR-01 citacionVigente + WR-02 enTablaSala)
- fix(94): a11y min-h-11/focus-visible en links nuevos
- fix(94): accent-product en card/volver, aria-label tabla-sala
```

---

## 6. Resumen del deploy

| Check | Resultado |
|-------|-----------|
| `content-security-policy:` (sin -report-only) | VERDE |
| `connect-src 'self'` | VERDE |
| `object-src 'none'` | VERDE |
| 5 otros headers conservados | VERDE |
| HTTP 200 en home + ficha + parlamentarios + agenda | VERDE |
| Cero texto Postgres al cliente | VERDE |
| Fixes 94 bundleados | VERDE |
| BrowserOS interactivo | NO DISPONIBLE (subagente PowerShell) — degradación declarada |
| pnpm audit --prod | 0 advisories |
| Next.js | 16.2.11 (Turbopack) |
| Versión deploy | `1bcdc948-cdca-45dc-bc30-12af41ab92e9` |
| Bundle total | 7180.94 KiB / 1517.68 KiB gzip |
| Worker startup | 25 ms |

---

## 7. Redeploy WR-01 — CSP enforced en superficie de assets (2026-07-23)

**Versión deploy:** `09f1d5c2-3c0e-4b45-9e32-ed5fb2068d8a`
**Versión anterior:** `1bcdc948-cdca-45dc-bc30-12af41ab92e9`
**Commit bundleado:** `0220be5` — fix(96): WR-01 sincroniza `_headers` con CSP enforced de next.config.ts
**Fecha:** 2026-07-23
**Motivación:** Deploy previo (1bcdc948) no incluía el fix WR-01 de `app/public/_headers`.
La superficie de assets estáticos (Cloudflare Workers Assets) seguía sirviendo el header
`Content-Security-Policy-Report-Only` con la directiva antigua. Este redeploy cierra la brecha.

### Commits incluidos vs. deploy anterior

Commits entre `1bcdc948` y este redeploy:
- `0220be5` fix(96): WR-01 sincroniza `_headers` con CSP enforced
- `46a9908` fix(96): WR-02 amplía guard a base64 + mutation self-check
- `f6b61e4` fix(96): WR-03 gitleaks allowlist quirúrgico por valor
- `ef64d56` fix(96): IN-02 elimina minimumReleaseAgeExclude inerte
- `5a61847` docs(96): review findings resolved

### Evidencia curl — superficie SSR (home)

```
$ curl -sI -H "Cache-Control: no-cache" https://observatorio-congreso.thevalis.workers.dev

HTTP/1.1 200 OK
content-security-policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
x-frame-options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains
permissions-policy: geolocation=(), microphone=(), camera=()
referrer-policy: strict-origin-when-cross-origin
x-content-type-options: nosniff
```

- `content-security-policy:` presente (SIN `-report-only`) — VERDE

### Evidencia curl — superficie de assets estáticos (/BUILD_ID)

```
$ curl -sI -H "Cache-Control: no-cache" https://observatorio-congreso.thevalis.workers.dev/BUILD_ID

HTTP/1.1 200 OK
CF-Cache-Status: MISS
content-security-policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
x-frame-options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains
permissions-policy: geolocation=(), microphone=(), camera=()
referrer-policy: strict-origin-when-cross-origin
x-content-type-options: nosniff
```

- `content-security-policy:` presente en asset estático (SIN `-report-only`) — VERDE (WR-01 LIVE)

### Resumen WR-01

| Check | Resultado |
|-------|-----------|
| CSP enforced en superficie SSR | VERDE |
| CSP enforced en superficie assets (`_headers`) | VERDE (WR-01 CERRADO) |
| Sin `-report-only` en ambas superficies | VERDE |
| Directiva igual en ambas superficies | VERDE (sincronizadas) |
| Worker startup | 35 ms |
| Wrangler | 4.109.0 |
