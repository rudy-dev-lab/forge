// ─────────────────────────────────────────────────────────────────────────────
// Tests du pattern Singleton — ConfigManager
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConfigManager } from "../src/config/ConfigManager.js";

describe("ConfigManager (Singleton)", () => {
  // IMPORTANT : reset entre chaque test pour isoler les effets de bord
  // En NestJS, Test.createTestingModule() fait ça pour nous
  beforeEach(() => {
    ConfigManager.reset();
    // Setup env vars de test
    process.env.NODE_ENV = "test";
    process.env.PORT = "4000";
    process.env.POSTGRES_HOST = "test-host";
    process.env.PIPELINE_BATCH_SIZE = "250";
  });

  afterEach(() => {
    ConfigManager.reset();
  });

  it("retourne toujours la même instance (Singleton garantit l'unicité)", () => {
    const instance1 = ConfigManager.getInstance();
    const instance2 = ConfigManager.getInstance();
    const instance3 = ConfigManager.getInstance();

    // Les 3 références pointent vers le même objet en mémoire
    expect(instance1).toBe(instance2);
    expect(instance2).toBe(instance3);
  });

  it("lit les variables d'environnement correctement", () => {
    const cfg = ConfigManager.getInstance();

    expect(cfg.app.env).toBe("test");
    expect(cfg.app.port).toBe(4000);
    expect(cfg.database.host).toBe("test-host");
    expect(cfg.pipeline.batchSize).toBe(250);
  });

  it("accède aux valeurs imbriquées via dot notation", () => {
    const cfg = ConfigManager.getInstance();

    expect(cfg.get<number>("app.port")).toBe(4000);
    expect(cfg.get<string>("database.host")).toBe("test-host");
    expect(cfg.get<number>("pipeline.batchSize")).toBe(250);
  });

  it("lève une erreur sur une clé inexistante", () => {
    const cfg = ConfigManager.getInstance();

    expect(() => cfg.get("app.nonexistent")).toThrow(/Config key/);
    expect(() => cfg.get("app.nonexistent.deep")).toThrow();
  });

  it("fournit des valeurs par défaut si les env vars sont absentes", () => {
    delete process.env.PIPELINE_BATCH_SIZE;
    ConfigManager.reset();

    const cfg = ConfigManager.getInstance();
    expect(cfg.pipeline.batchSize).toBe(500); // Valeur par défaut
  });

  it("après reset(), une nouvelle instance est créée (utile pour les tests)", () => {
    const instance1 = ConfigManager.getInstance();
    ConfigManager.reset();
    process.env.PORT = "9999";
    const instance2 = ConfigManager.getInstance();

    // Pas la même instance
    expect(instance1).not.toBe(instance2);
    expect(instance2.app.port).toBe(9999);
  });
});
