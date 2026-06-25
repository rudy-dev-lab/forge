// ─────────────────────────────────────────────────────────────────────────────
// Routes pour le Prototype pattern — gestion des templates de pipeline.
// ─────────────────────────────────────────────────────────────────────────────

import { Router, type Request, type Response } from "express";
import type { IPipeline } from "../../types/index.js";
import { PipelineBuilder } from "../../pipeline/PipelineBuilder.js";
import { PipelineTemplate } from "../../pipeline/PipelineTemplate.js";

export const templateRouter = Router();

// Store pour les pipelines clonés
const clonedPipelines = new Map<string, IPipeline>();
templateRouter.post("/", (req: Request, res: Response) => {
  try {
    const { name: templateName, source, destination, steps = [], options = {} } = req.body;

    const builder = new PipelineBuilder()
      .name(templateName)
      .from(source.type, source.options)
      .to(destination.type, destination.options);

    if (options.batchSize) builder.withBatchSize(options.batchSize);

    const template = PipelineTemplate.fromBuilder(builder);
    PipelineTemplate.register(templateName, template);

    res.status(201).json({
      templateName,
      message: `Template "${templateName}" registered`,
      availableTemplates: PipelineTemplate.list(),
    });
  } catch (err) {
    res.status(400).json({ error: "BadRequest", message: String(err) });
  }
});
templateRouter.get("/", (_req: Request, res: Response) => {
  res.json({ templates: PipelineTemplate.list() });
});

// Clone un template avec overrides
//
// Body exemple :
// {
//   "name": "users_sync_dryrun",
//   "overrides": {
//     "dryRun": true,
//     "batchSize": 50
//   }
// }
templateRouter.post("/:name/clone", (req: Request, res: Response) => {
  try {
    const template = PipelineTemplate.get(req.params.name);
    const { name, overrides = {} } = req.body;

    const cloned = template.clone({
      name: name ?? `${req.params.name}_clone`,
      overrideOptions: {
        ...(overrides.dryRun !== undefined && { dryRun: overrides.dryRun }),
        ...(overrides.batchSize && { batchSize: overrides.batchSize }),
        ...(overrides.maxRetries !== undefined && { maxRetries: overrides.maxRetries }),
      },
    });

    clonedPipelines.set(cloned.id, cloned);

    res.status(201).json({
      id: cloned.id,
      name: cloned.name,
      clonedFrom: req.params.name,
      options: cloned.options,
    });
  } catch (err) {
    res.status(404).json({ error: "NotFound", message: String(err) });
  }
});
templateRouter.post("/:name/dry-run", async (req: Request, res: Response) => {
  try {
    const template = PipelineTemplate.get(req.params.name);
    const dryRunPipeline = template.asDryRun();
    const result = await dryRunPipeline.run();
    res.json({ ...result, note: "Dry run — no data was written" });
  } catch (err) {
    res.status(404).json({ error: "NotFound", message: String(err) });
  }
});
