// ─────────────────────────────────────────────────────────────────────────────
// PATTERN GoF #4 : BUILDER
// ─────────────────────────────────────────────────────────────────────────────
//
// PROBLÈME résolu :
//   Un Pipeline a de nombreux paramètres optionnels + une logique de validation.
//   Un constructeur avec 10 paramètres est illisible et source d'erreurs.
//   new Pipeline("users", source, dest, [step1, step2], 500, 3, 30000, false, true) ← 💀
//
// SOLUTION Builder :
//   API fluent (méthodes chaînables) qui construit l'objet étape par étape.
//   .build() fait la validation finale et retourne l'objet immuable.
//   Chaque méthode retourne `this` → permet le chaînage.
//
// ANALOGIE :
//   QueryBuilder TypeORM/Prisma :
//     repo.createQueryBuilder("user")
//         .where("user.age > :age", { age: 18 })
//         .orderBy("user.name")
//         .getMany()
//   Ou le pattern .pipe() de RxJS / la config Webpack.
//   Ou encore : new URLSearchParams().append().toString()
//
// AVANTAGE vs constructeur classique :
//   → Self-documenting : on voit ce qu'on configure
//   → Partial construction : on n'a besoin que des params nécessaires
//   → Validation centralisée au moment du .build()
//   → Immutabilité du résultat : le Pipeline est frozen après build()
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from "crypto";
import type {
  IPipeline,
  ConnectorConfig,
  StepConfig,
  StepType,
  ConnectorType,
  PipelineOptions,
} from "../types/index.js";
import { Pipeline } from "./Pipeline.js";

export class PipelineBuilderError extends Error {
  constructor(message: string) {
    super(`[PipelineBuilder] ${message}`);
    this.name = "PipelineBuilderError";
  }
}

export class PipelineBuilder {
  private _name: string = "";
  private _id: string = randomUUID();
  private _source: ConnectorConfig | null = null;
  private _destination: ConnectorConfig | null = null;
  private _steps: StepConfig[] = [];
  private _options: PipelineOptions = {
    batchSize: 500,
    maxRetries: 3,
    timeoutMs: 30_000,
    dryRun: false,
    verbose: false,
  };
  public name(name: string): this {
    if (!name || name.trim().length === 0) {
      throw new PipelineBuilderError("Pipeline name cannot be empty");
    }
    this._name = name.trim();
    return this;
  }
  public from(type: ConnectorType, options: Record<string, unknown>): this {
    this._source = { type, options };
    return this;
  }
  public to(type: ConnectorType, options: Record<string, unknown>): this {
    this._destination = { type, options };
    return this;
  }
  public filter(expression: string): this {
    return this.addStep("filter", { expression });
  }
  public map(mapping: Record<string, string>): this {
    return this.addStep("map", { mapping });
  }

  public validate(schema: Record<string, string>): this {
    return this.addStep("validate", { schema });
  }

  public aggregate(groupBy: string, aggregations: Record<string, string>): this {
    return this.addStep("aggregate", { groupBy, aggregations });
  }

  public deduplicate(key: string): this {
    return this.addStep("deduplicate", { key });
  }

  public withBatchSize(size: number): this {
    if (size < 1 || size > 100_000) {
      throw new PipelineBuilderError(`batchSize must be between 1 and 100000, got ${size}`);
    }
    this._options = { ...this._options, batchSize: size };
    return this;
  }

  public withRetries(maxRetries: number): this {
    if (maxRetries < 0 || maxRetries > 10) {
      throw new PipelineBuilderError(`maxRetries must be between 0 and 10, got ${maxRetries}`);
    }
    this._options = { ...this._options, maxRetries };
    return this;
  }

  public withTimeout(ms: number): this {
    this._options = { ...this._options, timeoutMs: ms };
    return this;
  }

  // Mode dry-run : simule sans écrire
  public dryRun(): this {
    this._options = { ...this._options, dryRun: true };
    return this;
  }

  public verbose(): this {
    this._options = { ...this._options, verbose: true };
    return this;
  }

  public withId(id: string): this {
    this._id = id;
    return this;
  }

  public build(): IPipeline {
    const errors: string[] = [];

    if (!this._name) errors.push("name is required — use .name('my-pipeline')");
    if (!this._source) errors.push("source is required — use .from('csv', { filePath: '...' })");
    if (!this._destination) errors.push("destination is required — use .to('postgres', { ... })");

    if (errors.length > 0) {
      throw new PipelineBuilderError(
        `Cannot build pipeline, missing required config:\n  • ${errors.join("\n  • ")}`
      );
    }

    return new Pipeline({
      id: this._id,
      name: this._name,
      source: this._source!,
      destination: this._destination!,
      steps: [...this._steps],
      options: { ...this._options },
    });
  }

  private addStep(type: StepType, options: Record<string, unknown> = {}): this {
    const stepName = `${type}_${this._steps.filter((s) => s.type === type).length + 1}`;
    this._steps.push({ name: stepName, type, options });
    return this;
  }
}
