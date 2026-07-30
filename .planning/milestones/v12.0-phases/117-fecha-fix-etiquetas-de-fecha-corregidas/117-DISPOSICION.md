---
phase: 117
requirement: FECHA-02
consumido_por: [125]
fecha: 2026-07-28
---

# 117-DISPOSICIÓN — los 14 hallazgos de fecha, uno por uno

Artefacto rector de la Phase 117. Cada hallazgo de `116-FECHAS-AUDIT.md` §3 tiene aquí una fila con
disposición explícita: **corregido** (con el antes/después verbatim y el commit) o **declarado**
(con la causa y a dónde va). **Cero excepciones silenciosas**: un hallazgo declarado con causa es un
resultado válido de la fase; uno silenciado, no.

Los verbatim salen de `117-01-SUMMARY.md`, `117-02-SUMMARY.md`, `117-03-SUMMARY.md` y del trabajo de
`117-04`. No se re-inventan.

---

## §1 Tabla de disposición — F-01 … F-14

| id | severidad | disposición | archivo:línea | ANTES (verbatim) | DESPUÉS (verbatim) | commit |
|---|---|---|---|---|---|---|
| F-01 | miente | **corregido** | `app/components/provenance-badge.tsx:90` → `:126-135` | `<span>Actualizado {relativeTimeEs(capturedAt)}</span>` | `<span>{origenFecha === "recalculo" ? "recalculado por el Observatorio al " : "según fuente al "}{fechaCorta(capturedAt)}{notaAgregacion !== undefined && ` (${notaAgregacion})`}</span>` | `767d39a` (RED `c7927d6`) |
| F-02 | miente | **corregido** | `app/components/cruces-de-parlamentario.tsx:194-203` · `cruces-de-proyecto.tsx:176-185` | `<ProvenanceBadge densidad="lista" capturedAt={new Date(s.fecha_captura)}` ⇒ rinde `según fuente al 28 jul 2026` | `<ProvenanceBadge densidad="lista" origenFecha="recalculo" capturedAt={new Date(s.fecha_captura)}` ⇒ rinde `recalculado por el Observatorio al 28 jul 2026` | `bc341ac` (RED `b4f95a6`, prosa `414d117`) |
| F-03 | miente | **corregido** | `app/app/proyecto/[boletin]/page.tsx:518` · `estado-actual-block.tsx:429` | badge de la sección "Tramitación" sobre `max(fecha_captura)` sin calificador: `según fuente al {fecha}` | `notaAgregacion="evento más reciente"` ⇒ `según fuente al {fecha} (evento más reciente)`; y en el bloque: `según {sourceLabel(urgenciaFuente.origen)} al {fechaCorta(urgenciaFuente.fechaCaptura)} (evento más reciente).` | `1c6d931` · `97aaf7d` |
| F-04 | miente | **corregido** (render) · **declarado** (datos) | `timeline-view.tsx:53-68` · `estado-actual-block.tsx:87-102` · `timeline-event.tsx:96` | `const d = new Date(raw); return Number.isNaN(d.getTime()) ? null : d;` | `if (Number.isNaN(d.getTime())) return null; return fechaPlausible(d) ? d : null;` + guard local `{fecha && fechaPlausible(fecha) && …}` en `timeline-event.tsx` | `bc63488` · `97aaf7d` (RED `3804dcf`, `0e3e755`) |
| F-05 | miente | **corregido** (render) · **declarado** (fondo) | `format.ts:21` (capa) + 8 renders en `timeline-event.tsx`, `capa1/tramitacion-stepper.tsx` ×2, `estado-actual-block.tsx`, `votos-por-parlamentario.tsx:527-538`, `votacion-card.tsx:37-45`, `actualidad-module.tsx:202-203,318` | `fechaCorta(…)` / `fechaCortaSegura(e.fecha)` sobre la fecha del HECHO ⇒ `2023-11-17T00:14:41Z` rendía **17 nov 2023** | `fechaHechoCorta(…)` / `fechaHechoCortaSegura(…)` ⇒ el mismo instante rinde **16 nov 2023** (día chileno real); las date-only disfrazadas siguen rindiendo su parte UTC | `34fac5c` (helper) · `bc63488` · `97aaf7d` · `94975e3` · `ff59771` |
| F-06 | miente | **corregido** (copy) · **declarado** (huérfano no se elimina) | `app/components/actualidad-module.tsx:441` (encabezado) y `:450-451` (por fuente) | `<span …>Última actualización de datos</span>` … `<span className="font-mono …">{fechaCorta(it.fecha)}</span>` | `<span …>Última consulta a las fuentes</span>` … `<span …>según fuente al <span className="font-mono">{fechaCorta(it.fecha)}</span></span>` + línea aclaratoria: `Esta fecha indica cuándo consultamos cada fuente, no cuándo la fuente publicó o modificó el dato.` | `ff59771` (RED `649fde3`) |
| F-07 | ambigua | **corregido** (dos variantes, ver §2) | `capa1/tramitacion-stepper.tsx` · `timeline-event.tsx` · `votos-por-parlamentario.tsx:527-538` · `votacion-card.tsx:37-45` · `lobby-de-parlamentario.tsx:161,489` · `lobby-menciones-de-boletin.tsx:127-133` | `{evento.descripcion}{d && <span className="ml-2 font-mono …">{fechaCorta(d)}</span>}` · `<span className="font-mono text-muted-foreground">{fechaCortaSegura(e.fecha)}</span>` · `const fechaTexto = a.fecha ? fechaCorta(new Date(a.fecha)) : a.fecha_raw ?? "Fecha no publicada";` | `{descripcion}{" — "}<span …>{fecha}</span>` · `Hito del <span className="font-mono">{fechaHechoCorta(fecha)}</span>` · `Votada el <span className="font-mono">{fechaHechoCortaSegura(e.fecha)}</span>` · `const fechaTexto = a.fecha ? \`Reunión del ${fechaCorta(new Date(a.fecha))}\` : a.fecha_raw ?? "Fecha no publicada";` | `bc63488` · `94975e3` (RED `a31e1fb`) |
| F-08 | ambigua | **corregido** (copy, gate OFF) · **declarado** (verificación contra dato real) | `contratos-de-parlamentario.tsx:188,238-240` · `financiamiento-de-parlamentario.tsx:225,364` · `contratos-por-contraparte.tsx:168` · `aportes-por-contraparte.tsx:189` | `Consultado por RUT, corte al {fechaCorteTexto}.` · `Consultamos ChileCompra … (corte al {fechaTexto}) …` · `Consolidado, corte al {fechaCorteTexto}.` | `Consultado por RUT; la fuente cubre hasta el {fechaCorteTexto}.` · `… (nuestra ingesta llega hasta el {fechaTexto}) …` · `Consolidado por el Observatorio; la fuente cubre hasta el {fechaCorteTexto}.` | `a966979` (RED `014ed90`) |
| F-09 | ambigua | **corregido** | `app/components/estado-actual-block.tsx:445` y 5 renders más (2 de ellos `aria-label`) | `fechaCorta(…)` en las 6 ocurrencias date-only ⇒ `2026-07-20T00:00:00Z` rendía `19` `fechaCivilCorta(…)` en las 6 ⇒ rinde `20 jul 2026` (CON año, ver §2(i): CR-01 revirtió `badgeFechaCitacion`, que borraba el año en superficies históricas); los 2 `aria-label` usan EXACTAMENTE el mismo helper que el texto visible (paridad por construcción) | `97aaf7d` → `9e25a8e` |
| F-10 | ambigua | **corregido** | `app/lib/format.ts:12-16` → `:26-31` · `timeline-view.tsx:29-41` | `new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric" })` — sin `timeZone` | el mismo formatter con `timeZone: "UTC"`; ídem `mesAnioFormatter` de `timeline-view.tsx` | `34fac5c` (RED `77443e2`) · `bc63488` |
| F-11 | ambigua | **corregido** (documental) · **declarado** (el umbral no se cambia) | `provenance-badge.tsx:17-21` · `113-INVENTARIO.md:663` y `:1069` | `Cada dato mostrado lleva "Actualizado hace X · {fuente} — fuente oficial ↗". Si el dato tiene más de 48h se marca en amber` · `esStale(capturedAt)` (`:33`, umbral 48 h → amber) | JSDoc que describe el copy REAL y *"más de 14 días (umbral por cadence de ingesta, `STALE_THRESHOLD_MS` en `lib/format.ts`)"* · `esStale(capturedAt)` (`:33`, umbral **14 días** → amber) con cita a `app/lib/format.ts:10` | `767d39a` · `fe286cf` · `be66bb9` |
| F-12 | ambigua | **corregido** (premisa del audit corregida — ver §2) | `app/components/search-result-card.tsx:71` · call-site vivo en `buscar-filtros.tsx:495` · faceta `:392-397` | `{anio != null ? String(anio) : "Sin dato"}` · `<legend className="net-filtros__legend">Año</legend>` | `{anio != null ? \`primer trámite ${anio}\` : "Sin dato"}` · `<legend className="net-filtros__legend">Año del primer trámite</legend>` | `828e87f` (RED `b9ce5dc`) |
| F-13 | ambigua | **corregido** | `app/components/estado-actual-block.tsx:417` | `Urgencia {urgenciaEstado.tipo} vigente desde el <span className="font-mono">{fechaCorta(urgenciaEstado.desde)}</span> (<span className="font-mono">{relativeTimeEs(urgenciaEstado.desde)}</span>).` | el paréntesis y su `<span>` eliminados; queda la fecha absoluta por `fechaHechoCorta`. `grep -c "relativeTimeEs"` en el archivo = **0** | `97aaf7d` |
| F-14 | ambigua | **corregido** | `app/components/panel-actualidad.tsx:104` | `return diaCalendarioCitacion(iso);` ⇒ el tile rendía `datos al 2026-08-10` (ISO crudo) | `return fechaCivilCorta(iso);` ⇒ rinde `datos al 10 ago 2026` (CON año, ver §2(i): WR-05 unificó el formato de las dos ramas del panel); ruteo por tipo y omisión honesta ante `fecha_max` NULL intactos | `1a9200b` (RED `1047bfa`) → `b420263` |

**Auto-check:** `grep -oE "F-(0[1-9]|1[0-4])" 117-DISPOSICION.md | sort -u | wc -l` ⇒ **14**. Ninguna
celda de §1 quedó vacía.

---

## §2 Declarados con causa

Lo que 117 **no** cerró —o cerró sólo en parte— con la razón y el destino. Cada punto está confirmado
por el trabajo real de los cuatro planes, no asumido del audit.

### (a) F-04 (parte datos) — las filas corruptas siguen en la base

Las 2 filas de `tramitacion_evento` del boletín `18232-25` con fecha `2626-05-25` **no se sanean en
DB**. 117 filtra el RENDER (guard `fechaPlausible` en el helper compartido + guard local en
`timeline-event.tsx`): la fila deja de apropiarse del "Último hito" y la fecha se omite, pero el
hecho (tipo + descripción + enlace a fuente) sigue visible.

**Causa:** el saneamiento es DML sobre PROD y pertenece a la ingesta, no a la capa de presentación
(audit §6 límite 7). **Destino:** deuda de operador / fase de ingesta.

### (b) F-05 (parte fondo) — la columna mezcla dos semánticas

`tramitacion_evento.fecha` contiene **45.618 filas date-only disfrazadas** (medianoche UTC) y
**7.603 con hora real**. 117 mitiga en el render con `fechaHechoCorta`, que ramifica por presencia de
hora en vez de convertir a ciegas.

**Causa:** la normalización correcta es en ingesta (una columna, una semántica), fuera del alcance de
una fase de etiquetas (audit §6 límite 6). **Destino:** abierta.

### (c) F-06 / E-003 / E-008 — los huérfanos se corrigen de copy pero NO se eliminan

`actualidad-module.tsx` (E-008) está superseded por `panel-actualidad.tsx` (E-055) y hoy no lo monta
ninguna ruta; E-003 está en la misma situación. 117 **corrige su copy de fechas igual** —el veredicto
de la fase debe valer si alguien re-monta el componente— y deja constancia en el JSDoc de cabecera
del archivo.

**Causa:** la eliminación de componentes huérfanos es alcance explícitamente diferido
(`117-CONTEXT.md` §Deferred Ideas; audit §6 límite 5). **Destino:** fase de limpieza de huérfanos.

### (d) F-08 — corregido con MONEY OFF; falta verificarlo contra dato real

Las cuatro superficies MONEY quedaron con el copy corregido **antes** del flip, que es exactamente lo
que F-08 exige. Pero `contrato` y `aporte` tienen **0 filas en PROD** (audit §6 límite 1), así que
ningún test pudo ejercer los rótulos sobre dato real.

**Causa:** el gate MONEY es legal y sigue OFF; 117 no lo toca (`money-antiflip-guard.test.ts` verde,
`git diff` sin `.env` ni gates). **Destino:** verificación al momento del flip.

### (e) F-11 — el umbral REAL de 14 días se conserva; cambiarlo NO es de esta fase

117 corrigió la DOCUMENTACIÓN (JSDoc del badge + dos filas del inventario rector) para que diga el
valor que el código realmente aplica: `STALE_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000`
(`app/lib/format.ts:10`), elegido por la cadence de ingesta semanal. **Cero cambio de
comportamiento.**

**Causa:** si 14 días es el umbral correcto para el usuario es una **decisión de producto** —afecta
cuándo el badge se pone amber en todo el sitio—, no una corrección de etiqueta. **Destino:** decisión
de producto.

### (f) F-07 (lado proyecto) — se cerró de DOS formas distintas, y la divergencia se declara

El fix del audit (`{descripcion} — {fecha}`) se aplicó a dos layouts distintos según la adyacencia
**verificada en el árbol**:

| superficie | adyacencia real | fix aplicado |
|---|---|---|
| `capa1/tramitacion-stepper.tsx` | la fecha ya vive en el MISMO `<p>` que `{evento.descripcion}` | separador `{" — "}` (U+2014), **cero rótulo nuevo**: la descripción ES el sustantivo del hecho |
| `timeline-event.tsx` | la fecha vive en el header junto al `CamaraChip`; la descripción está en otro `<p>` | rótulo `Hito del {fecha}` — un separador no diría de qué es la fecha |

Ambas son el mismo fix del audit aplicado a layouts distintos. `Hito del` es un idiom **ya registrado
en el fixture `(1d)` del linter** (117-01), no inventado. La divergencia se DECLARA para que 125 no la
lea como inconsistencia.

### (g) F-12 — premisa del audit CORREGIDA (no borrar: rotular)

El audit declaró el chip de año "hoy inerte" y sugirió eliminar la prop muerta. Esa premisa venía de
un grep limitado a `app/buscar/`. El grep vivo sobre `app/components/` la refuta:
`buscar-filtros.tsx:495` **sí** pasa `anio={row.anio}` a `SearchResultCard`, y la misma columna
alimenta el orden (`:71-76`) y la faceta de filtro por año (`:177`, `:201-202`).

Por eso el hallazgo se cerró **rotulando** (`primer trámite {año}`), NO borrando. El rótulo se compone
**sólo en la rama no-nula del ternario** —mismo tratamiento que el rótulo de lobby en 117-03— con
assert negativo obligatorio `not.toMatch(/primer trámite Sin dato/)`: prefijar el estado vacío
produciría una frase absurda sobre la ausencia. El `legend` de la faceta se alineó al mismo idiom
(`Año` → `Año del primer trámite`).

**Se deja constancia para que la Phase 125 no re-descubra la premisa equivocada.**

### (h) FECHA-117-OFFENDER-01 — `señal` preexistente en las superficies de cruces (decisión A)

Al sumar `SUPERFICIES_FECHA` (20 rutas) al linter anti-insinuación en 117-01, el escaneo pasó de 0 a
**2 offenders**, ambos por el término `señal` (prohibido desde el carril VSIM, 102-01):

| archivo | línea | texto renderizado |
|---|---|---|
| `app/components/cruces-de-parlamentario.tsx` | 94 | `Cada señal es un conteo de hechos públicos fechados: reuniones de lobby registradas bajo la Ley 20.730, agrupadas por sector de la contraparte.` |
| `app/components/cruces-de-proyecto.tsx` | 89 | (idéntico) |

Es copy **preexistente** y **factual**: la frase DEFINE `señal` como un conteo de hechos, es decir
niega precisamente la lectura metafórica que el término existe para bloquear. Siguiendo la regla
LOCKED, el plan se detuvo y escaló; el orquestador resolvió **Opción A**: registrar la frase verbatim
en `NEGACIONES_LOCKED`, mismo tratamiento que `LEYENDA_SIMILITUD_VOTO` / `LEYENDA_CROSS_LINK`.

Se registró como **literal** (precedente: la leyenda VOTO) porque el copy vive inline en el JSX de
ambos componentes y no en una constante exportada. Esa es la propiedad **auto-correctiva** de la
resta: si alguien edita la frase, el literal deja de calzar y el guard vuelve a morder, forzando una
decisión explícita.

Lo que NO se hizo: no se relajó el linter (ninguna superficie excluida), no se tocó copy ciudadano
publicado, no se agregaron términos a `TERMINOS_PROHIBIDOS`.

### (i) F-09 / F-14 — la disposición CAMBIÓ en el code-review: `badgeFechaCitacion` → `fechaCivilCorta`

`117-REVIEW.md` levantó CR-01 (crítico) y WR-05 sobre la forma en que F-09 y F-14 quedaron cerrados.
El helper elegido, `badgeFechaCitacion`, emite **"DD-mmm" sin año** — correcto para el badge compacto
de `/agenda` (su caso de origen, donde la semana en curso es el contexto), pero se aplicó también a
superficies **históricas**: `citacionesPasadas` (sesiones viejas, para prensa que revisa un proyecto
antiguo), `enTablaSala` (sin cota temporal alguna) y el panel de actualidad. Una citación de 2021 se
rendía "20-jul" junto a texto de ficha actual: el lector la leía como del año en curso. El mismo
string sin año viajaba a los `aria-label`, así que quien usa lector de pantalla tampoco tenía el año
en ningún canal. Y en el panel convivían DOS convenciones (`10-ago` sin año junto a `10 ago 2026`).

**Disposición nueva:** se agrega `fechaCivilCorta` a `app/lib/dia-calendario.ts` — variante **con
año** ("20 jul 2021") del MISMO helper date-only — y se usa en todas las superficies de
`estado-actual-block.tsx` (texto visible y `aria-label` pareados) y en la rama `agenda_*` de
`rotuloFecha` en `panel-actualidad.tsx`. `badgeFechaCitacion` queda **reservado a `citacion-card.tsx`
(/agenda)**.

**Lo que NO cambió (regla LOCKED intacta):** `fechaCivilCorta` delega en `diaCalendarioCitacion`, o
sea sigue leyendo la **parte fecha UTC** como día publicado, con **cero conversión de zona**. No se
introduce `America/Santiago` en ninguna superficie date-only; ese huso sigue viviendo solo en la rama
hora-real de `format.ts`. Lo único que cambia es el FORMATO de salida (se suma el año).

**Commits:** `9e25a8e` (CR-01, F-09) · `b420263` (WR-05, F-14).

---

## §3 Verificación de cierre

Ejecutada sobre el árbol completo de la fase (117-01 … 117-04), al cierre de 117-04.

| check | comando | resultado |
|---|---|---|
| suite completa | `pnpm test` | **exit 0** — app **1543/1543** en 107 archivos + los 18 paquetes verdes (`actualidad` 1, `core` 3, `freshness` 1, `llm` 17+1 skip, `notificaciones` 2, `cruces` 7+1 skip, `ingest` 11, `llm-bench` 13+2 skip, `identity` 14, `agenda` 13, `bio` 8, `adjudication` 12, `probidad` 8, `tramitacion` 18, `dinero` 18, `lobby` 9, `votos` 3, `fichas` 18) |
| typecheck | `pnpm -r exec tsc -b` | **exit 0** |
| copy `Actualizado` fuera del tooltip | `grep -rn "Actualizado" app/components app/app --include=*.tsx \| grep -v "\.test\." \| grep -v "^\s*[*/]"` | **vacío** |
| término prohibido pelado | `grep -rniE "(^\|[^a-záéíóúñ])captura([^a-záéíóúñ]\|$)" app/components app/app --include=*.tsx \| grep -v "\.test\."` | sólo identificadores (`fecha_captura`, `.select("fecha_captura")`) y comentarios — **cero copy renderizado** |
| rótulo MONEY viejo | `grep -rn "corte al" app/components --include=*.tsx \| grep -v "\.test\."` | **vacío** |
| idiom LOCKED del chokepoint | `grep -rn "según fuente al" app/components --include=*.tsx \| grep -v "\.test\."` | **13** ocurrencias (≥ 1) |
| flags / secretos | `git diff --name-only d560d64..HEAD \| grep -iE "\.env\|gate"` | **NINGUNO** — cero `.env`, cero `.env.example`, cero archivo de gate |
| guards de régimen | `pnpm vitest run lib/*guard*.test.ts lib/*gate*.test.ts` (incluidos en `pnpm test`) | anti-insinuación **40/40**, `money-antiflip-guard`, `lockdown`, `bento-coherencia`, `name-match-rut`, `env-example`, `integ-scope`, `provider-guard`, `cruces-gate`, `vsim-gate`, `net-gate`, `busqueda-hibrida-gate`, `admin-gate`, `money-gate` — **todos verdes** |
| umbral documental | `grep -ciE "48 *h" .planning/phases/113-inv-inventario-rector-de-superficies/113-INVENTARIO.md` | **0**; aparece **14 días** con cita a `app/lib/format.ts:10` |
| disposición completa | `grep -oE "F-(0[1-9]\|1[0-4])" 117-DISPOSICION.md \| sort -u \| wc -l` | **14** |

---

## §4 Trazabilidad a los Success Criteria del ROADMAP

| SC | enunciado | evidencia |
|---|---|---|
| **SC1** | Cada hallazgo de 116 está corregido o declarado, sin excepciones silenciosas | §1 de este documento: 14 filas, 14 ids distintos, cero celdas vacías. Los 8 puntos de §2 declaran con causa y destino lo que no se cerró en 117. El auto-check por grep es reproducible. |
| **SC2** | Las fechas de captura se presentan con el idiom LOCKED "según fuente al…", jamás como el hecho; "captura" pelado sigue prohibido | El chokepoint `provenance-badge.tsx` rinde el idiom en los 17 call-sites (F-01); `grep "Actualizado"` fuera del tooltip ⇒ **vacío**; `grep "corte al"` ⇒ **vacío** (F-08); el strip de la home usa el mismo idiom (F-06); `origenFecha="recalculo"` nombra el rebuild como rebuild (F-02); `notaAgregacion` declara el MAX como MAX (F-03). El término prohibido no aparece en copy renderizado. |
| **SC3** | Los guards de régimen siguen verdes tras los cambios de texto | anti-insinuación **40/40** con `SUPERFICIES_FECHA` (20 rutas) SUMADO al escaneo —es decir, con más superficie vigilada que antes de la fase— y los 10 idioms nuevos en el fixture `(1d)`. `NEGACIONES_LOCKED` creció en 1 entrada por decisión explícita del orquestador (§2h), nunca por relajación. `TERMINOS_PROHIBIDOS` sin cambios. |
| **SC4** | Suite de app + packages y typecheck verdes con los cambios incluidos | `pnpm test` exit 0 (app 1543/1543 + 18 paquetes); `pnpm -r exec tsc -b` exit 0. Ver §3. |

---

## §5 Límites de esta fase

1. **El deploy NO viaja en 117.** Todos los cambios son de código y documentación en el árbol; la
   publicación a Cloudflare va con la **Phase 125**.
2. **La verificación end-to-end sobre HTML renderizado la hace 125.** Lo que 117 prueba es render en
   jsdom + source-scan + grep reproducible sobre el árbol. Un ojo humano sobre el sitio desplegado no
   es parte de esta fase.
3. **El gate MONEY sigue OFF** y no se tocó. El copy de F-08 quedó corregido *antes* del flip.
4. **Ningún dato de PROD se modificó.** Las 2 filas corruptas de `tramitacion_evento` (F-04) siguen en
   la base; 117 sólo las filtra del render.
5. **Ningún paquete se instaló** en toda la fase.
6. **El tooltip de Radix** (`consultado {relativeTimeEs}`) se verifica por source-scan, no por render:
   Radix sólo monta el contenido al abrirse y jsdom no ejerce ese ciclo de forma fiable (precedente
   SC7 de la Phase 115).
