import type { IReader, Dataset } from "../../types/index.js";
import type { StorageOptions } from "../StorageFactory.js";
import { Pool } from "pg";

export class PostgresReader implements IReader {
  private pool: Pool;
  private readonly tableName: string;

  constructor(private readonly options: StorageOptions) {
    if (!options.connectionString) throw new Error("[PostgresReader] connectionString required");
    if (!options.tableName) throw new Error("[PostgresReader] tableName required");

    this.tableName = options.tableName;
    this.pool = new Pool({ connectionString: options.connectionString });
  }

  public async read(source: string): Promise<Dataset> {
    const table = source || this.tableName;
    const client = await this.pool.connect();
    try {
      const result = await client.query(`SELECT * FROM "${table}"`);
      return result.rows as Dataset;
    } finally {
      client.release();
    }
  }
}
