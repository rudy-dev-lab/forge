// ─────────────────────────────────────────────────────────────────────────────
// Test d'intégration : pipeline complet CSV/JSON → JSON
// Pas de DB nécessaire — utilise des fichiers temporaires
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { PipelineBuilder } from "../src/pipeline/PipelineBuilder.js";
import { PipelineTemplate } from "../src/pipeline/PipelineTemplate.js";

const TMP_DIR = "/tmp/forge-tests";
const INPUT_JSON = `${TMP_DIR}/input.json`;
const OUTPUT_JSON = `${TMP_DIR}/output.json`;

const testData = [
  { id: 1, name: "Alice", age: 25, email: "alice@test.com", status: "active" },
  { id: 2, name: "Bob", age: 15, email: "bob@test.com", status: "active" },
  { id: 3, name: "Charlie", age: 32, email: "charlie@test.com", status: "inactive" },
  { id: 4, name: "Alice", age: 25, email: "alice@test.com", status: "active" }, // Doublon id=1
  { id: 5, name: "Diana", age: 28, email: "diana@test.com", status: "active" },
];

beforeAll(() => {
  mkdirSync(TMP_DIR, { recursive: true });
  writeFileSync(INPUT_JSON, JSON.stringify(testData), "utf-8");
});

afterAll(() => {
  if (existsSync(INPUT_JSON)) unlinkSync(INPUT_JSON);
  if (existsSync(OUTPUT_JSON)) unlinkSync(OUTPUT_JSON);
});

describe("Pipeline Integration (Builder + Factory + Prototype + Run)", () => {
  it("exécute un pipeline JSON → JSON complet avec filter + deduplicate", async () => {
    const pipeline = new PipelineBuilder()
      .name("integration_test")
      .from("json", { filePath: INPUT_JSON })
      .filter("age > 18")          // Exclut Bob (age=15)
      .deduplicate("email")         // Exclut le doublon Alice
      .to("json", { filePath: OUTPUT_JSON })
      .build();

    const result = await pipeline.run();

    expect(result.status).toBe("success");
    expect(result.rowsRead).toBe(5);      // 5 rows lus
    expect(result.rowsWritten).toBe(3);   // Alice, Charlie, Diana (Bob exclu, doublon exclu)
    expect(result.rowsFailed).toBe(0);
    expect(result.duration).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
    expect(result.startedAt).toBeInstanceOf(Date);
    expect(result.completedAt).toBeInstanceOf(Date);

    // Vérifie le contenu du fichier de sortie
    const output = JSON.parse(readFileSync(OUTPUT_JSON, "utf-8"));
    expect(output).toHaveLength(3);
    expect(output.map((r: any) => r.name)).toContain("Alice");
    expect(output.map((r: any) => r.name)).not.toContain("Bob");
  });

  it("le dry-run ne crée pas le fichier de sortie", async () => {
    if (existsSync(OUTPUT_JSON)) unlinkSync(OUTPUT_JSON);

    const pipeline = new PipelineBuilder()
      .name("dry_run_test")
      .from("json", { filePath: INPUT_JSON })
      .to("json", { filePath: OUTPUT_JSON })
      .dryRun()
      .build();

    const result = await pipeline.run();

    expect(result.status).toBe("success");
    expect(result.rowsWritten).toBe(0); // Dry run = 0 écrits
    expect(existsSync(OUTPUT_JSON)).toBe(false); // Fichier non créé
  });

  it("Prototype : le clone dry-run ne modifie pas l'original", async () => {
    const master = new PipelineBuilder()
      .name("master")
      .from("json", { filePath: INPUT_JSON })
      .filter("age > 18")
      .to("json", { filePath: OUTPUT_JSON })
      .build();

    const template = new PipelineTemplate(master);
    const dryRun = template.asDryRun();

    // Exécute le dry-run
    const dryResult = await dryRun.run();
    expect(dryResult.rowsWritten).toBe(0);
    expect(dryRun.options.dryRun).toBe(true);

    // L'original reste inchangé
    expect(master.options.dryRun).toBe(false);
    expect(master.name).toBe("master"); // Pas "master_dryrun"
  });

  it("pipeline échoue proprement si le fichier source n'existe pas", async () => {
    const pipeline = new PipelineBuilder()
      .name("fail_test")
      .from("json", { filePath: "/tmp/nonexistent_999.json" })
      .to("json", { filePath: OUTPUT_JSON })
      .build();

    const result = await pipeline.run();

    expect(result.status).toBe("failed");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatch(/not found/i);
  });
});
