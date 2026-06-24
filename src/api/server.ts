// ─────────────────────────────────────────────────────────────────────────────
// Serveur Express — expose les pipelines via une API REST.
// PATTERN : Facade (GoF Structural — sera approfondi en S2)
// L'API est la façade qui cache toute la complexité du pipeline engine.
// ─────────────────────────────────────────────────────────────────────────────

import express, { type Request, type Response, type NextFunction } from "express";
import { config } from "../config/ConfigManager.js";

export function createServer() {
  const app = express();

  // Middlewares globaux
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging middleware
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[HTTP] ${req.method} ${req.path}`);
    next();
  });

  // Routes
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "forge",
      version: "0.0.1",
      env: config.app.env,
      timestamp: new Date().toISOString(),
    });
  });

  // Error handler global
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[HTTP] Unhandled error:", err.message);
    res.status(500).json({
      error: err.name ?? "InternalServerError",
      message: err.message,
      ...(config.app.env !== "production" && { stack: err.stack }),
    });
  });

  return app;
}
