import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { IReader, Dataset } from "../../types/index.js";
import type { StorageOptions } from "../StorageFactory.js";

export class FilesystemReader implements IReader {
  constructor(private readonly options: StorageOptions) {
    if (!options.basePath) throw new Error("[FilesystemReader] basePath required");
  }
  public async read(source: string): Promise<Dataset> {
    const filePath = join(this.options.basePath!, source);
    if (!existsSync(filePath)) throw new Error(`[FilesystemReader] File not found: ${filePath}`);

    const content = readFileSync(filePath, "utf-8");
    const format = this.options.format ?? "json";

    if (format === "ndjson") {
      return content
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    }

    if (format === "json") {
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [parsed];
    }

    const lines = content.split("\n").filter(Boolean);
    if (lines.length === 0) return [];
    const headers = lines[0].split(",");
    return lines.slice(1).map((line) => {
      const values = line.split(",");
      return Object.fromEntries(headers.map((h, i) => [h.trim(), values[i]?.trim()]));
    });
  }
}
