// ─────────────────────────────────────────────────────────────────────────────
// Logger structuré — wrappé autour de pino.
// Singleton léger : on exporte une instance unique.
// En semaine 2, le Decorator pattern l'utilisera pour les ConnectorProxy logs.
// ─────────────────────────────────────────────────────────────────────────────

import pino from "pino";
import { config } from "../config/ConfigManager.js";

// Singleton d'instance logger — partagé dans tout le process
// Analogie NestJS : Logger service injecté via DI
export const logger = pino({
  level: config.app.logLevel,
  transport:
    config.app.env !== "production"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
      : undefined,
  base: { service: "forge" },
});

// Logger enfant typé par module (context = nom du module)
// Usage : const log = createLogger("PipelineBuilder")
export function createLogger(context: string) {
  return logger.child({ context });
}
