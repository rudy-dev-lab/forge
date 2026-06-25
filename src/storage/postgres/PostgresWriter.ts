// src/storage/postgres/PostgresWriter.ts
import type { IWriter, Dataset, WriteResult } from "../../types/index.js";
import type { StorageOptions } from "../StorageFactory.js";
import { Pool } from "pg";

export class PostgresWriter implements IWriter {
  private pool: Pool;

  constructor(private readonly options: StorageOptions) {
    if (!options.connectionString) throw new Error("[PostgresWriter] connectionString required");
    this.pool = new Pool({ connectionString: options.connectionString });
  }

  public async write(destination: string, data: Dataset): Promise<WriteResult> {
    const start = Date.now();
    const table = destination || this.options.tableName;
    if (!table) throw new Error("[PostgresWriter] No destination table provided");

    if (data.length === 0) return { rowsWritten: 0, duration: 0, errors: [] };

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const columns = Object.keys(data[0]);
      const cols = columns.map((c) => `"${c}"`).join(", ");
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
      const sql = `INSERT INTO "${table}" (${cols}) VALUES (${placeholders})`;

      for (const row of data) {
        await client.query(
          sql,
          columns.map((c) => row[c])
        );
      }

      await client.query("COMMIT");
      return { rowsWritten: data.length, duration: Date.now() - start, errors: [] };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
