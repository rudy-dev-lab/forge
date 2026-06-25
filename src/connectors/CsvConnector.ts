// ─────────────────────────────────────────────────────────────────────────────
// Connecteur CSV concret — implémente IConnector.
// C'est l'un des "produits concrets" que la Factory Method crée.
// Le code client ne connaît que IConnector, jamais cette classe directement.
// ─────────────────────────────────────────────────────────────────────────────

import { createReadStream, createWriteStream, existsSync } from "fs";
import { parse } from "csv-parse";
import type { IConnector, Dataset, WriteResult } from "../types/index.js";

export interface CsvConnectorOptions {
  filePath: string;
  delimiter: string;
  hasHeader: boolean;
  encoding: BufferEncoding;
}

export class CsvConnector implements IConnector {
  public readonly name: string;
  public readonly type = "csv" as const;
  private readonly options: CsvConnectorOptions;
  constructor(options: CsvConnectorOptions) {
    this.options = options;
    this.name = `CsvConnector(${options.filePath})`;
  }
  public async read(): Promise<Dataset> {
    return new Promise((resolve, reject) => {
      if (!existsSync(this.options.filePath)) {
        return reject(new Error(`[CsvConnector] File not found: ${this.options.filePath}`));
      }

      const rows: Dataset = [];
      const stream = createReadStream(this.options.filePath, { encoding: this.options.encoding });
      const parser = parse({
        delimiter: this.options.delimiter,
        columns: this.options.hasHeader,
        skip_empty_lines: true,
        trim: true,
        cast: true,
      });

      parser.on("readable", () => {
        let record;
        while ((record = parser.read()) !== null) {
          rows.push(record);
        }
      });

      parser.on("error", reject);
      parser.on("end", () => resolve(rows));
      stream.pipe(parser);
    });
  }

  public async write(data: Dataset): Promise<WriteResult> {
    const start = Date.now();
    const errors: string[] = [];
    if (data.length === 0) {
      return { rowsWritten: 0, duration: Date.now() - start, errors };
    }

    return new Promise((resolve) => {
      const stream = createWriteStream(this.options.filePath, { encoding: this.options.encoding });
      if (this.options.hasHeader) {
        const headers = Object.keys(data[0]).join(this.options.delimiter);
        stream.write(headers + "\n");
      }

      let rowsWritten = 0;
      for (const row of data) {
        try {
          const line = Object.values(row)
            .map((v) => {
              const str = String(v ?? "");
              return str.includes(this.options.delimiter) ? `"${str}"` : str;
            })
            .join(this.options.delimiter);
          stream.write(line + "\n");
          rowsWritten++;
        } catch (err) {
          errors.push(`Row ${rowsWritten}: ${String(err)}`);
        }
      }

      stream.end(() => {
        resolve({ rowsWritten, duration: Date.now() - start, errors });
      });
    });
  }
  public async ping(): Promise<boolean> {
    return existsSync(this.options.filePath);
  }
  public async close(): Promise<void> {
    // No-op pour CSV
  }
}
