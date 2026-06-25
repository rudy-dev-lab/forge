// ─────────────────────────────────────────────────────────────────────────────
// PATTERN GoF #5 : PROTOTYPE
// ─────────────────────────────────────────────────────────────────────────────
//
// PROBLÈME résolu :
//   Créer un nouveau Pipeline similaire à un existant demande de reconfigurer
//   tout from scratch via le Builder. C'est verbeux et source d'erreurs si
//   on oublie de copier un paramètre.
//   Ex : pipeline "users_sync" → variante "users_sync_dryrun" avec juste dryRun=true
//
// SOLUTION Prototype :
//   Un objet peut se cloner lui-même via une méthode .clone().
//   Le clone est INDÉPENDANT de l'original (deep copy, pas de partage de référence).
//   On peut override certaines propriétés lors du clonage.
//
// ANALOGIE :
//   → structuredClone() en JS (Prototype natif ES2022)
//   → Object.assign({}, original, overrides) mais avec logique métier
//   → Les "blueprints" de configuration dans Docker Compose (extends: base-service)
//   → Les "template literals" de config Terraform
//
// QUAND utiliser Prototype vs Builder ?
//   Builder → quand on construit from scratch step by step
//   Prototype → quand on part d'un existant et on varie quelques paramètres
//   Les deux se COMBINENT : le Builder crée le template, le Prototype le clone.
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from "crypto";
import type { IPipeline, ConnectorConfig, StepConfig, PipelineOptions } from "../types/index.js";
import { Pipeline } from "./Pipeline.js";
import { PipelineBuilder } from "./PipelineBuilder.js";
export interface CloneOptions {
  name?: string;
  id?: string;
  overrideSource?: ConnectorConfig;
  overrideDestination?: ConnectorConfig;
  appendSteps?: StepConfig[];
  overrideOptions?: Partial<PipelineOptions>;
}

export class PipelineTemplate {
  private readonly template: IPipeline;
  constructor(pipeline: IPipeline) {
    this.template = pipeline;
  }
  public clone(overrides: CloneOptions = {}): IPipeline {
    const clonedSource = overrides.overrideSource ?? this.deepCloneConfig(this.template.source);
    const clonedDest =
      overrides.overrideDestination ?? this.deepCloneConfig(this.template.destination);
    const clonedSteps = [
      ...this.template.steps.map((s) => this.deepCloneStep(s)),
      ...(overrides.appendSteps ?? []),
    ];
    const clonedOptions = {
      ...this.template.options,
      ...overrides.overrideOptions,
    };

    return new Pipeline({
      id: overrides.id ?? randomUUID(),
      name: overrides.name ?? `${this.template.name}_clone`,
      source: clonedSource,
      destination: clonedDest,
      steps: clonedSteps,
      options: clonedOptions,
    });
  }
  public asDryRun(name?: string): IPipeline {
    return this.clone({
      name: name ?? `${this.template.name}_dryrun`,
      overrideOptions: { dryRun: true, verbose: true },
    });
  }
  public withSource(type: ConnectorConfig["type"], options: Record<string, unknown>): IPipeline {
    return this.clone({
      overrideSource: { type, options },
    });
  }
  public withDestination(
    type: ConnectorConfig["type"],
    options: Record<string, unknown>
  ): IPipeline {
    return this.clone({
      overrideDestination: { type, options },
    });
  }
  public withReducedBatch(batchSize: number): IPipeline {
    return this.clone({
      name: `${this.template.name}_reduced`,
      overrideOptions: { batchSize },
    });
  }

  private static registry = new Map<string, PipelineTemplate>();

  public static register(name: string, template: PipelineTemplate): void {
    PipelineTemplate.registry.set(name, template);
    console.log(`[PipelineTemplate] Registered template: "${name}"`);
  }

  public static get(name: string): PipelineTemplate {
    const template = PipelineTemplate.registry.get(name);
    if (!template) {
      throw new Error(`[PipelineTemplate] No template registered with name: "${name}"`);
    }
    return template;
  }

  public static list(): string[] {
    return Array.from(PipelineTemplate.registry.keys());
  }

  // Deep clone d'une ConnectorConfig — évite le partage de référence options
  // Analogie : structuredClone() mais sans dépendance externe
  private deepCloneConfig(config: ConnectorConfig): ConnectorConfig {
    return {
      type: config.type,
      options: JSON.parse(JSON.stringify(config.options)),
    };
  }

  private deepCloneStep(step: StepConfig): StepConfig {
    return {
      name: step.name,
      type: step.type,
      options: step.options ? JSON.parse(JSON.stringify(step.options)) : undefined,
    };
  }

  // Factory method : crée un template directement depuis le Builder
  //    Combine Builder + Prototype : build() crée le master, on wrap dans Template
  public static fromBuilder(builder: PipelineBuilder): PipelineTemplate {
    const pipeline = builder.build();
    return new PipelineTemplate(pipeline);
  }
}
