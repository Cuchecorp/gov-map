# Phase 100 — Gate BrowserOS: lectura fría del panel sobre el DEPLOY real (PANEL-04)

**Fecha:** 2026-07-24
**Deploy verificado:** versión `f9ad3364-6b03-42f1-9d81-d455ef6acc9d` (OpenNext Docker node:22-slim → wrangler global)
**URL:** https://observatorio-congreso.thevalis.workers.dev
**Método:** BrowserOS (MCP) sobre el deploy real — `evaluate_script` + `getComputedStyle` + screenshot. NO local (la cascada CSS solo es cazable en el deploy real — gotcha LOCKED v6.1/v8.0).

> Cierre del criterio de éxito #4: veredicto "comprensible" para periodista/tramitador/ciudadano + candados verificados por getComputedStyle. Deploy precede al gate (build OpenNext liviano tras purgar `.pnpm-store` del mirror — 900MB→78MB; MSYS_NO_PATHCONV=1 para el bind-mount).

---

## 1. Veredicto de lectura fría: COMPRENSIBLE ✓

El panel responde el Core Value — "qué pasó, cuándo y según qué fuente" — de un vistazo, sin navegar menús ni leer prensa (lo contrario del benchmark senado/camara, ver 100-BENCHMARK.md). Texto real capturado del DOM del deploy:

| Señal (tile) | Contenido factual en el deploy | Fuente + fecha |
|--------------|--------------------------------|----------------|
| **Movimiento reciente** (velocity) | "5 trámites en 7 días (sin cámara)" · "79 trámites en 7 días · C.Diputados" · "86 trámites en 7 días · Senado" | "Fuente: Tramitación · datos al 22/23 jul 2026" |
| **Urgencias del Ejecutivo** | "104 urgencias fechadas en 30 días" | "Fuente: Urgencias del Ejecutivo · datos al 22 jul 2026" |
| **Agenda próxima** | "7 citaciones próximas · senado" | "Fuente: Agenda del Congreso · datos al 2026-08-05" |
| **Agenda (sala)** — SUPRIMIDA | "sin sesiones agendadas en las fuentes consultadas — en las fuentes consultadas al 2026-07-22" | (causa de supresión, NO lista vacía) |
| **Nuevos ingresos** — SUPRIMIDA | "sin nuevos ingresos fechados en la ventana — en las fuentes consultadas al 23 jul 2026" | (causa de supresión, NO 0-mudo) |
| **Archivos y retiros** | "2 movimientos de archivo o retiro fechados (30 días)" | "Fuente: Tramitación · datos al 06 jul 2026" |

**Honestidad verificada en vivo:**
- **Ausencia ≠ hecho:** las dos señales sin datos frescos renderizan su CAUSA ("sin sesiones agendadas…", "sin nuevos ingresos fechados…"), nunca una lista vacía ni un "sin movimiento".
- **Anti-ranking cross-cámara (T-52-13):** velocity se muestra POR cámara (5 sin-cámara / 79 C.Diputados / 86 Senado) sin orden "top/los más" — el usuario ve cobertura por cámara, no un ranking.
- **Trazabilidad:** cada tile lleva "Fuente: … · datos al [fecha]".
- **Framing anti-insinuación (card "¿Cómo leer esto?"):** "Cada dato lleva su fuente, su fecha y el enlace al documento oficial. La coincidencia temporal no implica relación: analiza cada dato con cuidado." Footer: "Fuente, fecha y enlace en cada dato · Sin afirmar intención ni causalidad."
- **Atribución CC BY 4.0** presente.

---

## 2. Candados de régimen verificados por getComputedStyle (deploy real)

`evaluate_script` sobre https://observatorio-congreso.thevalis.workers.dev:

```
unresolvedVars: 0        ← cero bare `-[--var]` roto (Tailwind v4 [var(--t)] resuelto)
sampleBgColors (rgb resueltos de tokens hsl(), NO hex literal):
  rgb(250,248,245)  crema  --background
  rgb(253,253,252)  card
  rgb(41,89,91)     petróleo --accent-product
  rgb(241,238,234)  border
  rgb(6,88,188)     --camara (azul Diputados)
  rgb(160,34,44)    --senado (granate)
  rgb(232,242,243)  accent-product-soft
```

- **cero-hex:** todos los colores computados derivan de tokens `hsl()` horneados (ningún hex literal en style).
- **Tailwind v4:** `unresolvedVars: 0` — la barra cívica usa `bg-[var(--camara)]`/`bg-[var(--senado)]` (forma v4), sin `var()` sin resolver ni transparencias por bare-var.
- **Tipografía / hero:** hero byte-idéntico ("Busca cualquier proyecto de ley por tema o número de boletín") + SearchBox + chips de ejemplo (protección de datos personales, delitos económicos y medio ambiente, 40 horas / jornada laboral, 14309-04) — Contract 1/2 intactos.

---

## 3. CSP + estructura intactas

```
$ curl -sI https://observatorio-congreso.thevalis.workers.dev
content-security-policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
x-frame-options: DENY
```

- CSP ENFORCED sin cambios (`frame-ancestors 'none'` + `object-src 'none'` intactos; `connect-src 'self'` NO ampliado — el panel lee server-side).
- URL de la home sin cambio; anchors/`section[id]` preservados; `force-dynamic` activo (el panel es precomputado, cero agregación cara on-read).

---

## 4. Loop diseño→crítica→loop

El benchmark (100-BENCHMARK.md) fijó el norte: superar el editorial+navegación de los portales oficiales con un tablero cuantitativo trazable. El deploy real confirma que el panel LO LOGRA — señales cuantitativas legibles de un vistazo, supresión honesta, cero ranking, candados intactos. **Gate PANEL-04: PASSED (comprensible).**

## Notas operativas del deploy

- Build OpenNext liviano: se purgó `.pnpm-store` (847MB) + `.planning` del mirror `C:/Temp/obs-build` (900MB→78MB) — el `tar` sobre el bind-mount Windows→contenedor era el cuello; el contenedor hace `pnpm install` fresco.
- `MSYS_NO_PATHCONV=1` obligatorio en `docker run`/`docker cp` (Git Bash reescribía `/host/...`→`C:/Program Files/Git/host/...`).
- Deploy: `wrangler deploy` global (OAuth host) desde `C:/Temp/obs-build/app/` — versión `f9ad3364`.

---

## Adenda — re-deploy tras code review (versión `3198e159`)

Los 3 WARNING del code review (WR-01 token crudo en chip, WR-02 dos tiles "Agenda próxima" duplicados, WR-03 keys por índice) se corrigieron y re-deployaron. Re-verificado en vivo sobre el deploy `3198e159`:
- WR-02: títulos distintos "Citaciones próximas" + "Sesiones de sala"; `dupAgendaProxima: 0`.
- WR-01: `has30dRaw: false`, `hasFuturasRaw: false` — el token interno ya no llega al chip.
- Honestidad intacta: supresión + "trámites en 7 días" presentes. Suite 1267 verde.
