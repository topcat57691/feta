import type { FlowDefinition, FlowInstance, FlowInstanceEvent } from '../src/app/types';
import { isLaundryState, laundryAutoTransition, laundryNextState, occupiedAppliance, type LaundryAction, type LaundryState } from '../src/features/laundry/laundry';
import type { D1Database } from './types';

interface InstanceRow {
  id: string;
  flow_id: string;
  name: string;
  state_id: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}
interface EventRow {
  id: string;
  instance_id: string;
  flow_id: string;
  name: string;
  from_state_id: string;
  to_state_id: string;
  person_id: string | null;
  occurred_at: string;
  automatic: number;
}
const mapInstance = (row: InstanceRow): FlowInstance => ({
  id: row.id, flowId: row.flow_id, name: row.name, stateId: row.state_id,
  createdAt: row.created_at, updatedAt: row.updated_at, completedAt: row.completed_at ?? undefined,
});

async function requirePerson(db: D1Database, householdId: string, personId: string): Promise<void> {
  if (!personId || !await db.prepare('SELECT id FROM people WHERE household_id = ? AND id = ?')
    .bind(householdId, personId).first()) throw new Error('PERSON_NOT_FOUND');
}

async function getLaundryFlow(db: D1Database, householdId: string): Promise<FlowDefinition | undefined> {
  const row = await db.prepare('SELECT name, icon, states_json FROM flow_definitions WHERE household_id = ? AND id = ?')
    .bind(householdId, 'laundry').first<{ name: string; icon: string; states_json: string }>();
  return row ? { id: 'laundry', name: row.name, icon: row.icon, states: JSON.parse(row.states_json) as FlowDefinition['states'] } : undefined;
}

// A previous FETA household could only have one laundry flow state. Move it
// exactly once into an individual load, preserving its original start time.
// The empty "clear" state is intentionally not converted into a phantom load.
export async function migrateLegacyLaundry(db: D1Database, householdId: string): Promise<void> {
  const old = await db.prepare("SELECT state_id FROM flow_states WHERE household_id = ? AND flow_id = 'laundry'")
    .bind(householdId).first<{ state_id: string }>();
  if (!old) return;
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO flow_instances
      (id, household_id, flow_id, name, state_id, created_at, updated_at)
      SELECT 'legacy-laundry-' || household_id, household_id, 'laundry', 'Previous laundry load',
        CASE state_id WHEN 'washing' THEN 'washing' WHEN 'ready-to-dry' THEN 'wet'
        WHEN 'drying' THEN 'drying' WHEN 'ready-to-put-away' THEN 'ready-to-put-away'
        ELSE 'waiting' END,
        updated_at, updated_at
      FROM flow_states
      WHERE household_id = ? AND flow_id = 'laundry' AND state_id != 'clear'`).bind(householdId),
    db.prepare("DELETE FROM flow_states WHERE household_id = ? AND flow_id = 'laundry'").bind(householdId),
  ]);
}

export async function readLaundry(
  db: D1Database, householdId: string, flow?: FlowDefinition,
): Promise<{ instances: FlowInstance[]; events: FlowInstanceEvent[] }> {
  const active = await db.prepare(`SELECT id, flow_id, name, state_id, created_at, updated_at, completed_at
    FROM flow_instances WHERE household_id = ? AND flow_id = 'laundry' AND completed_at IS NULL
    ORDER BY created_at DESC`).bind(householdId).all<InstanceRow>();

  // Estimated completion leaves a finished load IN the appliance. Only a
  // physical unload/transfer action frees that appliance for the next load.
  for (const row of active.results) {
    const due = laundryAutoTransition(mapInstance(row), flow);
    if (!due) continue;
    const result = await db.prepare(`UPDATE flow_instances SET state_id = ?, updated_at = ?
      WHERE household_id = ? AND id = ? AND state_id = ? AND updated_at = ? AND completed_at IS NULL`)
      .bind(due.to, due.occurredAt, householdId, row.id, row.state_id, row.updated_at).run() as { meta?: { changes?: number } };
    if (result.meta?.changes !== 1) continue;
    await db.prepare(`INSERT INTO flow_instance_events
      (id, household_id, instance_id, flow_id, name, from_state_id, to_state_id, occurred_at, automatic)
      VALUES (?, ?, ?, 'laundry', ?, ?, ?, ?, 1)`)
      .bind(crypto.randomUUID(), householdId, row.id, row.name, row.state_id, due.to, due.occurredAt).run();
  }

  const [instances, events] = await Promise.all([
    db.prepare(`SELECT id, flow_id, name, state_id, created_at, updated_at, completed_at
      FROM flow_instances WHERE household_id = ? AND flow_id = 'laundry' AND completed_at IS NULL
      ORDER BY created_at DESC`).bind(householdId).all<InstanceRow>(),
    db.prepare(`SELECT id, instance_id, flow_id, name, from_state_id, to_state_id, person_id, occurred_at, automatic
      FROM flow_instance_events WHERE household_id = ? ORDER BY occurred_at DESC LIMIT 200`)
      .bind(householdId).all<EventRow>(),
  ]);
  return {
    instances: instances.results.map(mapInstance),
    events: events.results.map((row) => ({
      id: row.id, instanceId: row.instance_id, flowId: row.flow_id, instanceName: row.name,
      fromStateId: row.from_state_id, toStateId: row.to_state_id,
      personId: row.person_id ?? undefined, occurredAt: row.occurred_at, automatic: Boolean(row.automatic),
    })),
  };
}

export async function createLaundryLoad(
  db: D1Database, householdId: string, personId: string, name?: string,
): Promise<void> {
  await requirePerson(db, householdId, personId);
  const count = await db.prepare("SELECT COUNT(*) AS total FROM flow_instances WHERE household_id = ? AND flow_id = 'laundry'")
    .bind(householdId).first<{ total: number }>();
  const cleanName = name?.trim() || 'Load ' + ((count?.total ?? 0) + 1);
  if (cleanName.length > 70) throw new Error('LAUNDRY_NAME_INVALID');
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.batch([
    db.prepare(`INSERT INTO flow_instances (id, household_id, flow_id, name, state_id, created_at, updated_at)
      VALUES (?, ?, 'laundry', ?, 'waiting', ?, ?)`).bind(id, householdId, cleanName, now, now),
    db.prepare(`INSERT INTO flow_instance_events
      (id, household_id, instance_id, flow_id, name, from_state_id, to_state_id, person_id, occurred_at, automatic)
      VALUES (?, ?, ?, 'laundry', ?, '', 'waiting', ?, ?, 0)`)
      .bind(crypto.randomUUID(), householdId, id, cleanName, personId, now),
  ]);
}

export async function renameLaundryLoad(
  db: D1Database, householdId: string, personId: string, id: string, name: string,
): Promise<void> {
  await requirePerson(db, householdId, personId);
  const clean = name.trim();
  if (!clean || clean.length > 70) throw new Error('LAUNDRY_NAME_INVALID');
  const result = await db.prepare(`UPDATE flow_instances SET name = ?
    WHERE household_id = ? AND flow_id = 'laundry' AND id = ? AND completed_at IS NULL`)
    .bind(clean, householdId, id).run() as { meta?: { changes?: number } };
  if (result.meta?.changes !== 1) throw new Error('LAUNDRY_NOT_FOUND');
}

export async function transitionLaundryLoad(
  db: D1Database, householdId: string, personId: string, id: string, action: LaundryAction,
): Promise<void> {
  await requirePerson(db, householdId, personId);
  const row = await db.prepare(`SELECT id, flow_id, name, state_id, created_at, updated_at, completed_at
    FROM flow_instances WHERE household_id = ? AND flow_id = 'laundry' AND id = ? AND completed_at IS NULL`)
    .bind(householdId, id).first<InstanceRow>();
  if (!row || !isLaundryState(row.state_id)) throw new Error('LAUNDRY_NOT_FOUND');

  // Catch up elapsed timers first, then ask the phone to refresh rather than
  // applying a stale action to a different stage.
  const due = laundryAutoTransition(mapInstance(row), await getLaundryFlow(db, householdId));
  if (due) {
    await readLaundry(db, householdId, await getLaundryFlow(db, householdId));
    throw new Error('LAUNDRY_STALE');
  }

  const next = laundryNextState(row.state_id as LaundryState, action);
  if (!next) throw new Error('LAUNDRY_TRANSITION_INVALID');
  if (next !== 'done') {
    const resource = occupiedAppliance(next);
    if (resource) {
      const states = resource === 'washer' ? ['washing', 'wash-complete'] : ['drying', 'dryer-complete'];
      const busy = await db.prepare(`SELECT id FROM flow_instances
        WHERE household_id = ? AND flow_id = 'laundry' AND completed_at IS NULL AND id != ?
        AND state_id IN (?, ?) LIMIT 1`).bind(householdId, id, ...states).first<{ id: string }>();
      if (busy) throw new Error('APPLIANCE_BUSY');
    }
  }
  const now = new Date().toISOString();
  const result = await db.prepare(`UPDATE flow_instances
    SET state_id = ?, updated_at = ?, completed_at = ?
    WHERE household_id = ? AND id = ? AND state_id = ? AND updated_at = ? AND completed_at IS NULL`)
    .bind(next, now, next === 'done' ? now : null, householdId, id, row.state_id, row.updated_at)
    .run() as { meta?: { changes?: number } };
  if (result.meta?.changes !== 1) throw new Error('LAUNDRY_STALE');
  await db.prepare(`INSERT INTO flow_instance_events
    (id, household_id, instance_id, flow_id, name, from_state_id, to_state_id, person_id, occurred_at, automatic)
    VALUES (?, ?, ?, 'laundry', ?, ?, ?, ?, ?, 0)`)
    .bind(crypto.randomUUID(), householdId, id, row.name, row.state_id, next, personId, now).run();
}
