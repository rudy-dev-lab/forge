import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

export interface AppConfig {
  env: "development" | "production" | "test";
  port: number;
  logLevel: "debug" | "info" | "warn" | "error";
}

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  poolMin: number;
  poolMax: number;
}

export interface PipelineConfig {
  batchSize: number;
  maxRetries: number;
  timeoutMs: number;
}

export interface ForgeConfig {
  app: AppConfig;
  database: DatabaseConfig;
  pipeline: PipelineConfig;
}

// ConfigManager (Singleton)

export class ConfigManager {
  // Propriété statique privée : stocke l'unique instance.
  // undefined au démarrage → sera créée au premier appel à getInstance().
  // Analogie : le container DI de NestJS qui garde la ref du service en mémoire.
  private static instance: ConfigManager | undefined;

  // La config chargée, typée fortement.
  private readonly config: ForgeConfig;

  // Constructeur PRIVÉ : personne ne peut faire `new ConfigManager()` à l'extérieur.
  // C'est la clé du pattern — la classe contrôle sa propre naissance.
  private constructor() {
    // Charge le .env si présent (uniquement en dev/test)
    this.loadEnvFile();

    // Construit la config à partir des variables d'environnement
    this.config = this.buildConfig();

    console.log(`[ConfigManager] ✓ Initialized for env="${this.config.app.env}"`);
  }

  // POINT D'ACCÈS UNIQUE : méthode statique publique.
  // Si l'instance n'existe pas encore → on la crée (lazy initialization).
  // Si elle existe déjà → on retourne la même référence.
  // Thread-safe en Node.js (single-threaded event loop).
  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  // Méthode utilitaire pour les TESTS : réinitialise le singleton.
  // En NestJS c'est le `Test.createTestingModule()` qui isole le contexte.
  // Ici on gère manuellement.
  public static reset(): void {
    ConfigManager.instance = undefined;
  }

  public get app(): AppConfig {
    return this.config.app;
  }

  public get database(): DatabaseConfig {
    return this.config.database;
  }

  public get pipeline(): PipelineConfig {
    return this.config.pipeline;
  }

  // Accès à une clé imbriquée via un chemin "dot notation" — ex: "app.port"
  public get<T>(path: string): T {
    const keys = path.split(".");
    let current: unknown = this.config;

    for (const key of keys) {
      if (current === null || typeof current !== "object") {
        throw new Error(`[ConfigManager] Config path not found: "${path}"`);
      }
      current = (current as Record<string, unknown>)[key];
    }

    if (current === undefined) {
      throw new Error(`[ConfigManager] Config key "${path}" is undefined`);
    }

    return current as T;
  }

  private loadEnvFile(): void {
    const envPath = resolve(process.cwd(), ".env");
    if (!existsSync(envPath)) return;

    // Parse manuel du .env pour éviter une dépendance à dotenv en prod
    // (dotenv reste en devDependency pour le dev local)
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed
        .slice(eqIndex + 1)
        .trim()
        .replace(/^["']|["']$/g, "");

      // Ne pas écraser les variables déjà définies dans l'environnement
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }

  private buildConfig(): ForgeConfig {
    return {
      app: {
        env: this.parseEnum(
          process.env.NODE_ENV,
          ["development", "production", "test"],
          "development"
        ) as AppConfig["env"],
        port: this.parseInt(process.env.PORT, 3000),
        logLevel: this.parseEnum(
          process.env.LOG_LEVEL,
          ["debug", "info", "warn", "error"],
          "info"
        ) as AppConfig["logLevel"],
      },
      database: {
        host: process.env.POSTGRES_HOST ?? "localhost",
        port: this.parseInt(process.env.POSTGRES_PORT, 5432),
        user: process.env.POSTGRES_USER ?? "forge",
        password: process.env.POSTGRES_PASSWORD ?? "forge_secret",
        database: process.env.POSTGRES_DB ?? "forge_db",
        poolMin: this.parseInt(process.env.POSTGRES_POOL_MIN, 2),
        poolMax: this.parseInt(process.env.POSTGRES_POOL_MAX, 10),
      },
      pipeline: {
        batchSize: this.parseInt(process.env.PIPELINE_BATCH_SIZE, 500),
        maxRetries: this.parseInt(process.env.PIPELINE_MAX_RETRIES, 3),
        timeoutMs: this.parseInt(process.env.PIPELINE_TIMEOUT_MS, 30000),
      },
    };
  }

  private parseInt(value: string | undefined, defaultValue: number): number {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isNaN(parsed) ? defaultValue : parsed;
  }

  private parseEnum<T extends string>(value: string | undefined, allowed: T[], defaultValue: T): T {
    if (value && (allowed as string[]).includes(value)) return value as T;
    return defaultValue;
  }
}

// Export d'une instance pré-créée
// Convenience export — permet `import { config } from './config/ConfigManager'`
// L'instance sera la même que ConfigManager.getInstance() partout dans l'app.
// Analogie : comme `export default new ConfigService()` en dehors d'un DI container.
export const config = ConfigManager.getInstance();
