// ─────────────────────────────────────────────────────────────────────────────
// Pipeline — le "Produit" construit par le PipelineBuilder.
// Implémente aussi le Prototype pattern via .clone().
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from "crypto";
import type {
  IPipeline,
  ConnectorConfig,
  StepConfig,
  PipelineOptions,
  PipelineResult,
  Dataset,
} from "../types/index.js";
import { ConnectorFactory } from "../connectors/ConnectorFactory.js";

export interface PipelineProps {
  id: string;
  name: string;
  source: ConnectorConfig;
  destination: ConnectorConfig;
  steps: StepConfig[];
  options: PipelineOptions;
}

export class Pipeline implements IPipeline {
  public readonly id: string;
  public readonly name: string;
  public readonly source: ConnectorConfig;
  public readonly destination: ConnectorConfig;
  public readonly steps: StepConfig[];
  public readonly options: PipelineOptions;

  constructor(props: PipelineProps) {
    this.id = props.id;
    this.name = props.name;
    this.source = Object.freeze({ ...props.source });
    this.destination = Object.freeze({ ...props.destination });
    this.steps = Object.freeze([...props.steps]) as StepConfig[];
    this.options = Object.freeze({ ...props.options });

    // Gèle l'objet lui-même — immuabilité complète post-build
    // Analogie : Object.freeze en JS ou record en C# / data class Kotlin
    Object.freeze(this);
  }

  // Exécution simplifiée pour la semaine 1.
  // En semaine 2 : Decorator (retry, log, cache), Strategy (batch/stream), Observer (events)
  public async run(): Promise<PipelineResult> {
    const startedAt = new Date();
    const start = Date.now();

    console.log(`[Pipeline] Starting "${this.name}" (id: ${this.id})`);
    if (this.options.dryRun) console.log("[Pipeline] DRY RUN mode — no data will be written");

    try {
      const sourceConnector = ConnectorFactory.fromConfig(this.source);
      const destConnector = ConnectorFactory.fromConfig(this.destination);
      const rawData = await sourceConnector.read();
      console.log(`[Pipeline] Read ${rawData.length} rows from ${sourceConnector.name}`);

      let processedData = this.applySteps(rawData);
      console.log(`[Pipeline] After transforms: ${processedData.length} rows`);

      let rowsWritten = 0;
      if (!this.options.dryRun) {
        const result = await destConnector.write(processedData);
        rowsWritten = result.rowsWritten;
        console.log(`[Pipeline] Written ${rowsWritten} rows to ${destConnector.name}`);
      } else {
        rowsWritten = 0;
        console.log(`[Pipeline] DRY RUN: would write ${processedData.length} rows`);
      }

      await sourceConnector.close();
      await destConnector.close();

      const completedAt = new Date();
      return {
        pipelineId: this.id,
        status: "success",
        rowsRead: rawData.length,
        rowsWritten,
        rowsFailed: 0,
        duration: Date.now() - start,
        errors: [],
        startedAt,
        completedAt,
      };
    } catch (err) {
      const completedAt = new Date();
      console.error(`[Pipeline] Failed "${this.name}":`, err);
      return {
        pipelineId: this.id,
        status: "failed",
        rowsRead: 0,
        rowsWritten: 0,
        rowsFailed: 0,
        duration: Date.now() - start,
        errors: [String(err)],
        startedAt,
        completedAt,
      };
    }
  }

  // PATTERN GoF #5 : PROTOTYPE — voir PipelineTemplate.ts pour l'implémentation riche
  // Ici : clone simple avec nouvel ID
  public clone(): IPipeline {
    return new Pipeline({
      id: randomUUID(), // Nouvel ID pour le clone
      name: `${this.name}_copy`,
      source: { ...this.source, options: { ...this.source.options } },
      destination: { ...this.destination, options: { ...this.destination.options } },
      steps: this.steps.map((s) => ({ ...s, options: { ...s.options } })),
      options: { ...this.options },
    });
  }
  private applySteps(data: Dataset): Dataset {
    let result = [...data];

    for (const step of this.steps) {
      if (this.options.verbose) {
        console.log(
          `[Pipeline] Applying step "${step.name}" (${step.type}) on ${result.length} rows`
        );
      }
      switch (step.type) {
        case "filter":
          // Ex: expression = "age > 18" → on parse et filtre
          result = this.applyFilter(result, step.options?.expression as string);
          break;
        case "map":
          // Ex: mapping = { "full_name": "name", "email_address": "email" }
          result = this.applyMap(result, step.options?.mapping as Record<string, string>);
          break;
        case "deduplicate":
          result = this.applyDeduplicate(result, step.options?.key as string);
          break;
        case "validate":
          // La validation ne filtre pas — elle log les erreurs
          const validationErrors = result
            .map((row, i) => ({
              row: i,
              valid: this.validateRow(row, step.options?.schema as Record<string, string>),
            }))
            .filter((r) => !r.valid);
          if (validationErrors.length > 0) {
            console.warn(
              `[Pipeline] ${validationErrors.length} rows failed validation in step "${step.name}"`
            );
          }
          break;
      }
    }
    return result;
  }

  private applyFilter(data: Dataset, expression: string): Dataset {
    if (!expression) return data;
    // Parser simple : "field operator value" — ex: "age > 18", "status = active"
    const match = expression.match(/^(\w+)\s*(>|<|>=|<=|=|!=|==)\s*(.+)$/);
    if (!match) {
      console.warn(`[Pipeline] Cannot parse filter expression: "${expression}"`);
      return data;
    }
    const [, field, operator, rawValue] = match;
    const value = isNaN(Number(rawValue)) ? rawValue.trim() : Number(rawValue);
    return data.filter((row) => {
      const v = row[field];
      switch (operator) {
        case ">":
          return Number(v) > Number(value);
        case "<":
          return Number(v) < Number(value);
        case ">=":
          return Number(v) >= Number(value);
        case "<=":
          return Number(v) <= Number(value);
        case "=":
        case "==":
          return String(v) === String(value);
        case "!=":
          return String(v) !== String(value);
        default:
          return true;
      }
    });
  }

  private applyMap(data: Dataset, mapping: Record<string, string>): Dataset {
    if (!mapping) return data;
    // mapping = { "newKey": "oldKey" } → renomme les champs
    return data.map((row) => {
      const newRow = { ...row };
      for (const [newKey, oldKey] of Object.entries(mapping)) {
        if (oldKey in newRow) {
          newRow[newKey] = newRow[oldKey];
          if (newKey !== oldKey) delete newRow[oldKey];
        }
      }
      return newRow;
    });
  }

  private applyDeduplicate(data: Dataset, key: string): Dataset {
    if (!key) return data;
    const seen = new Set<unknown>();
    return data.filter((row) => {
      const k = row[key];
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  private validateRow(row: Record<string, unknown>, schema: Record<string, string>): boolean {
    if (!schema) return true;
    return Object.entries(schema).every(([field, type]) => {
      const value = row[field];
      if (value === undefined || value === null) return false;
      return type === "date" ? !isNaN(new Date(String(value)).getTime()) : typeof value === type;
    });
  }
}
