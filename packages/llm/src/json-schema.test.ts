import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zodToToolSchema } from "./json-schema";

const schema = z.object({
  decision: z.enum(["match", "no_match"]),
  confidence: z.number(),
});

describe("zodToToolSchema", () => {
  it("deriva un JSON schema con type/properties/required desde el zod", () => {
    const json = zodToToolSchema(schema) as {
      type: string;
      properties: Record<string, unknown>;
      required: string[];
    };
    expect(json.type).toBe("object");
    expect(json.properties).toHaveProperty("decision");
    expect(json.properties).toHaveProperty("confidence");
    expect(json.required).toContain("decision");
    expect(json.required).toContain("confidence");
  });

  it("no incluye la meta-clave $schema (params de function-calling planos)", () => {
    const json = zodToToolSchema(schema);
    expect(json).not.toHaveProperty("$schema");
  });
});
