import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import type { IWriter, Dataset, WriteResult } from "../../types/index.js";
import type { StorageOptions } from "../StorageFactory.js";
export class FilesystemWriter implements IWriter {
  constructor(private readonly options: StorageOptions) {
    if (!options.basePath) throw new Error("[FilesystemWriter] basePath required");
  }
  public async write(destination: string, data: Dataset): Promise<WriteResult> {
    const start = Date.now();
    const filePath = join(this.options.basePath!, destination);
    mkdirSync(dirname(filePath), { recursive: true });

    const format = this.options.format ?? "json";
    const content =
      format === "ndjson"
        ? data.map((row) => JSON.stringify(row)).join("\n")
        : JSON.stringify(data, null, 2);

    writeFileSync(filePath, content, "utf-8");
    return { rowsWritten: data.length, duration: Date.now() - start, errors: [] };
  }
}
