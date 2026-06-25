// ─────────────────────────────────────────────────────────────────────────────
// Entry point de Forge — démarre le serveur HTTP et illustre tous les patterns S1
// ─────────────────────────────────────────────────────────────────────────────

import { ConfigManager } from "./config/ConfigManager.js";
import { createServer } from "./api/server.js";
import { ConnectorFactory } from "./connectors/ConnectorFactory.js";
import { StorageFactory } from "./storage/StorageFactory.js";
import { PipelineBuilder } from "./pipeline/PipelineBuilder.js";
import { PipelineTemplate } from "./pipeline/PipelineTemplate.js";

async function bootstrap() {
  // SINGLETON — ConfigManager.getInstance() = toujours la même instance
  const config = ConfigManager.getInstance();
  console.log(`\n🔧 FORGE — Data Pipeline Engine`);
  console.log(`   env: ${config.app.env} | port: ${config.app.port}\n`);

  // ──────────────────────────────────────────────────────────────────────────
  // DÉMO des 5 patterns Creational (visible au démarrage en dev)
  // ──────────────────────────────────────────────────────────────────────────

  if (config.app.env === "development") {
    console.log("━━━ Pattern Demo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // SINGLETON : même instance retournée
    const config2 = ConfigManager.getInstance();
    console.log(`✓ Singleton: same instance? ${config === config2}`); // true

    // FACTORY METHOD : crée un connecteur sans connaître la classe concrète
    const csvConnector = ConnectorFactory.create({
      type: "csv",
      filePath: "./data/sample.csv",
    });
    console.log(`✓ Factory Method: created "${csvConnector.name}" (type: ${csvConnector.type})`);

    // ABSTRACT FACTORY : famille cohérente Postgres
    const pgFactory = StorageFactory.create("postgres");
    const pgReader = pgFactory.createReader({
      connectionString: `postgresql://${config.database.user}:${config.database.password}@${config.database.host}:${config.database.port}/${config.database.database}`,
      tableName: "users",
    });
    const pgWriter = pgFactory.createWriter({
      connectionString: `postgresql://${config.database.user}:${config.database.password}@${config.database.host}:${config.database.port}/${config.database.database}`,
      tableName: "users_clean",
    });
    console.log(`✓ Abstract Factory: family="${pgFactory.familyName}" → Reader + Writer cohérents`);

    // ⑤ BUILDER : construction fluent d'un pipeline
    const pipeline = new PipelineBuilder()
      .name("users_etl")
      .from("csv", { filePath: "./data/users.csv" })
      .filter("age > 18")
      .deduplicate("email")
      .validate({ name: "string", age: "number", email: "string" })
      .to("json", { filePath: "./data/users_clean.json" })
      .withBatchSize(100)
      .withRetries(2)
      .dryRun()
      .build();

    console.log(`✓ Builder: pipeline "${pipeline.name}" built (${pipeline.steps.length} steps)`);

    // PROTOTYPE : clone du pipeline avec override
    const template = new PipelineTemplate(pipeline);
    const prodPipeline = template.clone({
      name: "users_etl_prod",
      overrideOptions: { dryRun: false, batchSize: 500 },
    });

    PipelineTemplate.register("users_etl", template);
    console.log(
      `✓ Prototype: cloned "${pipeline.name}" → "${prodPipeline.name}" (dryRun: ${prodPipeline.options.dryRun})`
    );

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Démarrage du serveur HTTP
  // ──────────────────────────────────────────────────────────────────────────
  const app = createServer();

  const server = app.listen(config.app.port, () => {
    console.log(`🚀 Forge API running → http://localhost:${config.app.port}`);
    console.log(`   GET  /health`);
    console.log(`   POST /pipelines`);
    console.log(`   POST /pipelines/:id/run`);
    console.log(`   POST /templates/:name/clone`);
    console.log(`   POST /templates/:name/dry-run\n`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[Forge] ${signal} received — shutting down gracefully...`);
    server.close(() => {
      console.log("[Forge] HTTP server closed");
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000); // Force kill après 10s
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap().catch((err) => {
  console.error("[Forge] Fatal error during bootstrap:", err);
  process.exit(1);
});
