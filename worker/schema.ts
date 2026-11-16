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

const CALENDAR_SCHEMA_STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS calendar_connections (\n  household_id TEXT PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,\n  refresh_token TEXT NOT NULL,\n  account_label TEXT NOT NULL,\n  updated_at TEXT NOT NULL\n)",
  "CREATE TABLE IF NOT EXISTS calendar_sources (\n  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,\n  calendar_id TEXT NOT NULL,\n  name TEXT NOT NULL,\n  color TEXT,\n  selected INTEGER NOT NULL DEFAULT 0,\n  last_sync TEXT,\n  last_error TEXT,\n  channel_id TEXT,\n  channel_token TEXT,\n  resource_id TEXT,\n  channel_expiration INTEGER,\n  PRIMARY KEY (household_id, calendar_id)\n)",
  "CREATE INDEX IF NOT EXISTS idx_calendar_sources_selected ON calendar_sources(household_id, selected)",
  "CREATE TABLE IF NOT EXISTS calendar_events (\n  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,\n  calendar_id TEXT NOT NULL,\n  event_id TEXT NOT NULL,\n  title TEXT NOT NULL,\n  starts_at TEXT NOT NULL,\n  ends_at TEXT NOT NULL,\n  all_day INTEGER NOT NULL DEFAULT 0,\n  batch_id TEXT NOT NULL,\n  PRIMARY KEY (household_id, calendar_id, event_id),\n  FOREIGN KEY (household_id, calendar_id) REFERENCES calendar_sources(household_id, calendar_id) ON DELETE CASCADE\n)",
  "CREATE INDEX IF NOT EXISTS idx_calendar_events_next ON calendar_events(household_id, starts_at)",
  "CREATE TABLE IF NOT EXISTS calendar_completions (\n  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,\n  calendar_id TEXT NOT NULL,\n  event_id TEXT NOT NULL,\n  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,\n  completed_at TEXT NOT NULL,\n  PRIMARY KEY (household_id, calendar_id, event_id)\n)",
  "CREATE TABLE IF NOT EXISTS calendar_oauth_states (\n  state TEXT PRIMARY KEY,\n  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,\n  verifier TEXT NOT NULL,\n  expires_at INTEGER NOT NULL\n)",
  "CREATE INDEX IF NOT EXISTS idx_calendar_oauth_expiration ON calendar_oauth_states(expires_at);",
] as const;

export async function ensureSchema(db: D1Database): Promise<void> {
  if (schemaReady) return;

  // Always ensure additive schema objects on older hosted households too.
  await db.batch([...SCHEMA_STATEMENTS, ...CALENDAR_SCHEMA_STATEMENTS].map((statement) => db.prepare(statement)));

  schemaReady = true;
}
