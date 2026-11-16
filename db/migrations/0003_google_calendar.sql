CREATE TABLE IF NOT EXISTS calendar_connections (
  household_id TEXT PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL,
  account_label TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS calendar_sources (
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  calendar_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  selected INTEGER NOT NULL DEFAULT 0,
  last_sync TEXT,
  last_error TEXT,
  channel_id TEXT,
  channel_token TEXT,
  resource_id TEXT,
  channel_expiration INTEGER,
  PRIMARY KEY (household_id, calendar_id)
);
CREATE INDEX IF NOT EXISTS idx_calendar_sources_selected ON calendar_sources(household_id, selected);
CREATE TABLE IF NOT EXISTS calendar_events (
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  calendar_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0,
  batch_id TEXT NOT NULL,
  PRIMARY KEY (household_id, calendar_id, event_id),
  FOREIGN KEY (household_id, calendar_id) REFERENCES calendar_sources(household_id, calendar_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_calendar_events_next ON calendar_events(household_id, starts_at);
CREATE TABLE IF NOT EXISTS calendar_completions (
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  calendar_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  completed_at TEXT NOT NULL,
  PRIMARY KEY (household_id, calendar_id, event_id)
);
CREATE TABLE IF NOT EXISTS calendar_oauth_states (
  state TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  verifier TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_calendar_oauth_expiration ON calendar_oauth_states(expires_at);
