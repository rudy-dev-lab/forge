// ─────────────────────────────────────────────────────────────────────────────
// PATTERN GoF #3 : ABSTRACT FACTORY
// ─────────────────────────────────────────────────────────────────────────────
//
// PROBLÈME résolu :
//   On veut travailler avec des FAMILLES d'objets cohérentes.
//   Ex : Si on utilise PostgreSQL, on doit avoir un PostgresReader, un PostgresWriter
//   ET un PostgresValidator — on ne peut pas mélanger un S3Reader avec un PostgresWriter
//   car leurs formats de données sont incompatibles.
//
// SOLUTION Abstract Factory :
//   Une interface IStorageFactory définit les méthodes de création de la famille.
//   Chaque famille concrète (PostgresFactory, S3Factory) retourne ses propres objets.
//   Le code client choisit UNE factory et utilise ses produits — garantie de cohérence.
//
// DIFFÉRENCE avec Factory Method :
//   Factory Method → crée UN seul type d'objet (un IConnector)
//   Abstract Factory → crée une FAMILLE d'objets (IReader + IWriter + IValidator)
//
// ANALOGIE NestJS :
//   C'est comme un Module complet qui exporte ses services liés :
//   @Module({ providers: [PostgresReader, PostgresWriter, PostgresValidator],
//             exports: [PostgresReader, PostgresWriter, PostgresValidator] })
//   L'Abstract Factory remplace le Module NestJS quand on n'a pas de DI container.
// ─────────────────────────────────────────────────────────────────────────────

import type { IReader, IWriter, IValidator, StorageType } from "../types/index.js";
import { PostgresReader } from "./postgres/PostgresReader.js";
import { PostgresWriter } from "./postgres/PostgresWriter.js";
import { PostgresValidator } from "./postgres/PostgresValidator.js";
import { S3Reader } from "./s3/S3Reader.js";
import { S3Writer } from "./s3/S3Writer.js";
import { S3Validator } from "./s3/S3Validator.js";
import { FilesystemReader } from "./filesystem/FilesystemReader.js";
import { FilesystemWriter } from "./filesystem/FilesystemWriter.js";
import { FilesystemValidator } from "./filesystem/FilesystemValidator.js";

// L'interface ABSTRAITE de la factory.
// Elle définit le contrat : "toute storage factory doit créer ces 3 types d'objets".
// Analogie : comme une interface de Module NestJS (ModuleMetadata)
export interface IStorageFactory {
  createReader(options: StorageOptions): IReader;
  createWriter(options: StorageOptions): IWriter;
  createValidator(options: StorageOptions): IValidator;
  readonly familyName: string;
}
export interface StorageOptions {
  connectionString?: string;
  tableName?: string;
  bucket?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  basePath?: string;
  format?: "csv" | "json" | "ndjson";
  schema?: Record<string, "string" | "number" | "boolean" | "date">;
}

// PostgreSQL Family — les 3 produits sont garantis compatibles entre eux
export class PostgresStorageFactory implements IStorageFactory {
  public readonly familyName = "postgres";

  public createReader(options: StorageOptions): IReader {
    return new PostgresReader(options);
  }

  public createWriter(options: StorageOptions): IWriter {
    return new PostgresWriter(options);
  }

  public createValidator(options: StorageOptions): IValidator {
    return new PostgresValidator(options);
  }
}

export class S3StorageFactory implements IStorageFactory {
  public readonly familyName = "s3";

  public createReader(options: StorageOptions): IReader {
    return new S3Reader(options);
  }

  public createWriter(options: StorageOptions): IWriter {
    return new S3Writer(options);
  }

  public createValidator(options: StorageOptions): IValidator {
    return new S3Validator(options);
  }
}

export class FilesystemStorageFactory implements IStorageFactory {
  public readonly familyName = "filesystem";

  public createReader(options: StorageOptions): IReader {
    return new FilesystemReader(options);
  }

  public createWriter(options: StorageOptions): IWriter {
    return new FilesystemWriter(options);
  }

  public createValidator(options: StorageOptions): IValidator {
    return new FilesystemValidator(options);
  }
}

export class StorageFactory {
  public static create(type: StorageType): IStorageFactory {
    switch (type) {
      case "postgres":
        return new PostgresStorageFactory();
      case "s3":
        return new S3StorageFactory();
      case "filesystem":
        return new FilesystemStorageFactory();
      default:
        const _exhaustive: never = type;
        throw new Error(`[StorageFactory] Unknown storage type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

// Exemple d'utilisation (à titre pédagogique)
//
// // Le code client choisit UNE famille et utilise ses produits de façon cohérente
// const factory = StorageFactory.create("postgres");
//
// const reader    = factory.createReader({ connectionString: "...", tableName: "users" });
// const writer    = factory.createWriter({ connectionString: "...", tableName: "users_clean" });
// const validator = factory.createValidator({ schema: { name: "string", age: "number" } });
//
// // Ici on peut changer "postgres" → "s3" sans changer le reste du code
// // Les 3 objets seront toujours une famille cohérente.
