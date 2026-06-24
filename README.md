# 🔧 FORGE — Base Project (Semaine 1 — 5 Creational Patterns)

Point de départ du side project GoF. Implémente les 5 patterns **Creational** :

| # | Pattern | Fichier | Feature |
|---|---------|---------|---------|
| 1 | **Singleton** | `src/config/ConfigManager.ts` | Config globale unique |
| 2 | **Factory Method** | `src/connectors/ConnectorFactory.ts` | `create(type) → IConnector` |
| 3 | **Abstract Factory** | `src/storage/StorageFactory.ts` | Familles Postgres/S3/Filesystem |
| 4 | **Builder** | `src/pipeline/PipelineBuilder.ts` | API fluent `.from().filter().build()` |
| 5 | **Prototype** | `src/pipeline/PipelineTemplate.ts` | Clone + overrides partiels |

## Structure

```
src/
├── types/          # Interfaces fondamentales (IConnector, IPipeline…)
├── config/         # Singleton — ConfigManager
├── connectors/     # Factory Method — ConnectorFactory + CSV/JSON/Postgres
├── storage/        # Abstract Factory — StorageFactory + familles
├── pipeline/       # Builder + Prototype — PipelineBuilder, PipelineTemplate
├── api/            # Express HTTP (Facade preview)
└── index.ts        # Entry point avec démo des 5 patterns
```

## Quick Start

```bash
npm install
cp .env.example .env
npm test
npm run dev # API sur localhost:3000
```

## Exemple

```typescript
// Factory Method
const connector = ConnectorFactory.create({ type: "csv", filePath: "./data.csv" });

// Builder
const pipeline = new PipelineBuilder()
  .name("users_etl")
  .from("csv", { filePath: "./data/users.csv" })
  .filter("age > 18")
  .to("json", { filePath: "./data/output.json" })
  .dryRun()
  .build();

// Prototype
const template = new PipelineTemplate(pipeline);
const prod = template.clone({ overrideOptions: { dryRun: false } });
```

## Semaines suivantes

Ajouter dans cet ordre les patterns des semaines 2, 3 et 4 pour obtenir le projet final.
