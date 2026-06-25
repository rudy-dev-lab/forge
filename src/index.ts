// ─────────────────────────────────────────────────────────────────────────────
// Entry point de Forge — démarre le serveur HTTP et illustre tous les patterns S1
// ─────────────────────────────────────────────────────────────────────────────

import { ConfigManager } from "./config/ConfigManager.js";
import { createServer } from "./api/server.js";

async function bootstrap() {
    // ① SINGLETON — ConfigManager.getInstance() = toujours la même instance
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
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Démarrage du serveur HTTP
    // ──────────────────────────────────────────────────────────────────────────
    const app = createServer();

    const server = app.listen(config.app.port, () => {
        console.log(`🚀 Forge API running → http://localhost:${config.app.port}`);
        console.log(`   GET  /health`);
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
