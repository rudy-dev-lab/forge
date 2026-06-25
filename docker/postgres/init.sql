-- docker/postgres/init.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Tables de démonstration pour les tests et exemples Forge
-- ─────────────────────────────────────────────────────────────────────────────

-- Table users (source / destination de démonstration)
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  age         INTEGER,
  status      VARCHAR(50) DEFAULT 'active',
  country     VARCHAR(2),
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Table users_clean (destination après transformation)
CREATE TABLE IF NOT EXISTS users_clean (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  age         INTEGER,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Table pipeline_runs (log des exécutions — utilisé en Semaine 3)
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id   UUID NOT NULL,
  pipeline_name VARCHAR(255) NOT NULL,
  status        VARCHAR(50) NOT NULL,
  rows_read     INTEGER DEFAULT 0,
  rows_written  INTEGER DEFAULT 0,
  rows_failed   INTEGER DEFAULT 0,
  duration_ms   INTEGER DEFAULT 0,
  errors        JSONB DEFAULT '[]',
  started_at    TIMESTAMP NOT NULL,
  completed_at  TIMESTAMP
);

-- Données de test
INSERT INTO users (name, email, age, status, country) VALUES
  ('Alice Martin',   'alice@example.com',   28, 'active',   'FR'),
  ('Bob Smith',      'bob@example.com',     16, 'active',   'US'),
  ('Charlie Dupont', 'charlie@example.com', 35, 'inactive', 'FR'),
  ('Diana Prince',   'diana@example.com',   29, 'active',   'GB'),
  ('Eve Johnson',    'eve@example.com',     22, 'active',   'US')
ON CONFLICT DO NOTHING;
