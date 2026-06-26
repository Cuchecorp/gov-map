# UI-SPEC — Ficha de parlamentario legible + analítica (v5)

**Phase 44 deliverable** · 2026-06-26 · Insumos: `44-AUDIT-UX.md`, `44-DATA-INVENTORY.md`, DESIGN-SYSTEM.md (CLOSED, §3/§7/§8).
**Estado:** propuesta para revisión — **no construir hasta sign-off del usuario** (ver §Decisión abierta).

---

## 0. Hallazgo que reordena el milestone (leer primero)

El milestone v5 asumía "navegación **+** gráficos". El inventario de datos dice: **la data manda.**

- **Navegación (acordeones + resumen)** es 100% construible hoy, **independiente de la cobertura de datos**. Entrega la mitad "legible" del milestone ya.
- **Gráficos:** de 6 candidatos, **solo patrimonio (conteo de ítems por año) tiene cobertura real hoy** (135 parlamentarios con ≥2 años). Los demás están bloqueados por **gaps de ingesta/identidad**, no de UI:
  - votos/ausencias → 10 votaciones en total (≤9 por persona): cualquier "tendencia" es ruido.
  - vs cámara → no existe RPC agregada; además hereda la sparsidad de votos.
  - autoría → `proyecto.autores` vacío (0/74) + falta resolución identidad.
  - similares-del-parlamentario → bloqueado por autoría.

→ **Recomendación:** v5 entrega **navegación + el único chart denso (patrimonio-conteo)**. Los charts data-hambrientos se **gatean explícitamente tras un milestone de ingesta** (votaciones masivas reales + ingesta de autores). Construir un timeline de votos hoy = un gráfico que dice "sin datos" — esfuerzo sin valor. Ver §Roadmap y §Decisión abierta.

---

## 1. Diseño de la ficha rediseñada

### 1.1 Anatomía (arriba → abajo)

```
┌─────────────────────────────────────────────┐
│ CABECERA (sin cambios)                        │  nombre · partido · periodo
│  ParlamentarioHeader (RPC parlamentario_publico)│
├─────────────────────────────────────────────┤
│ ▸ RESUMEN + ÍNDICE  (NUEVO, above-fold)       │  ← F45
│   chips de salto con CONTEO por carril:        │
│   [Votaciones 9] [Lobby 12] [Patrimonio 6 años]│
│   [Cruces 3] [Financiamiento —]                │
│   cada chip ancla al carril; conteo = honest   │
├═════════════ mt-12 (frontera, LOCKED) ════════┤
│ ▾ Votaciones                          (9)      │  acordeón, header siempre visible
│     └ cuerpo colapsable (VotosSection actual)  │
├═════════════ mt-12 ═══════════════════════════┤
│ ▾ Reuniones de lobby                 (12)      │
├═════════════ mt-12 ═══════════════════════════┤
│ ▾ Declaraciones de patrimonio   (6 años)       │
│     └ [chart conteo por año]  ← F46            │
│     └ tabla de versiones (actual)              │
├═════════════ mt-12 ═══════════════════════════┤
│ ▾ Cruces con sectores                 (3)      │  (gated Candado B, ya ON)
├═════════════ mt-12 ═══════════════════════════┤
│ Financiamiento y contratos (estado honesto)    │  pie, distinto de carriles con data
└─────────────────────────────────────────────┘
```

### 1.2 Reglas del acordeón (anti-insinuación, HARD)

1. **Uno por carril.** Prohibido un acordeón que agrupe dos dominios. Cada `<section>` de dominio = su propio acordeón. La frontera `mt-12` entre acordeones **se mantiene**, nunca se colapsa (DESIGN-SYSTEM §3/§8 LOCKED).
2. **Header siempre visible** (no colapsable): conserva `h1→h2→h3` y la identidad de carril aunque el cuerpo esté cerrado. El `<h2>` vive en el header del acordeón.
3. **Conteo/estado en el header** (`(9)`, `(6 años)`, `(—)`): el lector decide qué abrir sin abrirlo. El conteo respeta los 3 estados honestos (§7 DESIGN-SYSTEM): dato / vacío-honesto / no-ingerido.
4. **Estado por defecto:** abrir los carriles con datos sustantivos del diputado (heurística simple: patrimonio + el de mayor conteo); colapsar vacíos/ralos. Decidir el default exacto en F45 con data real; conservador = todos colapsados salvo el primero con datos.
5. **Cada dato conserva fuente+fecha+enlace** dentro del cuerpo (sin cambios al contenido actual de las secciones).

### 1.3 Componente de acordeón

- **Radix UI Accordion** (`@radix-ui/react-accordion`) — coherente con el stack ya instalado (`@radix-ui/react-{separator,slot,tooltip}`), accesible (teclado/ARIA), SSR-friendly, server-component-compatible con un thin client wrapper para el toggle. **Evitar** una solución custom o `<details>` crudo (estilado inconsistente). Es la única dep nueva de F45.

---

## 2. Librería de gráficos

- **Decisión: Recharts** para los charts de v5 (conteo patrimonio; más adelante distribución de votos). Motivo: los charts viables son **estándar** (barras/área temporal), Recharts es React-first y rápido; el CLAUDE.md ya lo nombra para "gráficos estándar". **visx** queda reservado para el timeline a medida cruzando cámaras (no es de v5).
- **GAP de stack:** **ni Recharts ni visx están instalados** (`app/package.json` no los tiene). F46 debe `pnpm add recharts` y verificar el build OpenNext/Cloudflare (charts son client components → islas `"use client"`; el resto de la ficha sigue server). Validar que Recharts no rompe el worker (probar en Docker Linux, no build Windows).
- **Charts = descriptivos.** Ejes y leyendas neutros ("N.º de bienes declarados por año"), sin causalidad, con fuente+fecha+enlace al pie del chart igual que las tablas. Degradan a "datos insuficientes para una tendencia" cuando n es bajo.

---

## 3. RPCs nuevas necesarias (deny-by-default + PII-safe)

| RPC nueva | Para | Forma | Seguridad | Fase |
|---|---|---|---|---|
| `proyectos_de_parlamentario(p_id)` | chart 5 (autoría) | `boletin,titulo,etapa,rol(autor/coautor),fecha,enlace` | `security definer`, PII-safe, allowlist | F48 (bloqueada por ingesta autores) |
| `tasa_ausencia_comparada(p_id)` | chart 4 (vs cámara) | `{tasa_propia, promedio_camara, percentil, n_votaciones}` — solo derivados | `security definer`, **nunca** proyecta identidad de otros; allowlist | F49 (bloqueada por votos ralos) |
| *(patrimonio-conteo)* | chart 2 | **reusar** `bienes_de_parlamentario`/`declaraciones_de_parlamentario` (ya devuelven `fecha_presentacion`+tipo); agregar el conteo **en el cliente/server-component**, sin RPC nueva | — | F46 |
| *(votos distribución)* | chart 1/3 | **reusar** `votos_de_parlamentario` (ya devuelve `fecha`+`seleccion`) | — | F47 |

**Regla (Camino A):** toda RPC nueva → agregar su nombre al `PUBLIC_RPC_ALLOWLIST` (`app/lib/lockdown-guard.test.ts:157`) en el MISMO commit o el guard CI falla; jamás proyectar `rut`/donante crudo; prohibido `.from('parlamentario')` directo en el árbol público.

---

## 4. Roadmap de construcción (re-secuenciado por evidencia)

> Cambio vs el tentativo del milestone: **se desacopla "navegación" (ship ya) de "charts" (gated por datos)**. Solo F45 y F46 son construibles con valor hoy.

### Construible AHORA (no depende de ingesta)
- **F45 — Navegación + resumen (legibilidad).** Acordeones por carril (Radix), resumen+índice above-fold con conteos honestos, defaults de apertura, frontera de carril intacta. *Dep:* `@radix-ui/react-accordion`. *Entrega:* la mitad legible del milestone, sola. **Mayor ROI del milestone.**
- **F46 — Chart de patrimonio (conteo por año).** Recharts (instalar + validar build CF). Área/barras de N.º de bienes/pasivos por `fecha_presentacion`, rotulando tipo de declaración; caveat montos-como-URI; degrade honesto. *Dep:* F45 (vive dentro del acordeón patrimonio) + `recharts`.

### GATED por datos (no construir hasta cerrar el gap de ingesta)
- **F47 — Chart de votos/ausencias.** Bloqueado de hecho: 10 votaciones. *Pre-req:* **re-ingesta masiva de votaciones** (la Phase 27 no logró cobertura; reabrir). Hasta entonces el carril votos se queda como lista + estado "datos insuficientes para una tendencia".
- **F48 — Autoría + similares-del-parlamentario.** *Pre-req:* ingesta que pueble `proyecto.autores` + resolución nombre→`parlamentario_id` (pipeline identidad) + RPC `proyectos_de_parlamentario`. Recién ahí `match_proyectos` aplica a "los proyectos de este diputado".
- **F49 — Comparativo vs cámara (ausencias/actividad).** *Pre-req:* F47 (cobertura votos) + RPC `tasa_ausencia_comparada`. Sin votos densos, el percentil es ruido.

### Dependencias
```
F45 (nav) ──► F46 (patrimonio chart)          [v5 entregable hoy]
                 │
   ── gap de ingesta ──────────────────────────
   ingesta votaciones ──► F47 ──► F49
   ingesta autores+identidad ──► F48
```

---

## 5. Decisión (RESUELTA 2026-06-26): A + B — ambas pistas en paralelo

El usuario eligió **A y B**: hacer la legibilidad construible hoy **y** abrir la ingesta que desbloquea los charts gated. La ingesta **entra a v5** (no se difiere a un v6). Dos pistas concurrentes, sin barrera entre ellas:

- **Pista LEGIBILIDAD (A) — empieza ya, data-independiente:** F45 (navegación) → F46 (chart patrimonio-conteo). Mayor ROI; no espera datos. Entrega visible en cada fase.
- **Pista INGESTA (B) — en paralelo, desbloquea los charts gated:**
  - **Ingesta de votaciones masiva** (reabrir/extender Phase 27 — solo 10 votaciones cargadas) → desbloquea **F47** (votos/ausencias) y luego **F49** (vs cámara).
  - **Ingesta de `proyecto.autores` + resolución nombre→`parlamentario_id`** → desbloquea **F48** (autoría + similares-del-parlamentario).

A medida que cada gap de ingesta cierra, su fase de chart pasa de GATED a construible. La pista de legibilidad NO espera a la ingesta; los charts gated se construyen cuando su data llega. Ningún chart se construye contra data vacía (degrade honesto mientras tanto).

---

## 6. Checklist de invariantes (todas las fases)
- [ ] Frontera de carril `mt-12` nunca colapsada; un acordeón por dominio, jamás dos dominios en una unidad.
- [ ] `h1→h2→h3` válido con acordeones (h2 en header siempre visible).
- [ ] Cada dato/gráfico: fuente + fecha + enlace; etiquetas descriptivas, nunca causales.
- [ ] Charts degradan honestamente ("datos insuficientes"/"aún no ingerido") en vez de aparentar densidad.
- [ ] RPC nueva → en `PUBLIC_RPC_ALLOWLIST` + PII-safe + sin `.from('parlamentario')` directo.
- [ ] Build de charts validado en Docker Linux + wrangler (no build Windows).
