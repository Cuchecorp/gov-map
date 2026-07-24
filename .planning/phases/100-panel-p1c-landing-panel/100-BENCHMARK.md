# Phase 100 — Benchmark BrowserOS: senado.cl / camara.cl (PANEL-03)

**Fecha:** 2026-07-24
**Método:** captura BrowserOS de las portadas oficiales + crítica de diseño. Norte: qué EVITAR, qué SUPERAR.

> El panel de actualidad del Observatorio compite contra estos dos portales como fuente de "qué está pasando HOY en el Congreso". El hallazgo es unánime: **ambos son editoriales y de navegación, no cuantitativos**. Ninguno responde "qué pasó, cuánto, cuándo" con dato — obligan a navegar menús o leer noticias.

---

## senado.cl (portada, capturada 2026-07-24)

**Qué muestra:** un hero de foto (senador sonriendo) con banda "Labor Legislativa / Nuevo Portal Legislativo"; una columna "Noticias" con titulares fechados (ej. "Estragos por el temporal en la pesca artesanal… 24 de julio 2026 08:30 hrs"); una barra de navegación por menús desplegables (Acerca del Senado, Actividad legislativa, Senadoras y senadores, Transparencia, Ciudadanía, Comunicaciones).

**Crítica:**
- **Editorial, no cuantitativo.** La superficie primaria es prensa institucional (foto + titular), no "cuántos proyectos se movieron esta semana". El dato legislativo está enterrado tras menús.
- **Fecha presente pero como sello de noticia**, no como reloj de actividad. No hay agregación ("N trámites", "N citaciones próximas").
- **Cero cobertura declarada.** No dice de qué es fresco ni qué falta.

## camara.cl (portada, capturada 2026-07-24)

**Qué muestra:** bloque "Destacados en la Cámara" (foto de sala de comisión + titular "Ley del Mono: avanza proyecto…"); columna derecha "Actividad Legislativa" = LISTAS DE ENLACES de navegación (Comisiones: Legislativas/Investigadoras/Unidas/Citaciones/Resultados; Sala de Sesiones: Sesiones de Sala/Asistencia/Votaciones/Tabla Semanal/Calendario/Sesiones Pedidas) con botón "Ver todas las Comisiones".

**Crítica:**
- **Navegación por listas densas de enlaces**, típico ASP.NET WebForms: el usuario debe saber qué buscar y hacer clic para llegar al dato. No hay un solo número en la portada.
- **Editorial arriba** (Destacados = foto+titular), igual que Senado.
- **"Votaciones"/"Tabla Semanal" existen pero como link a otra tabla densa**, no como señal resumida.

---

## Síntesis: qué EVITAR / qué SUPERAR

| Dimensión | Portales oficiales (EVITAR) | Panel Observatorio (SUPERAR) |
|-----------|------------------------------|-------------------------------|
| **Superficie primaria** | Foto editorial + titular de prensa | Señales cuantitativas: "N trámites en 7 días", urgencias fechadas, agenda próxima |
| **Acceso al dato** | Menús desplegables / listas de enlaces (clic-para-descubrir) | Todo el "qué pasó" visible sin navegar, precomputado |
| **Tablas** | Densas ASP.NET (Votaciones, Tabla Semanal) — muro de filas | Tiles resumidos con conteo + cobertura, enlace a la fuente para el detalle |
| **Honestidad de cobertura** | Ninguna — no declara frescura ni huecos | Cada tile: fuente + fecha + estado vacío honesto ("en las fuentes consultadas al [fecha]"); supresión con causa |
| **Sesgo de cámara** | Cada portal solo su cámara | Bicameral, cobertura por cámara declarada, SIN ranking cross-cámara (T-52-13) |
| **Tono** | Institucional/promocional ("Nuevo Portal", "Destacados") | Factual, cero insinuación de intención/causalidad |

**North star del loop diseño→crítica→loop:** el panel debe ser lo que estos portales NO son — un tablero de hechos legislativos recientes legible de un vistazo, con trazabilidad a la fuente, sin obligar a navegar ni leer prensa. Lo que heredamos de ellos: la seriedad institucional (paleta sobria petróleo/crema ya en tokens) SIN la densidad ni el editorializado.

---

## Iteración diseño→crítica aplicada

El componente `panel-actualidad.tsx` (Wave 2) ya materializa el "SUPERAR": tiles por señal con conteo font-mono, cobertura de cámara declarada como chip, footer "Fuente: … · datos al …", y fila de supresión con causa verbatim cuando la fuente no tiene novedades — exactamente lo que ninguno de los dos portales ofrece. El gate de lectura fría (PANEL-04, 100-BROWSEROS-GATE.md) valida sobre el deploy real que esto se lee "comprensible" para periodista/tramitador/ciudadano.
