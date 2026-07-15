/**
 * BENTO-04 — Guard CI de no-regresion: Firewall D3 + Exclusion /red (79-03)
 *
 * Dos invariantes congeladas:
 *
 * (A) FIREWALL D3: card.tsx NUNCA debe recibir `rounded-[var(--radius-tile)]`.
 *     El swap de radio bento va SOLO en call sites (clases extras en className);
 *     el primitivo card.tsx mantiene `rounded-lg` sin tocar. Si este guard falla,
 *     alguien metio el token bento DENTRO del primitivo, rompiendo la separacion
 *     D3 callsite-swap / primitivo-intocable.
 *
 * (B) EXCLUSION /red (invariante 4): red/page.tsx tiene DOS <main className="max-w-3xl ...">
 *     (rama picker/honest L82 y rama grafo L163). AMBOS deben seguir en max-w-3xl.
 *     /red queda EXCLUIDO del contenedor 1120px (mover /red a 1120px cambiaria el
 *     ancho disponible del grafo — layout B aprobado 2026-07-13 — sin beneficio
 *     de coherencia comparable). Si este guard falla, alguien propago
 *     max-w-[1120px] a /red o elimino el max-w-3xl propio.
 *
 * Patron de idioma: readFileSync + process.cwd() (NO import.meta.url —
 * leccion 45-01: jsdom rompe `new URL(import.meta.url)`).
 *
 * El gate visual real (getComputedStyle en deploy) es Phase 81.
 * Aqui solo los candados a nivel de clase/source.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// vitest corre desde app/ (vitest.config.ts vive ahi).
const APP_ROOT = process.cwd(); // app/

const CARD_PATH = path.join(APP_ROOT, "components", "ui", "card.tsx");
const RED_PAGE_PATH = path.join(APP_ROOT, "app", "red", "page.tsx");

// ---------------------------------------------------------------------------
// Detector puro (trabaja sobre strings en memoria, testeable sin disco)
// ---------------------------------------------------------------------------

interface CoherenciaOffender {
  eje: "FIREWALL" | "EXCLUSION-RED";
  descripcion: string;
}

/**
 * Detecta violaciones de los dos invariantes bento-coherencia.
 *
 * @param contenidoCard  Texto fuente de card.tsx
 * @param contenidoRed   Texto fuente de app/red/page.tsx
 * @returns Array de offenders (vacio = ningun problema)
 */
function detectarViolaciones(
  contenidoCard: string,
  contenidoRed: string,
): CoherenciaOffender[] {
  const offenders: CoherenciaOffender[] = [];

  // (A) FIREWALL D3: card.tsx no debe contener el token de radio bento.
  if (contenidoCard.includes("rounded-[var(--radius-tile)]")) {
    offenders.push({
      eje: "FIREWALL",
      descripcion:
        "card.tsx contiene `rounded-[var(--radius-tile)]` — el swap de radio bento debe ir SOLO en call sites, nunca en el primitivo (D3).",
    });
  }

  // (B) EXCLUSION /red: red/page.tsx no debe ensancharse a 1120px.
  if (contenidoRed.includes("max-w-[1120px]")) {
    offenders.push({
      eje: "EXCLUSION-RED",
      descripcion:
        "red/page.tsx contiene `max-w-[1120px]` — /red esta EXCLUIDO del contenedor bento (invariante 4); mantener max-w-3xl.",
    });
  }

  // (B) EXCLUSION /red: AMBOS <main> deben conservar max-w-3xl (count >= 2).
  // La verificacion de presencia simple no detecta una regresion parcial (un solo
  // <main> revertido a max-w-5xl/max-w-2xl mientras el otro sigue en max-w-3xl).
  const N_RED_MAINS = 2; // red/page.tsx L82 (picker/honest) + L163 (grafo)
  const count = (contenidoRed.match(/max-w-3xl/g) ?? []).length;
  if (count < N_RED_MAINS) {
    offenders.push({
      eje: "EXCLUSION-RED",
      descripcion:
        `red/page.tsx tiene ${count}/${N_RED_MAINS} <main> en max-w-3xl — ambos deben conservarlo (invariante 4).`,
    });
  }

  return offenders;
}

// ---------------------------------------------------------------------------
// (A) Test verde sobre archivos REALES (Plans 01+02 respetaron firewall y exclusion)
// ---------------------------------------------------------------------------

describe("(A) Guard bento-coherencia — archivos reales: 0 offenders", () => {
  const contenidoCard = readFileSync(CARD_PATH, "utf-8");
  const contenidoRed = readFileSync(RED_PAGE_PATH, "utf-8");

  it("card.tsx no tiene `rounded-[var(--radius-tile)]` (firewall D3 intacto)", () => {
    const offenders = detectarViolaciones(contenidoCard, contenidoRed).filter(
      (o) => o.eje === "FIREWALL",
    );
    expect(
      offenders,
      `Firewall D3 violado: ${offenders.map((o) => o.descripcion).join("; ")}`,
    ).toHaveLength(0);
  });

  it("red/page.tsx conserva max-w-3xl y NO tiene max-w-[1120px] (exclusion /red, invariante 4)", () => {
    const offenders = detectarViolaciones(contenidoCard, contenidoRed).filter(
      (o) => o.eje === "EXCLUSION-RED",
    );
    expect(
      offenders,
      `Exclusion /red violada: ${offenders.map((o) => o.descripcion).join("; ")}`,
    ).toHaveLength(0);
  });

  it("detector sobre archivos reales: 0 offenders en total", () => {
    const offenders = detectarViolaciones(contenidoCard, contenidoRed);
    expect(
      offenders,
      `Offenders encontrados: ${offenders.map((o) => `[${o.eje}] ${o.descripcion}`).join(" | ")}`,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// (B) Mutation self-check EN MEMORIA — prueba que el detector MUERDE
// ---------------------------------------------------------------------------

describe("(B) Mutation self-check — el detector muerde por ambos ejes", () => {
  // Card limpio (sin bento) y red limpio con DOS <main> en max-w-3xl —
  // refleja la estructura real: rama picker/honest L82 + rama grafo L163.
  // Un fixture de un solo <main> daria falsa confianza: count >= 2 no se ejerceria.
  const cardLimpio = `
import * as React from "react";
const Card = () => (
  <div className="rounded-lg border bg-card text-card-foreground shadow-sm" />
);
export { Card };
`.trim();

  const redLimpio = `
export default async function RedPage() {
  const mostrarGrafo = true;
  if (!mostrarGrafo) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1>Relaciones (picker)</h1>
      </main>
    );
  }
  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1>Relaciones (grafo)</h1>
    </main>
  );
}
`.trim();

  it("card mutado (con radius-tile) -> detecta FIREWALL", () => {
    const cardMutado =
      cardLimpio +
      '\nconst X = () => <div className="rounded-[var(--radius-tile)]" />;';
    const offenders = detectarViolaciones(cardMutado, redLimpio).filter(
      (o) => o.eje === "FIREWALL",
    );
    expect(
      offenders,
      "El detector NO detecto la mutacion de card.tsx con radius-tile — el guard no muerde",
    ).toHaveLength(1);
  });

  it("red mutado (con max-w-[1120px]) -> detecta EXCLUSION-RED", () => {
    const redMutado = redLimpio.replace("max-w-3xl", "max-w-[1120px]");
    const offenders = detectarViolaciones(cardLimpio, redMutado).filter(
      (o) => o.eje === "EXCLUSION-RED",
    );
    // Debe detectar: (a) tiene 1120px, (b) ya no tiene max-w-3xl
    expect(
      offenders.length,
      "El detector NO detecto la mutacion de red/page.tsx con 1120px — el guard no muerde",
    ).toBeGreaterThanOrEqual(1);
  });

  it("red mutado (sin max-w-3xl, sin 1120px) -> detecta EXCLUSION-RED por perdida de ancho propio", () => {
    const redSinAncho = redLimpio.replace("max-w-3xl", "max-w-2xl");
    const offenders = detectarViolaciones(cardLimpio, redSinAncho).filter(
      (o) => o.eje === "EXCLUSION-RED",
    );
    expect(
      offenders,
      "El detector NO detecto la perdida de max-w-3xl en red/page.tsx",
    ).toHaveLength(1);
  });

  it("ambas mutaciones a la vez -> detecta FIREWALL + EXCLUSION-RED", () => {
    const cardMutado =
      cardLimpio +
      '\nconst X = () => <div className="rounded-[var(--radius-tile)]" />;';
    const redMutado = redLimpio.replace("max-w-3xl", "max-w-[1120px]");
    const offenders = detectarViolaciones(cardMutado, redMutado);
    const ejes = offenders.map((o) => o.eje);
    expect(ejes).toContain("FIREWALL");
    expect(ejes).toContain("EXCLUSION-RED");
  });

  it("archivos limpios (sin mutacion) -> 0 offenders", () => {
    const offenders = detectarViolaciones(cardLimpio, redLimpio);
    expect(
      offenders,
      "El detector reporto falsos positivos sobre archivos limpios",
    ).toHaveLength(0);
  });
});
