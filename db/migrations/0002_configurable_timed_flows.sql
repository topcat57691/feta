CREATE TABLE IF NOT EXISTS flow_definitions (
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  states_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (household_id, id)
);

CREATE TABLE IF NOT EXISTS flow_auto_events (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  flow_id TEXT NOT NULL,
  from_state_id TEXT NOT NULL,
  to_state_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  UNIQUE (household_id, flow_id, occurred_at)
);
CREATE INDEX IF NOT EXISTS idx_flow_auto_events_household_time
  ON flow_auto_events(household_id, occurred_at DESC);
