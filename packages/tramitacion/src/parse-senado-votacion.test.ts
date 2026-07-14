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

  it("CR-02: cada voto crudo lleva un votoSeq posicional (índice en la fuente)", () => {
    const { votos } = parseSenadoVotacion(xml, "14309-04");
    expect(votos[0]!.votoSeq).toBe(0);
    expect(votos[1]!.votoSeq).toBe(1);
    const seqs = votos.map((v) => v.votoSeq);
    expect(new Set(seqs).size).toBe(votos.length); // únicos
  });
});

describe("parseSenadoVotaciones — caso vacío (Pitfall 2)", () => {
  it("XML sin votaciones → [] sin lanzar", () => {
    expect(parseSenadoVotaciones("<votaciones></votaciones>", "18296")).toEqual(
      [],
    );
  });
});

describe("CR-01: id único por votación (varias votaciones el mismo día)", () => {
  // Dos <votacion> del MISMO boletín y MISMA fecha pero distinta TIPOVOTACION
  // (en general + en particular): sus ids NO deben colisionar.
  const dosMismoDia = `<votaciones>
    <votacion><SESION>47/372</SESION><FECHA>27/08/2024</FECHA><TEMA>x</TEMA><SI>30</SI><NO>1</NO><ABSTENCION>0</ABSTENCION><PAREO>0</PAREO><TIPOVOTACION>Discusión general</TIPOVOTACION><ETAPA>Segundo trámite</ETAPA><DETALLE_VOTACION><VOTO><PARLAMENTARIO>A B., C</PARLAMENTARIO><SELECCION>Si</SELECCION></VOTO></DETALLE_VOTACION></votacion>
    <votacion><SESION>47/372</SESION><FECHA>27/08/2024</FECHA><TEMA>x</TEMA><SI>28</SI><NO>3</NO><ABSTENCION>0</ABSTENCION><PAREO>0</PAREO><TIPOVOTACION>Discusión particular</TIPOVOTACION><ETAPA>Segundo trámite</ETAPA><DETALLE_VOTACION><VOTO><PARLAMENTARIO>A B., C</PARLAMENTARIO><SELECCION>No</SELECCION></VOTO></DETALLE_VOTACION></votacion>
  </votaciones>`;

  it("dos votaciones del mismo día/boletín → ids DISTINTOS", () => {
    const out = parseSenadoVotaciones(dosMismoDia, "14309-04");
    expect(out).toHaveLength(2);
    expect(out[0]!.votacion.id).not.toBe(out[1]!.votacion.id);
    expect(out[0]!.votacion.id).toContain("14309-04");
    expect(out[1]!.votacion.id).toContain("14309-04");
  });

  it("idempotencia: re-parsear el mismo XML produce los MISMOS ids", () => {
    const a = parseSenadoVotaciones(dosMismoDia, "14309-04");
    const b = parseSenadoVotaciones(dosMismoDia, "14309-04");
    expect(a.map((x) => x.votacion.id)).toEqual(b.map((x) => x.votacion.id));
  });

  it("metadata idéntica → el índice posicional desambigua igualmente", () => {
    const identicas = `<votaciones>
      <votacion><SESION>1/1</SESION><FECHA>01/01/2026</FECHA><TEMA>x</TEMA><SI>1</SI><NO>0</NO><ABSTENCION>0</ABSTENCION><PAREO>0</PAREO><TIPOVOTACION>T</TIPOVOTACION><ETAPA>E</ETAPA><QUORUM>Q</QUORUM><DETALLE_VOTACION><VOTO><PARLAMENTARIO>A B., C</PARLAMENTARIO><SELECCION>Si</SELECCION></VOTO></DETALLE_VOTACION></votacion>
      <votacion><SESION>1/1</SESION><FECHA>01/01/2026</FECHA><TEMA>x</TEMA><SI>1</SI><NO>0</NO><ABSTENCION>0</ABSTENCION><PAREO>0</PAREO><TIPOVOTACION>T</TIPOVOTACION><ETAPA>E</ETAPA><QUORUM>Q</QUORUM><DETALLE_VOTACION><VOTO><PARLAMENTARIO>A B., C</PARLAMENTARIO><SELECCION>No</SELECCION></VOTO></DETALLE_VOTACION></votacion>
    </votaciones>`;
    const out = parseSenadoVotaciones(identicas, "99999-01");
    expect(out[0]!.votacion.id).not.toBe(out[1]!.votacion.id);
  });
});

describe("WR-04: total presente pero ilegible NO se fabrica como un número falso", () => {
  it("un SI con separador de millar ('1.234') NO se trunca a 1 → cae a 0 (señal, no dato falso)", () => {
    // `Number("1.234")` = 1.234 → el código viejo truncaba a 1 (un total inventado). Ahora,
    // al no ser un entero limpio, no se fabrica un "1": se reporta 0 (ausencia de dato fiable).
    const xmlMal = `<votaciones>
      <votacion><SESION>1/1</SESION><FECHA>01/01/2026</FECHA><TEMA>x</TEMA><SI>1.234</SI><NO>2</NO><ABSTENCION>0</ABSTENCION><PAREO>0</PAREO><TIPOVOTACION>T</TIPOVOTACION><ETAPA>E</ETAPA><DETALLE_VOTACION></DETALLE_VOTACION></votacion>
    </votaciones>`;
    const { votacion } = parseSenadoVotacion(xmlMal, "99999-01");
    expect(votacion.total_si).toBe(0); // NO 1
    expect(votacion.total_no).toBe(2); // un entero limpio sí se conserva
  });

  it("un total ausente sigue siendo 0 legítimo", () => {
    const xmlSin = `<votaciones>
      <votacion><SESION>1/1</SESION><FECHA>01/01/2026</FECHA><TEMA>x</TEMA><NO>2</NO><ABSTENCION>0</ABSTENCION><PAREO>0</PAREO><TIPOVOTACION>T</TIPOVOTACION><ETAPA>E</ETAPA><DETALLE_VOTACION></DETALLE_VOTACION></votacion>
    </votaciones>`;
    const { votacion } = parseSenadoVotacion(xmlSin, "99999-01");
    expect(votacion.total_si).toBe(0);
  });
});

describe("WR-01 (P67): token <SELECCION> desconocido se reporta PER-VOTO sin borrar el roll-call", () => {
  // Un token PRESENTE pero no reconocido ("A FAVOR", "AF", un código) NO se omite en silencio
  // (mentira de cobertura) NI lanza a través de todo el parse (WR-01: eso borraba el boletín
  // entero — se perdían N-1 votos válidos). Ahora se captura per-voto en `tokensDesconocidos` con
  // el token crudo y la mención → el shape LIVE inesperado es VISIBLE (runIngest lo sube a
  // `errores`), y los votos hermanos válidos SOBREVIVEN.
  const conDesconocidoYVecino = (token: string) => `<votaciones>
    <votacion><SESION>1/1</SESION><FECHA>01/01/2026</FECHA><TEMA>x</TEMA><SI>1</SI><NO>0</NO><ABSTENCION>0</ABSTENCION><PAREO>0</PAREO><TIPOVOTACION>T</TIPOVOTACION><ETAPA>E</ETAPA><DETALLE_VOTACION><VOTO><PARLAMENTARIO>Persona P., Real</PARLAMENTARIO><SELECCION>${token}</SELECCION></VOTO><VOTO><PARLAMENTARIO>Vecino V., Valido</PARLAMENTARIO><SELECCION>Si</SELECCION></VOTO></DETALLE_VOTACION></votacion>
  </votaciones>`;

  it("token desconocido 'A FAVOR' → NO lanza; aparece en tokensDesconocidos con el token crudo", () => {
    let out!: ReturnType<typeof parseSenadoVotaciones>;
    expect(() => {
      out = parseSenadoVotaciones(conDesconocidoYVecino("A FAVOR"), "99999-01");
    }).not.toThrow();
    const v0 = out[0]!;
    expect(v0.tokensDesconocidos).toHaveLength(1);
    expect(v0.tokensDesconocidos[0]!.token).toBe("A FAVOR");
    expect(v0.tokensDesconocidos[0]!.mencionNombre).toBe("Persona P., Real");
    // WR-01: el voto válido HERMANO sobrevive (no se borra el roll-call por un token novedoso).
    expect(v0.votos).toHaveLength(1);
    expect(v0.votos[0]!.mencionNombre).toBe("Vecino V., Valido");
    expect(v0.votos[0]!.seleccion).toBe("si");
  });

  it("token desconocido numérico ('9') → capturado en tokensDesconocidos, hermano sobrevive", () => {
    const out = parseSenadoVotaciones(conDesconocidoYVecino("9"), "99999-01");
    expect(out[0]!.tokensDesconocidos.map((t) => t.token)).toEqual(["9"]);
    expect(out[0]!.votos).toHaveLength(1);
  });

  it("<SELECCION> VACÍO/ausente → NO lanza NI genera diagnóstico (se omite legítimamente)", () => {
    const conVacioYAusente = `<votaciones>
      <votacion><SESION>1/1</SESION><FECHA>01/01/2026</FECHA><TEMA>x</TEMA><SI>1</SI><NO>0</NO><ABSTENCION>0</ABSTENCION><PAREO>0</PAREO><TIPOVOTACION>T</TIPOVOTACION><ETAPA>E</ETAPA><DETALLE_VOTACION><VOTO><PARLAMENTARIO>Valido V., Uno</PARLAMENTARIO><SELECCION>Si</SELECCION></VOTO><VOTO><PARLAMENTARIO>Blanco B., Dos</PARLAMENTARIO><SELECCION></SELECCION></VOTO><VOTO><PARLAMENTARIO>SinSel S., Tres</PARLAMENTARIO></VOTO></DETALLE_VOTACION></votacion>
    </votaciones>`;
    let sv!: ReturnType<typeof parseSenadoVotaciones>[number];
    expect(() => {
      sv = parseSenadoVotaciones(conVacioYAusente, "99999-01")[0]!;
    }).not.toThrow();
    // Solo el 'Si' válido sobrevive; vacío y ausente se omiten SIN diagnóstico (no son desconocidos).
    expect(sv.votos).toHaveLength(1);
    expect(sv.votos[0]!.mencionNombre).toBe("Valido V., Uno");
    expect(sv.tokensDesconocidos).toHaveLength(0);
  });

  it("tokens conocidos (Sí/No/Abstención/Pareo) siguen mapeando sin regresión NI diagnóstico", () => {
    const conocidos = `<votaciones>
      <votacion><SESION>1/1</SESION><FECHA>01/01/2026</FECHA><TEMA>x</TEMA><SI>1</SI><NO>1</NO><ABSTENCION>1</ABSTENCION><PAREO>1</PAREO><TIPOVOTACION>T</TIPOVOTACION><ETAPA>E</ETAPA><DETALLE_VOTACION><VOTO><PARLAMENTARIO>Uno U., A</PARLAMENTARIO><SELECCION>Sí</SELECCION></VOTO><VOTO><PARLAMENTARIO>Dos D., B</PARLAMENTARIO><SELECCION>No</SELECCION></VOTO><VOTO><PARLAMENTARIO>Tres T., C</PARLAMENTARIO><SELECCION>Abstención</SELECCION></VOTO><VOTO><PARLAMENTARIO>Cuatro C., D</PARLAMENTARIO><SELECCION>Pareo</SELECCION></VOTO></DETALLE_VOTACION></votacion>
    </votaciones>`;
    const { votos, tokensDesconocidos } = parseSenadoVotacion(conocidos, "99999-01");
    expect(votos.map((v) => v.seleccion)).toEqual(["si", "no", "abstencion", "pareo"]);
    expect(tokensDesconocidos).toHaveLength(0);
  });
});

describe("IN-03 (P67): 'No vota' NO se mis-mapea a `no` (atribución falsa de voto en contra)", () => {
  const conToken = (token: string) => `<votaciones>
    <votacion><SESION>1/1</SESION><FECHA>01/01/2026</FECHA><TEMA>x</TEMA><SI>0</SI><NO>1</NO><ABSTENCION>0</ABSTENCION><PAREO>0</PAREO><TIPOVOTACION>T</TIPOVOTACION><ETAPA>E</ETAPA><DETALLE_VOTACION><VOTO><PARLAMENTARIO>Ausente A., Uno</PARLAMENTARIO><SELECCION>${token}</SELECCION></VOTO></DETALLE_VOTACION></votacion>
  </votaciones>`;

  it("'No vota' → `ausente` (NO `no`), en simetría con la Cámara", () => {
    const { votos } = parseSenadoVotacion(conToken("No vota"), "99999-01");
    expect(votos).toHaveLength(1);
    expect(votos[0]!.seleccion).toBe("ausente");
    expect(votos[0]!.seleccion).not.toBe("no");
  });

  it("'No' pelado → `no` (contra) sigue funcionando", () => {
    const { votos } = parseSenadoVotacion(conToken("No"), "99999-01");
    expect(votos[0]!.seleccion).toBe("no");
  });

  it("'Sin voto' y 'Ausente' → `ausente` (variantes de ausencia)", () => {
    expect(parseSenadoVotacion(conToken("Sin voto"), "99999-01").votos[0]!.seleccion).toBe(
      "ausente",
    );
    expect(parseSenadoVotacion(conToken("Ausente"), "99999-01").votos[0]!.seleccion).toBe(
      "ausente",
    );
  });
});
