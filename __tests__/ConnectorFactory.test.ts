import { describe, it, expect } from "vitest";
import { ConnectorFactory } from "../src/connectors/ConnectorFactory.js";
import type { IConnector } from "../src/types/index.js";

describe("ConnectorFactory (Factory Method)", () => {
  it("crée un CsvConnector sans exposer la classe concrète au client", () => {
    const connector = ConnectorFactory.create({ type: "csv", filePath: "./data/test.csv" });
    expect(connector).toBeDefined();
    expect(connector.type).toBe("csv");
    expect(typeof connector.read).toBe("function");
    expect(typeof connector.write).toBe("function");
    expect(typeof connector.ping).toBe("function");
    expect(typeof connector.close).toBe("function");
  });

  it("crée un JsonConnector avec le bon type discriminant", () => {
    const connector = ConnectorFactory.create({ type: "json", filePath: "./data/test.json" });
    expect(connector.type).toBe("json");
    expect(connector.name).toContain("test.json");
  });

  it("lève une erreur pour un type inconnu", () => {
    expect(() =>
      ConnectorFactory.create({ type: "unknown" as never, filePath: "" })
    ).toThrow();
  });

  it("permet d'enregistrer un connecteur custom (OCP)", () => {
    const mockConnector: IConnector = {
      name: "MockMongo",
      type: "csv",
      read: async () => [{ id: 1 }],
      write: async () => ({ rowsWritten: 1, duration: 0, errors: [] }),
      ping: async () => true,
      close: async () => {},
    };
    ConnectorFactory.register("mongodb", () => mockConnector);
    const connector = ConnectorFactory.createCustom("mongodb", { uri: "mongodb://localhost" });
    expect(connector.name).toBe("MockMongo");
  });

  it("crée depuis une ConnectorConfig générique (venant du Builder)", () => {
    const config = {
      type: "csv" as const,
      options: { filePath: "./data/users.csv", delimiter: ";", hasHeader: true },
    };
    const connector = ConnectorFactory.fromConfig(config);
    expect(connector.type).toBe("csv");
  });
});

// ─── Abstract Factory ─────────────────────────────────────────────────────────

describe("StorageFactory (Abstract Factory)", () => {
  it("la famille Postgres produit Reader + Writer + Validator cohérents", async () => {
    const { StorageFactory } = await import("../src/storage/StorageFactory.js");
    const factory = StorageFactory.create("postgres");

    expect(factory.familyName).toBe("postgres");

    const opts = { connectionString: "postgresql://u:p@localhost/db", tableName: "users" };
    const reader    = factory.createReader(opts);
    const writer    = factory.createWriter(opts);
    const validator = factory.createValidator(opts);

    expect(typeof reader.read).toBe("function");
    expect(typeof writer.write).toBe("function");
    expect(typeof validator.validate).toBe("function");
  });

  it("la famille Filesystem est cohérente", async () => {
    const { StorageFactory } = await import("../src/storage/StorageFactory.js");
    const factory = StorageFactory.create("filesystem");

    expect(factory.familyName).toBe("filesystem");
    const opts = { basePath: "/tmp/forge", format: "json" as const };
    expect(factory.createReader(opts)).toBeDefined();
    expect(factory.createWriter(opts)).toBeDefined();
  });

  it("FilesystemValidator valide le schéma", async () => {
    const { StorageFactory } = await import("../src/storage/StorageFactory.js");
    const factory    = StorageFactory.create("filesystem");
    const validator  = factory.createValidator({ basePath: "/tmp", schema: { name: "string", age: "number" } });

    const valid   = validator.validate([{ name: "Alice", age: 30 }]);
    expect(valid.valid).toBe(true);

    const invalid = validator.validate([{ name: "Alice" }]); // age manquant
    expect(invalid.valid).toBe(false);
    expect(invalid.errors[0].field).toBe("age");
  });

  it("lève une erreur pour un type de storage inconnu", async () => {
    const { StorageFactory } = await import("../src/storage/StorageFactory.js");
    expect(() => StorageFactory.create("unknown" as never)).toThrow();
  });
});
