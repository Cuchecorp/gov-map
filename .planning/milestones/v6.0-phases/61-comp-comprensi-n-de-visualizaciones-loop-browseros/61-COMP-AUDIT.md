# 61-COMP-AUDIT — Lectura fría de superficies

**Fecha captura:** 2026-07-09  
**URL base:** https://observatorio-congreso.thevalis.workers.dev  
**Viewports:** desktop (1440px via BrowserOS hidden page) + mobile (390px meta viewport)

---

## Verdicts por superficie

| Superficie | Desktop | Mobile | Veredicto |
|-----------|---------|--------|-----------|
| `/` (home) | comprensible | comprensible | **comprensible** |
| `/parlamentario/D1009` — top | comprensible | comprensible | comprensible |
| `/parlamentario/D1009` — cruces | **no-se-entiende(P0)** | P0 | **P0** |
| `/proyecto/18325-06` (moción) | comprensible | comprensible | **comprensible** |
| `/proyecto/14309-04` (mensaje) | comprensible | comprensible | **comprensible** |
| `/red` | comprensible | comprensible | **comprensible** |
| `/buscar` | comprensible | comprensible | **comprensible** |
| `/agenda` | comprensible | comprensible | **comprensible** |

---

## Hallazgos detallados

| ID | Superficie | Viewport | Severidad | Qué confunde | Fix propuesto | Screenshot |
|----|-----------|----------|-----------|--------------|---------------|-----------|
| COMP-01 | /parlamentario — CrucesCapa1 | desktop + mobile | **P0** | La sección "Cruces con sectores" no define qué es un "cruce". Primer visitante: "¿cruces? ¿de qué? ¿cruzar con qué?" El número 12 en el header tampoco está explicado (12 ¿qué?). | Agregar un subtítulo/intro visible en CrucesCapa1 ANTES de los chips: "Sectores en los que este parlamentario tuvo reuniones de lobby registradas." | parlamentario-desktop-cruces.png |
| COMP-02 | /parlamentario — CrucesCapa1 | desktop + mobile | **P0** | El caveat "La coincidencia temporal no implica relación entre la reunión y el voto" aparece debajo de los chips, pero el lector no sabe aún qué es una "señal" ni por qué se habla de un "voto" aquí. El disclamer requiere contexto que no existe en la capa-1. | Reemplazar el caveat por una frase que defina PRIMERO qué muestra la sección, después qué no afirma. Ejemplo: "Muestra cuántas reuniones de lobby (Ley 20.730) tiene registradas por sector. No establece relación entre una reunión y ningún voto." | parlamentario-desktop-cruces.png |
| COMP-03 | /parlamentario — CrucesCapa1 | desktop + mobile | **P1** | El h2 "Cruces con sectores" no responde a ninguna pregunta. El lector no sabe si esto es bueno, malo, raro o normal tener 22 reuniones con "Comercio, industria y retail". | Cambiar el título h2 a pregunta sobria: "¿Con qué sectores tuvo reuniones de lobby?" | parlamentario-desktop-cruces.png |
| COMP-04 | /parlamentario — CrucesCapa1 | desktop + mobile | **P1** | El "Cómo leer esto" (ComoLeerCruces) está implementado pero SOLO dentro del DetalleColapsable (tras "Explorar los 12 cruces"). El lector ve los chips + caveat sin contexto y debe pulsar un botón para entender qué significa la sección. La explicación está a un click de distancia cuando debería ser inmediatamente visible. | Mover (o duplicar) la definición clave de "cruce" a la CrucesCapa1 visible (ANTES del disclosure). No es necesario repetir el bloque completo — basta un subtítulo de definición (COMP-01 ya lo propone). | parlamentario-desktop-cruces.png |
| COMP-05 | /parlamentario — CrucesCapa1 | desktop + mobile | **P1** | El botón "Explorar los 12 cruces" reutiliza el término "cruces" que el usuario aún no entiende. Si no sabe qué es un cruce, el CTA no invita a pulsar. | Cambiar el label del triggerLabel a "Ver detalle de reuniones de lobby por sector" o simplemente "Ver las 12 señales de lobby por sector". | parlamentario-desktop-cruces.png |
| COMP-06 | /parlamentario — nav rail | desktop | **P1** | En el rail lateral, la entrada de cruces dice "◆ Cruces con sectores 12". El diamante (◆) es un marcador sin leyenda; el usuario no sabe qué significa ese símbolo distinto a los demás ítems del rail. | Quitar el símbolo ◆ del rail o añadir un tooltip/aria-label "Sección con cruce de fuentes" que explique el marcador. Alternativamente, cambiar el label del rail a "Lobby por sector 12". | parlamentario-desktop-antes.png |
| COMP-07 | /parlamentario — Declaraciones de patrimonio | desktop | **P2** | El mini chart de declaraciones muestra barras sin unidad visible ni título orientado a pregunta. Se entiende que son años (2017-2026 visible), pero no qué mide cada barra. | Añadir un subtítulo: "¿Cuántos bienes declaró por año?" y leyenda "N ítems por declaración anual". | parlamentario-desktop-patrimonio.png |
| COMP-08 | /red | desktop + mobile | **P2** | La página /red tiene descripción clara en texto ("haber recibido audiencia de la misma contraparte de lobby"), pero el estado vacío antes de seleccionar un parlamentario no da ninguna pista visual de cómo se vería el grafo. Un minieje de ejemplo sería útil. | P2 — diferido. No bloquea comprensión mínima. | red-desktop-antes.png |
| COMP-09 | /buscar | desktop | **P2** | Página de búsqueda muy limpia pero la instrucción "Escribe una idea o un número de boletín para buscar proyectos de ley" está solo en texto muy pequeño. No hay ejemplo de qué se puede buscar. | P2 — la home ya tiene ejemplos; la página de búsqueda puede vivir más simple. Diferido. | buscar-desktop-antes.png |

---

## Resumen de severidades

- **P0 (no se entiende / bloquea):** COMP-01, COMP-02 — sección "Cruces con sectores" sin definición visible en capa-1.
- **P1 (fricción de comprensión):** COMP-03, COMP-04, COMP-05, COMP-06 — título no es pregunta, "Cómo leer" escondido, CTA reutiliza jargon, símbolo ◆ sin leyenda.
- **P2 (pulido visual, diferido):** COMP-07, COMP-08, COMP-09.

**Total P0+P1 a corregir en este plan:** 6 hallazgos (COMP-01 al COMP-06).

---

## Estado final (post deploy #2 — versión 051a6cf0)

| ID | Severidad | Hallazgo | Estado final | Evidencia |
|----|----------|---------|--------------|-----------|
| COMP-01 | P0 | "Cruces con sectores" sin definición visible | **corregido** | HTML live: h2 = "¿Con qué sectores tuvo reuniones de lobby?" |
| COMP-02 | P0 | Caveat incomprensible sin contexto | **corregido** | HTML live: intro contextual + "Ley del Lobby (Ley 20.730)" visible antes de chips |
| COMP-03 | P1 | h2 no responde a pregunta | **corregido** | Incorporado en COMP-01 |
| COMP-04 | P1 | "Cómo leer esto" escondido | **corregido** | Intro contextual siempre visible en capa-1 |
| COMP-05 | P1 | Botón reutiliza jargon "cruces" | **corregido** | HTML live: "Ver las 12 señales de lobby por sector" |
| COMP-06 | P1 | Rail label "Cruces con sectores" + ◆ sin leyenda | **corregido** | Screenshot desktop: "◆ Lobby por sector  12" |

Evidencia en `comp-evidence/parlamentario-desktop-despues.png` (top + rail visible) y `parlamentario-mobile-despues.png`.

---

## Hallazgos fuera de scope (pre-existentes / arquitectura)

- ComoLeerCruces existe en CrucesView — buen contenido, solo está en el lugar equivocado (colapsado). El fix (COMP-04) es mover definición al capa-1, no reescribir el contenido del detail.
- Los charts de votaciones/patrimonio/ausencias (COMP-03 de la fase) se revisarán si están accesibles desde la ficha; el chart de patrimonio visible en D1009 requiere barra → P2 (COMP-07).
