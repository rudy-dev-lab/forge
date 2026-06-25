// ─────────────────────────────────────────────────────────────────────────────
// Connecteur JSON — produit concret #2 de la Factory Method.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync } from "fs";
import type { IConnector, Dataset, WriteResult } from "../types/index.js";

export interface JsonConnectorOptions {
  filePath: string;
  rootKey?: string; // Ex: si le JSON est { "users": [...] }, rootKey = "users"
}

export class JsonConnector implements IConnector {
  public readonly name: string;
  public readonly type = "json" as const;
  private readonly options: JsonConnectorOptions;
  constructor(options: JsonConnectorOptions) {
    this.options = options;
    this.name = `JsonConnector(${options.filePath})`;
  }

  public async read(): Promise<Dataset> {
    if (!existsSync(this.options.filePath)) {
      throw new Error(`[JsonConnector] File not found: ${this.options.filePath}`);
    }

    const raw = readFileSync(this.options.filePath, "utf-8");
    const parsed: unknown = JSON.parse(raw);

    // Extrait via rootKey si spécifié : { "data": [...] } → on veut le tableau
    if (this.options.rootKey) {
      const nested = (parsed as Record<string, unknown>)[this.options.rootKey];
      if (!Array.isArray(nested)) {
        throw new Error(
          `[JsonConnector] Key "${this.options.rootKey}" is not an array in ${this.options.filePath}`
        );
      }
      return nested as Dataset;
    }

    if (!Array.isArray(parsed)) {
      throw new Error(
        `[JsonConnector] Expected array at root of ${this.options.filePath}. Use rootKey option for nested arrays.`
      );
    }
    return parsed as Dataset;
  }

  public async write(data: Dataset): Promise<WriteResult> {
    const start = Date.now();
    const output = this.options.rootKey ? { [this.options.rootKey]: data } : data;

    writeFileSync(this.options.filePath, JSON.stringify(output, null, 2), "utf-8");

    return {
      rowsWritten: data.length,
      duration: Date.now() - start,
      errors: [],
    };
  }

  public async ping(): Promise<boolean> {
    return existsSync(this.options.filePath);
  }

  public async close(): Promise<void> {
    // No-op
  }
}
