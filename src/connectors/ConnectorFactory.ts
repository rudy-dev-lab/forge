// ─────────────────────────────────────────────────────────────────────────────
// PATTERN GoF #2 : FACTORY METHOD
// ─────────────────────────────────────────────────────────────────────────────
//
// PROBLÈME résolu :
//   Le code client a besoin d'un IConnector mais ne doit PAS connaître
//   la classe concrète (CsvConnector, PostgresConnector, etc.).
//   Demain si on ajoute un "MongoConnector", le code client ne change PAS.
//
// SOLUTION Factory Method :
//   Une méthode statique `create(type, options)` retourne toujours IConnector.
//   Elle cache le `new ConcreteClass()` derrière une interface commune.
//   → Principe OCP (Open/Closed) : ouvert à l'extension, fermé à la modification.
//
// ANALOGIE NestJS :
//   useFactory: (configService: ConfigService) => {
//     if (configService.get('DB_TYPE') === 'postgres') return new PgAdapter();
//     return new SqliteAdapter();
//   }
//   → Le container NestJS fait la même chose, mais via l'IoC.
//   Ici on le fait manuellement pour comprendre le mécanisme.
//
// DIFFÉRENCE avec Abstract Factory (Semaine 2) :
//   Factory Method → crée UN type d'objet (un connecteur)
//   Abstract Factory → crée une FAMILLE d'objets cohérents (Reader + Writer + Validator)
// ─────────────────────────────────────────────────────────────────────────────

import type { IConnector, ConnectorType, ConnectorConfig } from "../types/index.js";
import { CsvConnector } from "./CsvConnector.js";
import { JsonConnector } from "./JsonConnector.js";
import { PostgresConnector } from "./PostgresConnector.js";

export type CsvOptions = {
  filePath: string;
  delimiter?: string;
  hasHeader?: boolean;
  encoding?: BufferEncoding;
};

export type JsonOptions = {
  filePath: string;
  rootKey?: string;
};

export type PostgresOptions = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  table: string;
  query?: string;
};

export type ConnectorOptions =
  | ({ type: "csv" } & CsvOptions)
  | ({ type: "json" } & JsonOptions)
  | ({ type: "postgres" } & PostgresOptions);

export class ConnectorFactory {
  // LA méthode Factory : retourne toujours IConnector, jamais une classe concrète.
  // Le consommateur obtient un IConnector et peut appeler .read() / .write() / .ping()
  // sans savoir CE QUE c'est derrière.
  public static create(options: ConnectorOptions): IConnector {
    // Switch sur le discriminant — chaque branche crée un connecteur concret
    // mais retourne le type abstrait IConnector.
    switch (options.type) {
      case "csv":
        return new CsvConnector({
          filePath: options.filePath,
          delimiter: options.delimiter ?? ",",
          hasHeader: options.hasHeader ?? true,
          encoding: options.encoding ?? "utf-8",
        });
      case "json":
        return new JsonConnector({
          filePath: options.filePath,
          rootKey: options.rootKey,
        });
      case "postgres":
        return new PostgresConnector({
          host: options.host,
          port: options.port,
          user: options.user,
          password: options.password,
          database: options.database,
          table: options.table,
          query: options.query,
        });
      default:
        // TypeScript exhaustiveness check : si on ajoute un type sans case → erreur compile
        // Analogie : le `default` dans un match Rust ou switch exhaustif en C#
        const _exhaustive: never = options;
        throw new Error(
          `[ConnectorFactory] Unknown connector type: ${JSON.stringify(_exhaustive)}`
        );
    }
  }

  // Méthode alternative : crée depuis une ConnectorConfig générique (venant du Builder)
  // Utile quand la config vient du JSON/DB (types non connus à la compilation)
  public static fromConfig(config: ConnectorConfig): IConnector {
    return ConnectorFactory.create({
      type: config.type as ConnectorOptions["type"],
      ...(config.options as Omit<ConnectorOptions, "type">),
    } as ConnectorOptions);
  }

  // Enregistrement dynamique (extension sans modification = OCP)
  // Permet d'ajouter des connecteurs custom sans toucher à la Factory.
  // Analogie : app.usePlugin() dans Fastify ou custom providers NestJS.
  private static registry = new Map<string, (options: Record<string, unknown>) => IConnector>();

  public static register(
    type: string,
    factory: (options: Record<string, unknown>) => IConnector
  ): void {
    ConnectorFactory.registry.set(type, factory);
    console.log(`[ConnectorFactory] Registered custom connector: "${type}"`);
  }

  public static createCustom(type: string, options: Record<string, unknown>): IConnector {
    const factory = ConnectorFactory.registry.get(type);
    if (!factory) {
      throw new Error(`[ConnectorFactory] No registered connector for type: "${type}"`);
    }
    return factory(options);
  }
}
