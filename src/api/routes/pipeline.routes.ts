// ─────────────────────────────────────────────────────────────────────────────
// Routes Express pour les pipelines.
// Illustre comment le Builder et la Factory Method s'utilisent côté API.
// ─────────────────────────────────────────────────────────────────────────────

import { Router, type Request, type Response } from "express";
import type { IPipeline } from "../../types/index.js";
import { PipelineBuilder } from "../../pipeline/PipelineBuilder.js";
import { ConnectorFactory } from "../../connectors/ConnectorFactory.js";
import type { ConnectorOptions } from "../../connectors/ConnectorFactory.js";

export const pipelineRouter = Router();

// In-memory store (sera remplacé par PostgreSQL en semaine 2)
// Analogie : Repository pattern — même interface, implémentation swappable
const pipelineStore = new Map<string, IPipeline>();

// Crée un pipeline via le Builder
//
// Body exemple :
// {
//   "name": "users_sync",
//   "source": { "type": "csv", "options": { "filePath": "./data/users.csv" } },
//   "destination": { "type": "postgres", "options": { "host": "...", "table": "users" } },
//   "steps": [
//     { "type": "filter", "options": { "expression": "age > 18" } },
//     { "type": "deduplicate", "options": { "key": "email" } }
//   ],
//   "options": { "batchSize": 100, "dryRun": false }
// }
pipelineRouter.post("/", (req: Request, res: Response) => {
  try {
    const { name, source, destination, steps = [], options = {} } = req.body;

    // Utilise le Builder pour construire le pipeline depuis le JSON reçu
    // → Le Builder valide la config et lève une erreur claire si incomplète
    const builder = new PipelineBuilder()
      .name(name)
      .from(source.type, source.options)
      .to(destination.type, destination.options);

    // Applique les steps dynamiquement selon leur type
    for (const step of steps) {
      switch (step.type) {
        case "filter":
          builder.filter(step.options?.expression ?? "");
          break;
        case "map":
          builder.map(step.options?.mapping ?? {});
          break;
        case "deduplicate":
          builder.deduplicate(step.options?.key ?? "id");
          break;
        case "validate":
          builder.validate(step.options?.schema ?? {});
          break;
      }
    }

    if (options.batchSize) builder.withBatchSize(options.batchSize);
    if (options.maxRetries !== undefined) builder.withRetries(options.maxRetries);
    if (options.timeoutMs) builder.withTimeout(options.timeoutMs);
    if (options.dryRun) builder.dryRun();
    if (options.verbose) builder.verbose();

    const pipeline = builder.build();
    pipelineStore.set(pipeline.id, pipeline);

    res.status(201).json({
      id: pipeline.id,
      name: pipeline.name,
      source: pipeline.source,
      destination: pipeline.destination,
      stepsCount: pipeline.steps.length,
      options: pipeline.options,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(400).json({
      error: "BadRequest",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});
pipelineRouter.get("/", (_req: Request, res: Response) => {
  const pipelines = Array.from(pipelineStore.values()).map((p) => ({
    id: p.id,
    name: p.name,
    source: p.source.type,
    destination: p.destination.type,
    stepsCount: p.steps.length,
  }));

  res.json({ count: pipelines.length, pipelines });
});
pipelineRouter.get("/:id", (req: Request, res: Response) => {
  const pipeline = pipelineStore.get(req.params.id);
  if (!pipeline) {
    return res
      .status(404)
      .json({ error: "NotFound", message: `Pipeline ${req.params.id} not found` });
  }

  res.json({
    id: pipeline.id,
    name: pipeline.name,
    source: pipeline.source,
    destination: pipeline.destination,
    steps: pipeline.steps,
    options: pipeline.options,
  });
});
pipelineRouter.post("/:id/run", async (req: Request, res: Response) => {
  const pipeline = pipelineStore.get(req.params.id);
  if (!pipeline) {
    return res
      .status(404)
      .json({ error: "NotFound", message: `Pipeline ${req.params.id} not found` });
  }

  try {
    console.log(`[API] Running pipeline "${pipeline.name}" (${pipeline.id})`);
    const result = await pipeline.run();

    const statusCode = result.status === "success" ? 200 : result.status === "partial" ? 207 : 500;
    res.status(statusCode).json(result);
  } catch (err) {
    res.status(500).json({
      error: "PipelineError",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

pipelineRouter.delete("/:id", (req: Request, res: Response) => {
  const existed = pipelineStore.delete(req.params.id);
  if (!existed) {
    return res
      .status(404)
      .json({ error: "NotFound", message: `Pipeline ${req.params.id} not found` });
  }
  res.status(204).send();
});

pipelineRouter.post("/ping", async (req: Request, res: Response) => {
  try {
    const { type, options } = req.body;

    // Factory Method en action : on crée un connecteur juste pour le ping
    const connector = ConnectorFactory.create({ type, ...options } as ConnectorOptions);
    const alive = await connector.ping();
    await connector.close();

    res.json({
      type,
      alive,
      connector: connector.name,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(400).json({
      error: "BadRequest",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});
