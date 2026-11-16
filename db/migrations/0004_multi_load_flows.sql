CREATE TABLE IF NOT EXISTS flow_instances (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    flow_id TEXT NOT NULL,
    name TEXT NOT NULL,
    state_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT
  );

CREATE INDEX IF NOT EXISTS idx_flow_instances_household ON flow_instances(household_id, flow_id, completed_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_laundry_washer_occupied ON flow_instances(household_id) WHERE flow_id = 'laundry' AND completed_at IS NULL AND state_id IN ('washing', 'wash-complete');

CREATE UNIQUE INDEX IF NOT EXISTS idx_laundry_dryer_occupied ON flow_instances(household_id) WHERE flow_id = 'laundry' AND completed_at IS NULL AND state_id IN ('drying', 'dryer-complete');

CREATE TABLE IF NOT EXISTS flow_instance_events (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    instance_id TEXT NOT NULL,
    flow_id TEXT NOT NULL,
    name TEXT NOT NULL,
    from_state_id TEXT NOT NULL,
    to_state_id TEXT NOT NULL,
    person_id TEXT REFERENCES people(id) ON DELETE SET NULL,
    occurred_at TEXT NOT NULL,
    automatic INTEGER NOT NULL DEFAULT 0
  );

CREATE INDEX IF NOT EXISTS idx_flow_instance_events_household_time ON flow_instance_events(household_id, occurred_at DESC);
