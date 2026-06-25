// ─────────────────────────────────────────────────────────────────────────────
// Tests du pattern Builder — PipelineBuilder
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { PipelineBuilder, PipelineBuilderError } from "../src/pipeline/PipelineBuilder.js";

describe("PipelineBuilder (Builder)", () => {
  // Helper : un builder minimal valide
  const validBuilder = () =>
    new PipelineBuilder()
      .name("test_pipeline")
      .from("csv", { filePath: "./data/in.csv" })
      .to("json", { filePath: "./data/out.json" });

  it("construit un Pipeline valide avec l'API fluent", () => {
    const pipeline = validBuilder().build();

    expect(pipeline.id).toBeDefined();
    expect(pipeline.name).toBe("test_pipeline");
    expect(pipeline.source.type).toBe("csv");
    expect(pipeline.destination.type).toBe("json");
    expect(pipeline.steps).toHaveLength(0);
    expect(pipeline.options.batchSize).toBe(500); // Défaut
    expect(pipeline.options.dryRun).toBe(false);  // Défaut
  });

  it("chaîne les steps dans l'ordre d'appel", () => {
    const pipeline = validBuilder()
      .filter("age > 18")
      .deduplicate("email")
      .validate({ name: "string" })
      .build();

    expect(pipeline.steps).toHaveLength(3);
    expect(pipeline.steps[0].type).toBe("filter");
    expect(pipeline.steps[1].type).toBe("deduplicate");
    expect(pipeline.steps[2].type).toBe("validate");
  });

  it("lève PipelineBuilderError si le nom est manquant", () => {
    const builder = new PipelineBuilder()
      .from("csv", { filePath: "./in.csv" })
      .to("json", { filePath: "./out.json" });

    expect(() => builder.build()).toThrow(PipelineBuilderError);
    expect(() => builder.build()).toThrow(/name is required/);
  });

  it("lève une erreur si la source est manquante", () => {
    const builder = new PipelineBuilder()
      .name("incomplete")
      .to("json", { filePath: "./out.json" });

    expect(() => builder.build()).toThrow(/source is required/);
  });

  it("lève une erreur si la destination est manquante", () => {
    const builder = new PipelineBuilder()
      .name("incomplete")
      .from("csv", { filePath: "./in.csv" });

    expect(() => builder.build()).toThrow(/destination is required/);
  });

  it("valide les bornes du batchSize", () => {
    expect(() => validBuilder().withBatchSize(0)).toThrow(/batchSize/);
    expect(() => validBuilder().withBatchSize(200_000)).toThrow(/batchSize/);
    expect(() => validBuilder().withBatchSize(1)).not.toThrow();
    expect(() => validBuilder().withBatchSize(100_000)).not.toThrow();
  });

  it("active le dryRun correctement", () => {
    const pipeline = validBuilder().dryRun().build();
    expect(pipeline.options.dryRun).toBe(true);
  });

  it("le pipeline construit est immuable (Object.freeze)", () => {
    const pipeline = validBuilder().build();

    // En strict mode TypeScript + Object.freeze, toute mutation lève TypeError
    expect(() => {
      (pipeline as any).name = "hacked";
    }).toThrow();
  });

  it("supporte plusieurs steps du même type (nommés différemment)", () => {
    const pipeline = validBuilder()
      .filter("age > 18")
      .filter("status = active")
      .build();

    expect(pipeline.steps[0].name).toBe("filter_1");
    expect(pipeline.steps[1].name).toBe("filter_2");
  });

  it("configure tous les options en chaîne", () => {
    const pipeline = validBuilder()
      .withBatchSize(1000)
      .withRetries(5)
      .withTimeout(60_000)
      .verbose()
      .dryRun()
      .build();

    expect(pipeline.options.batchSize).toBe(1000);
    expect(pipeline.options.maxRetries).toBe(5);
    expect(pipeline.options.timeoutMs).toBe(60_000);
    expect(pipeline.options.verbose).toBe(true);
    expect(pipeline.options.dryRun).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// __tests__/PipelineTemplate.test.ts
// Tests du pattern Prototype — PipelineTemplate
// ─────────────────────────────────────────────────────────────────────────────

import { PipelineTemplate } from "../src/pipeline/PipelineTemplate.js";

describe("PipelineTemplate (Prototype)", () => {
  // Pipeline de base servant de master template
  const buildMaster = () =>
    new PipelineBuilder()
      .name("master_pipeline")
      .from("csv", { filePath: "./data/users.csv", delimiter: "," })
      .filter("age > 18")
      .deduplicate("email")
      .to("postgres", { host: "localhost", table: "users", port: 5432 })
      .withBatchSize(500)
      .withRetries(3)
      .build();

  it("clone produit un nouvel objet indépendant (deep copy)", () => {
    const master = buildMaster();
    const template = new PipelineTemplate(master);
    const clone = template.clone();

    // IDs différents
    expect(clone.id).not.toBe(master.id);

    // Noms différents
    expect(clone.name).toBe("master_pipeline_clone");

    // Contenu identique
    expect(clone.source.type).toBe(master.source.type);
    expect(clone.steps).toHaveLength(master.steps.length);
  });

  it("modifie les options du clone sans affecter l'original", () => {
    const master = buildMaster();
    const template = new PipelineTemplate(master);

    const clone = template.clone({
      name: "master_pipeline_dryrun",
      overrideOptions: { dryRun: true, batchSize: 50 },
    });

    // Clone modifié
    expect(clone.options.dryRun).toBe(true);
    expect(clone.options.batchSize).toBe(50);

    // Original inchangé — deep copy garantit l'isolation
    expect(master.options.dryRun).toBe(false);
    expect(master.options.batchSize).toBe(500);
  });

  it("asDryRun() crée une variante dry-run en une ligne", () => {
    const master = buildMaster();
    const template = new PipelineTemplate(master);
    const dryRun = template.asDryRun();

    expect(dryRun.options.dryRun).toBe(true);
    expect(dryRun.options.verbose).toBe(true);
    expect(dryRun.name).toContain("dryrun");
  });

  it("withSource() change uniquement la source", () => {
    const master = buildMaster();
    const template = new PipelineTemplate(master);
    const variant = template.withSource("json", { filePath: "./data/users.json" });

    expect(variant.source.type).toBe("json");
    expect(variant.destination.type).toBe(master.destination.type); // Inchangé
    expect(variant.steps).toHaveLength(master.steps.length); // Inchangé
  });

  it("withDestination() change uniquement la destination", () => {
    const master = buildMaster();
    const template = new PipelineTemplate(master);
    const variant = template.withDestination("json", { filePath: "./out.json" });

    expect(variant.source.type).toBe(master.source.type); // Inchangé
    expect(variant.destination.type).toBe("json");
  });

  it("fromBuilder() construit le template directement depuis un Builder", () => {
    const builder = new PipelineBuilder()
      .name("from_builder")
      .from("csv", { filePath: "./in.csv" })
      .to("json", { filePath: "./out.json" });

    const template = PipelineTemplate.fromBuilder(builder);
    const clone = template.clone({ name: "clone_from_builder" });

    expect(clone.name).toBe("clone_from_builder");
    expect(clone.source.type).toBe("csv");
  });

  it("enregistre et retrouve un template dans le registry", () => {
    const master = buildMaster();
    const template = new PipelineTemplate(master);
    PipelineTemplate.register("master_v1", template);

    const retrieved = PipelineTemplate.get("master_v1");
    const clone = retrieved.clone();

    expect(clone.source.type).toBe("csv");
    expect(PipelineTemplate.list()).toContain("master_v1");
  });

  it("lève une erreur si le template n'existe pas dans le registry", () => {
    expect(() => PipelineTemplate.get("nonexistent_template")).toThrow(/No template registered/);
  });

  it("appendSteps ajoute des steps au clone sans modifier l'original", () => {
    const master = buildMaster();
    const originalStepCount = master.steps.length;
    const template = new PipelineTemplate(master);

    const enriched = template.clone({
      appendSteps: [{ name: "extra_filter", type: "filter", options: { expression: "country = FR" } }],
    });

    expect(enriched.steps).toHaveLength(originalStepCount + 1);
    expect(master.steps).toHaveLength(originalStepCount); // Original intact
  });
});
