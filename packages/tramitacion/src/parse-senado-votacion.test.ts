import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parseSenadoVotacion,
  parseSenadoVotaciones,
} from "./parse-senado-votacion";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "../test/fixtures");
const xml = readFileSync(join(FIXTURES, "senado-votacion.xml"), "utf8");

describe("parseSenadoVotacion (votaciones.php)", () => {
  it("Votacion con totales SI/NO/ABSTENCION/PAREO + quorum/tipo/etapa", () => {
    const { votacion } = parseSenadoVotacion(xml, "14309-04");
    expect(votacion.camara).toBe("senado");
    expect(votacion.total_si).toBe(30);
    expect(votacion.total_no).toBe(1);
    expect(votacion.total_abstencion).toBe(4);
    expect(votacion.total_pareo).toBe(0);
    expect(votacion.quorum).toBe("Mayoría simple");
    expect(votacion.tipo).toBe("Discusión general");
    expect(votacion.etapa).toBe("Segundo trámite constitucional");
  });

  it("fecha dd/mm/yyyy → ISO", () => {
    const { votacion } = parseSenadoVotacion(xml, "14309-04");
    expect(votacion.fecha).toMatch(/^2024-08-27T/);
  });

  it("votos crudos con mencionNombre trim + seleccion mapeada", () => {
    const { votos } = parseSenadoVotacion(xml, "14309-04");
    expect(votos.length).toBe(35);
    const coloma = votos[0];
    expect(coloma.mencionNombre).toBe("Coloma C., Juan Antonio");
    expect(coloma.seleccion).toBe("si");
    // Durana viene con whitespace final en la fuente → debe quedar trimmeado.
    const durana = votos.find((v) => v.mencionNombre.startsWith("Durana"));
    expect(durana?.mencionNombre).toBe("Durana S., José Miguel");
  });

  it("mapea No/Abstencion correctamente", () => {
    const { votos } = parseSenadoVotacion(xml, "14309-04");
    const pascual = votos.find((v) => v.mencionNombre.startsWith("Pascual"));
    expect(pascual?.seleccion).toBe("no");
    const provoste = votos.find((v) => v.mencionNombre.startsWith("Provoste"));
    expect(provoste?.seleccion).toBe("abstencion");
  });

  it("deriva boletín del param (no del TEMA con puntos de millar)", () => {
    const { votacion } = parseSenadoVotacion(xml, "14309-04");
    expect(votacion.boletin).toBe("14309-04");
    expect(votacion.id).toContain("14309-04");
  });
});

describe("parseSenadoVotaciones — caso vacío (Pitfall 2)", () => {
  it("XML sin votaciones → [] sin lanzar", () => {
    expect(parseSenadoVotaciones("<votaciones></votaciones>", "18296")).toEqual(
      [],
    );
  });
});
