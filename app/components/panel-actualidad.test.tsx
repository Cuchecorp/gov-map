import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { rotuloFecha, type SenalRow } from "./panel-actualidad";
import { parseEvidenciaProyectos, urgenciaVigentePorBoletin } from "@/lib/panel-evidencia";
import { PanelTileSala } from "./panel-tile-sala";
import { PanelTileComisiones } from "./panel-tile-comisiones";
import { PanelTileUrgencias } from "./panel-tile-urgencias";
import { PanelTileMovimiento } from "./panel-tile-movimiento";
import { PanelTileVotacionesView, type VotacionPanelItem } from "./panel-tile-votaciones";
import { PanelTileIngresos } from "./panel-tile-ingresos";

afterEach(cleanup);

// ── Fixture SenalRow — grafía viva (127): "Cámara de Diputados" / "Senado" ──────
// `evidencia` con payload REALISTA (no `{}`) — P5/fixture stale del research.
function makeSenal(overrides: Partial<SenalRow> = {}): SenalRow {
  return {
    tipo_senal: "velocity",
    ventana: "7d",
    conteo: 2,
    cobertura_camara: "Cámara de Diputados",
    materia: null,
    cluster_id: null,
    fecha_max: "2026-07-24T14:30:00Z",
    supresion_causa: null,
    evidencia: {
      items: [
        {
          fecha: "2026-07-24",
          enlace: "https://tramitacion.senado.cl/wspublico/tramitacion.php",
          titulo: "Modifica el Código Penal en materia de ciberdelitos",
          boletin: "16569-25",
          en_corpus: true,
          descripcion: null,
          enlace_evento: null,
        },
      ],
      total: 1,
      consultado_al: "2026-07-30",
      fuente: { origen: "plataforma-tramitacion", dataset: "tramitacion" },
    },
    ...overrides,
  };
}

// ── Composición del panel completo — vistas puras compuestas en el orden D-01 ──
// (128-RESEARCH: "los tiles reciben filas como props" — cero DB, cero mocks de
// red). Replica el ruteo whitelist + cruce L5 de `PanelActualidad`, EXACTAMENTE
// como lo hace el orquestador, sobre fixtures fijos.
function construirPanel(filas: SenalRow[]) {
  const TIPOS_RENDERIZADOS = new Set([
    "agenda_sala",
    "agenda_citacion",
    "urgencias",
    "velocity",
    "nuevos_ingresos",
    "archivados",
  ]);
  const porTipo = new Map<string, SenalRow[]>();
  for (const f of filas) {
    if (!TIPOS_RENDERIZADOS.has(f.tipo_senal)) continue;
    const arr = porTipo.get(f.tipo_senal);
    if (arr) arr.push(f);
    else porTipo.set(f.tipo_senal, [f]);
  }
  const filasSala = porTipo.get("agenda_sala") ?? [];
  const filasComisiones = porTipo.get("agenda_citacion") ?? [];
  const filasUrgencias = porTipo.get("urgencias") ?? [];
  const filasMovimiento = porTipo.get("velocity") ?? [];
  const filasIngresos = porTipo.get("nuevos_ingresos") ?? [];
  const filasArchivados = porTipo.get("archivados") ?? [];

  const itemsUrgencias = filasUrgencias.flatMap(
    (f) => parseEvidenciaProyectos(f.evidencia).items,
  );
  const urgencias = urgenciaVigentePorBoletin(itemsUrgencias);

  const stubVotacion: VotacionPanelItem = {
    id: "1",
    boletin: "18216-05",
    titulo: "Reforma pensiones",
    fecha: new Date("2026-07-22T00:00:00Z"),
    camara: "Cámara de Diputados",
    resultado: "Aprobado",
    si: 80,
    no: 48,
    abstencion: 2,
    pareo: 0,
  };

  return (
    <>
      <PanelTileSala filas={filasSala} urgencias={urgencias} />
      <PanelTileComisiones filas={filasComisiones} urgencias={urgencias} />
      <PanelTileUrgencias filas={filasUrgencias} />
      <PanelTileMovimiento filas={filasMovimiento} />
      <PanelTileVotacionesView
        items={[stubVotacion]}
        fechaFuente={stubVotacion.fecha}
      />
      <PanelTileIngresos ingresos={filasIngresos} archivados={filasArchivados} />
    </>
  );
}

const FILA_SALA = makeSenal({
  tipo_senal: "agenda_sala",
  cobertura_camara: "Senado",
  conteo: 1,
  fecha_max: "2026-08-04T00:00:00Z",
  evidencia: {
    items: [
      {
        fecha: "2026-08-04",
        tipo: "Ordinaria",
        numero: "47",
        hora_inicio: "16:00",
        enlace: "https://web-back.senado.cl/api/weekly_table?limit=100",
        tabla_total: 1,
        tabla: [
          {
            boletin: "14782-13",
            titulo: "Equipara el derecho de sala cuna",
            enlace: "https://tramitacion.senado.cl/wspublico/tramitacion.php",
            materia: "Proyecto de ley sobre sala cuna",
            posicion: 1,
            quorum: "5",
            en_corpus: true,
            parte_sesion: "ORDEN DEL DÍA",
          },
        ],
      },
    ],
    total: 1,
    consultado_al: "2026-07-30",
    fuente: { origen: "plataforma-agenda", dataset: "agenda" },
  },
});

const FILA_COMISIONES = makeSenal({
  tipo_senal: "agenda_citacion",
  cobertura_camara: "Senado",
  conteo: 1,
  fecha_max: "2026-08-03T00:00:00Z",
  evidencia: {
    items: [
      {
        fecha: "2026-08-03",
        enlace: "https://web-back.senado.cl/api/commissions_citations?limit=100",
        comision: "de Medio Ambiente, Cambio Climático y Bienes Nacionales",
        horario: "12:30 a 14:00",
        semana_iso: "2026-W32",
        puntos_total: 1,
        puntos: [
          {
            boletin: "14782-13",
            titulo: "Equipara el derecho de sala cuna",
            enlace: "https://tramitacion.senado.cl/wspublico/tramitacion.php",
            materia: "Equipara el derecho de sala cuna",
            posicion: 0,
            en_corpus: true,
          },
        ],
      },
    ],
    total: 1,
    consultado_al: "2026-07-30",
    fuente: { origen: "plataforma-agenda", dataset: "agenda" },
  },
});

const FILA_URGENCIAS = makeSenal({
  tipo_senal: "urgencias",
  cobertura_camara: null,
  conteo: 1,
  fecha_max: "2026-07-28T00:00:00Z",
  evidencia: {
    items: [
      {
        fecha: "2026-07-28",
        enlace: "https://tramitacion.senado.cl/wspublico/tramitacion.php",
        titulo: "Equipara el derecho de sala cuna",
        boletin: "14782-13",
        en_corpus: true,
        descripcion: "Suma",
        enlace_evento: null,
      },
    ],
    total: 1,
    consultado_al: "2026-07-30",
    fuente: { origen: "plataforma-tramitacion", dataset: "tramitacion" },
  },
});

const FILA_MOVIMIENTO = makeSenal({ tipo_senal: "velocity" });

const FILA_INGRESOS_SUPRIMIDA = makeSenal({
  tipo_senal: "nuevos_ingresos",
  cobertura_camara: "2022-2026 (piso de corpus)",
  conteo: 0,
  fecha_max: "2026-07-28T00:00:00Z",
  supresion_causa: "sin nuevos ingresos fechados en la ventana",
  evidencia: {},
});

const FILA_ARCHIVADOS = makeSenal({
  tipo_senal: "archivados",
  cobertura_camara: null,
  conteo: 1,
  fecha_max: "2026-07-06T00:00:00Z",
  evidencia: {
    items: [
      {
        fecha: "2026-07-06",
        enlace: "https://tramitacion.senado.cl/wspublico/tramitacion.php",
        titulo: "Modifica cuerpos legales varios",
        boletin: "16725-06",
        en_corpus: true,
        descripcion: "Cuenta, Comunicación de la diputada Romero",
        enlace_evento: null,
      },
    ],
    total: 1,
    consultado_al: "2026-07-30",
    fuente: { origen: "plataforma-tramitacion", dataset: "tramitacion" },
  },
});

const FILA_MATERIA = makeSenal({
  tipo_senal: "agrupacion_materia",
  cobertura_camara: null,
  conteo: 452,
  materia: "(sin materia)",
  cluster_id: 3,
  fecha_max: null,
  evidencia: {},
});

const FILAS_TODAS: SenalRow[] = [
  FILA_SALA,
  FILA_COMISIONES,
  FILA_URGENCIAS,
  FILA_MOVIMIENTO,
  FILA_INGRESOS_SUPRIMIDA,
  FILA_ARCHIVADOS,
  FILA_MATERIA,
];

describe("PanelActualidad — composición del panel completo (D-01/O-3/O-5)", () => {
  it("filtra agrupacion_materia EXPLÍCITAMENTE: cero '(sin materia)' y cero heading 'Por materia'; control positivo: otros tiles SÍ se renderizan", () => {
    const { container } = render(<>{construirPanel(FILAS_TODAS)}</>);
    expect(container.textContent).not.toContain("(sin materia)");
    expect(
      container.querySelector('h2, h3')?.textContent !== "Por materia",
    ).toBe(true);
    expect(container.textContent).not.toMatch(/Por materia/);
    // Control positivo: los otros tiles sí se montan.
    expect(container.textContent).toContain("En tabla de sala esta semana");
    expect(container.textContent).toContain("Movimiento reciente");
  });

  it("NO contiene 'datos al'; control positivo: 'según fuente al' aparece al menos una vez", () => {
    const { container } = render(<>{construirPanel(FILAS_TODAS)}</>);
    expect(container.textContent).not.toContain("datos al");
    expect(container.textContent).toMatch(/según fuente al/);
  });

  it("NO contiene 'fecha_captura'; control positivo: la fecha del hecho SÍ aparece", () => {
    const { container } = render(<>{construirPanel(FILAS_TODAS)}</>);
    expect(container.textContent).not.toContain("fecha_captura");
    expect(container.textContent).toContain("24 jul 2026"); // movimiento
  });

  it("orden del DOM: sala → comisiones → urgencias → movimiento → votaciones → ingresos (O-5/D-01)", () => {
    const { container } = render(<>{construirPanel(FILAS_TODAS)}</>);
    const titulos = Array.from(container.querySelectorAll("h2")).map(
      (h) => h.textContent,
    );
    expect(titulos).toEqual([
      "En tabla de sala esta semana",
      "Comisiones citadas esta semana",
      "Urgencias del Ejecutivo, por grado",
      "Movimiento reciente",
      "Votaciones recientes",
      "Ingresos, archivos y retiros",
    ]);
  });

  it("los chips L5 aparecen en los tiles 1 y 2 cuando el boletín tiene urgencia vigente", () => {
    const { container } = render(<>{construirPanel(FILAS_TODAS)}</>);
    // 14782-13 aparece en sala (chip L5), comisiones (chip L5) y en el propio
    // tile de urgencias (su detalle nativo, no un chip) — las 3 ocurrencias
    // usan el mismo molde fechado, control de que el cruce es consistente.
    const chips = container.textContent?.match(/Urgencia Suma fechada el 28 jul 2026/g);
    expect(chips?.length).toBe(3);
  });

  it("señal SUPRIMIDA (nuevos_ingresos): causa verbatim + 'en las fuentes consultadas al', cero '0' mudo", () => {
    const { container } = render(<>{construirPanel(FILAS_TODAS)}</>);
    expect(container.textContent).toContain(
      "sin nuevos ingresos fechados en la ventana",
    );
    expect(container.textContent).toContain("en las fuentes consultadas al");
    expect(container.querySelector("h3 + p")?.textContent).not.toBe("0");
  });

  it("WR-01: cero tokens internos de ventana ('30d'/'futuras') en el DOM", () => {
    const { container } = render(<>{construirPanel(FILAS_TODAS)}</>);
    expect(container.textContent).not.toContain("30d");
    expect(container.textContent).not.toContain("futuras");
  });

  it("ausencia de vocabulario de ranking ('top', 'los más', 'la cámara más activa')", () => {
    const { container } = render(<>{construirPanel(FILAS_TODAS)}</>);
    expect(container.textContent?.toLowerCase()).not.toMatch(/\btop\b/);
    expect(container.textContent?.toLowerCase()).not.toContain("los más");
    expect(container.textContent?.toLowerCase()).not.toContain(
      "la cámara más activa",
    );
  });

  it("cada uno de los 6 tiles aparece exactamente una vez (cero duplicados, cero omisiones)", () => {
    const { container } = render(<>{construirPanel(FILAS_TODAS)}</>);
    const titulos = Array.from(container.querySelectorAll("h2")).map(
      (h) => h.textContent,
    );
    expect(titulos).toHaveLength(6);
    expect(new Set(titulos).size).toBe(6);
  });

  it("boletín SIN urgencia vigente en el Map → sin chip L5 (jamás 'sin urgencia' fabricado)", () => {
    // 16569-25 (movimiento) no tiene urgencia registrada en FILA_URGENCIAS.
    const { container } = render(<>{construirPanel(FILAS_TODAS)}</>);
    expect(container.textContent).not.toContain("sin urgencia");
  });

  it("agrupacion_materia SOLA (sin otras señales) → panel vacío honesto, jamás crashea", () => {
    const { container } = render(<>{construirPanel([FILA_MATERIA])}</>);
    expect(container.textContent).not.toContain("(sin materia)");
    expect(container.textContent).not.toMatch(/Por materia/);
    // Los tiles restantes se montan igual (con sus propios vacíos honestos).
    expect(container.textContent).toContain("En tabla de sala esta semana");
  });
});

// ── F-14 — la fecha del panel se rinde en es-CL, no como ISO crudo (CONSERVADO) ─
describe("F-14 — rotuloFecha: es-CL para público general y prensa", () => {
  it("señal agenda_* a medianoche UTC → '10 ago 2026' (con AÑO), jamás el ISO crudo", () => {
    const rot = rotuloFecha("agenda_citacion", "2026-08-10T00:00:00Z");
    expect(rot).toBe("10 ago 2026");
    expect(rot).not.toContain("2026-08-10");
  });

  it("señal de otro tipo a medianoche UTC → el día sigue siendo el 10 (no se corre al 9)", () => {
    const rot = rotuloFecha("velocity", "2026-08-10T00:00:00Z");
    expect(rot).toContain("10");
    expect(rot).toContain("ago");
    expect(rot).not.toContain("09");
  });

  it("fecha_max NULL (agrupacion_materia) → null: la ausencia honesta no se rellena", () => {
    expect(rotuloFecha("agrupacion_materia", null)).toBeNull();
  });

  // WR-05 (117-REVIEW): las dos ramas se listan una junto a otra en el MISMO panel.
  // Dos convenciones distintas —una sin año— hacían que el ciudadano leyera la señal
  // de agenda como si fuera del año en curso.
  it("ambas ramas usan el MISMO formato, y ninguna omite el año", () => {
    const agenda = rotuloFecha("agenda_citacion", "2026-08-10T00:00:00Z");
    const otro = rotuloFecha("velocity", "2026-08-10T00:00:00Z");
    expect(agenda).toBe(otro);
    expect(agenda).toContain("2026");
    expect(otro).toContain("2026");
    // El badge compacto sin año ("10-ago") queda reservado a /agenda.
    expect(agenda).not.toMatch(/^\d{2}-[a-z]{3}$/);
  });

  it("rótulo agenda_* en el DOM (tile sala): muestra '04 ago 2026' y no el ISO", () => {
    const { container } = render(
      <PanelTileSala filas={[FILA_SALA]} urgencias={new Map()} />,
    );
    expect(container.textContent).toContain("04 ago 2026");
    expect(container.textContent).not.toContain("2026-08-04");
  });
});

// ── Evidencia de cierre (D-10, Task 3) — volcado DOM del panel completo ────────
// El HTML resultante es el instrumento de los 5 greps normalizados de la fase.
// Los mismos 5 controles se assertan EN-PROCESO aquí (para que CI los muerda
// aunque nadie corra el shell) y se repiten sobre el archivo vía `<verify>`.
//
// ⚠ React intercala `<!-- -->` entre expresiones adyacentes: los literales
// grepeados no cruzan una interpolación (`datos al`, `según fuente al`,
// `(sin materia)`, `fecha_captura`, `href="/proyecto/`).
describe("Evidencia de cierre — volcado DOM (D-10)", () => {
  it("escribe app/.artifacts/panel-render.html y los 5 controles dan verde", () => {
    const { container } = render(<>{construirPanel(FILAS_TODAS)}</>);
    const html = container.innerHTML;

    const artifactsDir = join(process.cwd(), ".artifacts");
    mkdirSync(artifactsDir, { recursive: true });
    writeFileSync(join(artifactsDir, "panel-render.html"), html, "utf-8");

    // 1. "datos al" = 0 (molde muerto con TileSenal).
    expect(html).not.toContain("datos al");
    // 2. "según fuente al" >= 1 (control positivo apareado).
    expect(html.match(/según fuente al/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
    // 3. "(sin materia)" = 0 (filtro explícito de agrupacion_materia, O-3).
    expect(html).not.toContain("(sin materia)");
    // 4. "fecha_captura" = 0 (jamás visible).
    expect(html).not.toContain("fecha_captura");
    // 5. 'href="/proyecto/' >= 1 (links vía helper central, guard en_corpus).
    expect(html.match(/href="\/proyecto\//g)?.length ?? 0).toBeGreaterThanOrEqual(1);
  });
});
