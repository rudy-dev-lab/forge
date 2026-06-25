// ─────────────────────────────────────────────────────────────────────────────
// Types & Interfaces fondamentaux de Forge.
// Ces interfaces sont les "contrats" que tous les patterns vont respecter.
// Analogie NestJS : comme les interfaces de module (ModuleMetadata, etc.)
// ─────────────────────────────────────────────────────────────────────────────

// Un row générique circulant dans le pipeline.
// Record<string, unknown> = objet clé/valeur sans contrainte de type a priori.
export type Row = Record<string, unknown>;

// Un dataset est un tableau de rows.
// En semaine 3, on passera à AsyncIterable<Row> pour le streaming.
export type Dataset = Row[];

// INTERFACE PRINCIPALE : IConnector
// Tout connecteur (CSV, JSON, Postgres, S3…) DOIT implémenter cette interface.
// C'est ce que le Factory Method va retourner — le consommateur ne connaît
// que cette interface, jamais la classe concrète.
// Analogie : comme un Repository interface en NestJS (IUsersRepository)
export interface IConnector {
  // Nom lisible du connecteur (pour les logs et l'UI)
  readonly name: string;

  // Type de source/destination
  readonly type: ConnectorType;

  // Lit les données depuis la source → retourne un Dataset
  read(): Promise<Dataset>;

  // Écrit un Dataset vers la destination
  write(data: Dataset): Promise<WriteResult>;

  // Teste la connectivité (health check)
  ping(): Promise<boolean>;

  // Libère les ressources (connexions DB, file handles…)
  close(): Promise<void>;
}

// Types de connecteurs supportés par Forge.
// Utilisé par la ConnectorFactory pour savoir quelle classe instancier.
export type ConnectorType = "csv" | "json" | "postgres" | "s3" | "filesystem";

// Une "famille" Storage = Reader + Writer + Validator cohérents.
// L'Abstract Factory garantit qu'on ne mélange pas un PostgresReader avec un S3Writer.
export interface IReader {
  read(source: string): Promise<Dataset>;
}

export interface IWriter {
  write(destination: string, data: Dataset): Promise<WriteResult>;
}

export interface IValidator {
  validate(data: Dataset): ValidationResult;
}

export interface WriteResult {
  rowsWritten: number;
  duration: number; // ms
  errors: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  rowsChecked: number;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

// Ce que le Builder va construire.
// Un Pipeline est une configuration complète (source → steps → destination).
export interface IPipeline {
  readonly id: string;
  readonly name: string;
  readonly source: ConnectorConfig;
  readonly destination: ConnectorConfig;
  readonly steps: StepConfig[];
  readonly options: PipelineOptions;

  // Exécution du pipeline (implémentée en semaine 2+)
  run(): Promise<PipelineResult>;

  // Clone du pipeline (Prototype pattern)
  clone(): IPipeline;
}

// Configuration d'un connecteur (passée à la Factory)
export interface ConnectorConfig {
  type: ConnectorType;
  options: Record<string, unknown>;
}

// Un step de transformation
export interface StepConfig {
  name: string;
  type: StepType;
  options?: Record<string, unknown>;
}

export type StepType = "filter" | "map" | "validate" | "aggregate" | "deduplicate";

// Options globales du pipeline
export interface PipelineOptions {
  batchSize: number;
  maxRetries: number;
  timeoutMs: number;
  dryRun: boolean;
  verbose: boolean;
}

// Résultat d'exécution
export interface PipelineResult {
  pipelineId: string;
  status: "success" | "partial" | "failed";
  rowsRead: number;
  rowsWritten: number;
  rowsFailed: number;
  duration: number; // ms
  errors: string[];
  startedAt: Date;
  completedAt: Date;
}

// Types de storage supportés par l'Abstract Factory
export type StorageType = "postgres" | "s3" | "filesystem";
