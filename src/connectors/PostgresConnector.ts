// ─────────────────────────────────────────────────────────────────────────────
// Connecteur PostgreSQL — produit concret #3 de la Factory Method.
// Utilise le module `pg` (node-postgres) avec un Pool de connexions.
// ─────────────────────────────────────────────────────────────────────────────

import { Pool, type PoolConfig } from "pg";
import type { IConnector, Dataset, WriteResult, Row } from "../types/index.js";

export interface PostgresConnectorOptions extends PoolConfig {
  table: string;
  query?: string; // SELECT custom — surcharge la table si fourni
}

export class PostgresConnector implements IConnector {
  public readonly name: string;
  public readonly type = "postgres" as const;

  // Le Pool pg gère plusieurs connexions simultanées.
  // Analogie : le pool de connexions Prisma ou TypeORM.
  // En semaine 2, on ajoutera un Proxy autour pour le rate limiting et le circuit breaker.
  private pool: Pool;
  private readonly options: PostgresConnectorOptions;
  constructor(options: PostgresConnectorOptions) {
    this.options = options;
    this.name = `PostgresConnector(${options.host}:${options.port}/${options.database}/${options.table})`;

    // Création du pool — les connexions sont lazy (créées à la demande)
    this.pool = new Pool({
      host: options.host,
      port: options.port,
      user: options.user,
      password: options.password,
      database: options.database,
      max: 10, // Connexions max dans le pool
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    // Log des erreurs pool (connexions perdues, etc.)
    this.pool.on("error", (err) => {
      console.error(`[PostgresConnector] Pool error on ${this.name}:`, err.message);
    });
  }

  // Exécute la query ou un SELECT * FROM table.
  // Retourne les rows typées en Dataset (Row[]).
  public async read(): Promise<Dataset> {
    const sql = this.options.query ?? `SELECT * FROM ${this.escapeIdentifier(this.options.table)}`;

    const client = await this.pool.connect();
    try {
      const result = await client.query(sql);
      return result.rows as Dataset;
    } finally {
      // IMPORTANT : toujours libérer le client même en cas d'erreur
      // Sinon le pool sature → Analogie : oublier de fermer un stream Node.js
      client.release();
    }
  }

  // Insère les rows en utilisant une transaction + batch INSERT.
  // En semaine 2, le Decorator ajoutera le retry et le batch splitting.
  public async write(data: Dataset): Promise<WriteResult> {
    const start = Date.now();
    const errors: string[] = [];

    if (data.length === 0) {
      return { rowsWritten: 0, duration: 0, errors };
    }

    const client = await this.pool.connect();

    try {
      // Transaction : soit tout passe, soit rien (atomicité)
      // Analogie : Prisma $transaction([...]) ou TypeORM queryRunner.startTransaction()
      await client.query("BEGIN");

      const columns = Object.keys(data[0]);
      const escapedTable = this.escapeIdentifier(this.options.table);
      const escapedCols = columns.map((c) => this.escapeIdentifier(c)).join(", ");

      let rowsWritten = 0;

      // INSERT en batch par groupe de 100 rows
      // En semaine 2, le Decorator gérera la taille du batch dynamiquement
      const BATCH_SIZE = 100;
      for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = data.slice(i, i + BATCH_SIZE);

        // Construction des paramètres : ($1, $2, $3), ($4, $5, $6), ...
        const values: unknown[] = [];
        const placeholders = batch.map((row, rowIdx) => {
          const rowPlaceholders = columns.map((_, colIdx) => {
            values.push(row[columns[colIdx]]);
            return `$${rowIdx * columns.length + colIdx + 1}`;
          });
          return `(${rowPlaceholders.join(", ")})`;
        });

        const sql = `INSERT INTO ${escapedTable} (${escapedCols}) VALUES ${placeholders.join(", ")}`;

        try {
          const result = await client.query(sql, values);
          rowsWritten += result.rowCount ?? 0;
        } catch (err) {
          errors.push(`Batch ${Math.floor(i / BATCH_SIZE)}: ${String(err)}`);
        }
      }

      await client.query("COMMIT");
      return { rowsWritten, duration: Date.now() - start, errors };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
  public async ping(): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("SELECT 1");
      return true;
    } catch {
      return false;
    } finally {
      client.release();
    }
  }

  // Ferme toutes les connexions du pool.
  // À appeler en fin de pipeline ou au shutdown de l'app.
  public async close(): Promise<void> {
    await this.pool.end();
    console.log(`[PostgresConnector] Pool closed for ${this.name}`);
  }

  // Échappe les identifiants SQL (table, colonnes) pour éviter les injections
  private escapeIdentifier(id: string): string {
    return `"${id.replace(/"/g, '""')}"`;
  }
}
