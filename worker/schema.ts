import type { D1Database } from './types';

let schemaReady = false;

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS households (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    admin_pin_hash TEXT,
    admin_pin_salt TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS people (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    pin_salt TEXT NOT NULL,
    color TEXT NOT NULL,
    availability TEXT NOT NULL CHECK (availability IN ('in-zone', 'free', 'drained', 'out')),
    capacity INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 5),
    presence TEXT NOT NULL CHECK (presence IN ('home', 'out')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_people_household ON people(household_id)',
  `CREATE TABLE IF NOT EXISTS daily_checks (
    person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    slept_okay INTEGER NOT NULL DEFAULT 0,
    feeling_okay INTEGER NOT NULL DEFAULT 0,
    vitamins INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (person_id, date)
  )`,
  `CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('session', 'counted', 'calendar')),
    enabled INTEGER NOT NULL DEFAULT 1,
    unit_label TEXT,
    cadence_rate REAL NOT NULL DEFAULT 1,
    cadence_period TEXT NOT NULL DEFAULT 'day' CHECK (cadence_period IN ('day', 'week', 'month')),
    cadence_mode TEXT NOT NULL DEFAULT 'auto' CHECK (cadence_mode IN ('auto', 'manual')),
    preferred_day INTEGER CHECK (preferred_day BETWEEN 0 AND 6),
    calendar_day INTEGER CHECK (calendar_day BETWEEN 0 AND 6),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_jobs_household ON jobs(household_id)',
  `CREATE TABLE IF NOT EXISTS job_events (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    occurred_at TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    left_too_long INTEGER NOT NULL DEFAULT 0
  )`,
  'CREATE INDEX IF NOT EXISTS idx_job_events_job_time ON job_events(job_id, occurred_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_job_events_household_time ON job_events(household_id, occurred_at DESC)',
  `CREATE TABLE IF NOT EXISTS flow_states (
    household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    flow_id TEXT NOT NULL,
    state_id TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT REFERENCES people(id) ON DELETE SET NULL,
    PRIMARY KEY (household_id, flow_id)
  )`,
  `CREATE TABLE IF NOT EXISTS flow_events (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    flow_id TEXT NOT NULL,
    from_state_id TEXT NOT NULL,
    to_state_id TEXT NOT NULL,
    person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    occurred_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_flow_events_household_time ON flow_events(household_id, occurred_at DESC)',
  `CREATE TABLE IF NOT EXISTS flow_definitions (
    household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    states_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (household_id, id)
  )`,
  `CREATE TABLE IF NOT EXISTS flow_auto_events (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    flow_id TEXT NOT NULL,
    from_state_id TEXT NOT NULL,
    to_state_id TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    UNIQUE (household_id, flow_id, occurred_at)
  )`,
  'CREATE INDEX IF NOT EXISTS idx_flow_auto_events_household_time ON flow_auto_events(household_id, occurred_at DESC)',
] as const;

export async function ensureSchema(db: D1Database): Promise<void> {
  if (schemaReady) return;

  // Always ensure additive schema objects on older hosted households too.
  await db.batch(SCHEMA_STATEMENTS.map((statement) => db.prepare(statement)));

  schemaReady = true;
}
