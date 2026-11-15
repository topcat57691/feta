import type {
  Availability,
  CadencePeriod,
  FlowEvent,
  FlowState,
  HouseholdState,
  JobDefinition,
  JobEvent,
  JobKind,
  Person,
  Presence,
} from '../src/app/types';
import { learnCadence } from '../src/features/cadence/cadence';
import { nextFlowStateId } from '../src/features/flows/flowDefinitions';
import type { D1Database } from './types';

interface HouseholdRow {
  id: string;
  name: string;
  admin_pin_hash: string | null;
  admin_pin_salt: string | null;
}

interface PersonRow {
  id: string;
  name: string;
  color: string;
  availability: Availability;
  capacity: number;
  presence: Presence;
  updated_at: string;
  daily_date: string | null;
  slept_okay: number | null;
  feeling_okay: number | null;
  vitamins: number | null;
}

interface PersonPinRow {
  pin_hash: string;
  pin_salt: string;
}

interface JobRow {
  id: string;
  name: string;
  icon: string;
  kind: JobKind;
  enabled: number;
  unit_label: string | null;
  cadence_rate: number;
  cadence_period: CadencePeriod;
  cadence_mode: 'auto' | 'manual';
  preferred_day: number | null;
  calendar_day: number | null;
  created_at: string;
}

interface JobEventRow {
  id: string;
  job_id: string;
  person_id: string;
  occurred_at: string;
  quantity: number;
  left_too_long: number;
}

interface FlowStateRow {
  flow_id: string;
  state_id: string;
  updated_at: string;
  updated_by: string | null;
}

interface FlowEventRow {
  id: string;
  flow_id: string;
  from_state_id: string;
  to_state_id: string;
  person_id: string;
  occurred_at: string;
}

function mapJob(row: JobRow): JobDefinition {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    kind: row.kind,
    enabled: Boolean(row.enabled),
    unitLabel: row.unit_label ?? undefined,
    cadence: {
      rate: row.cadence_rate,
      period: row.cadence_period,
      mode: row.cadence_mode,
      preferredDay: row.preferred_day ?? undefined,
    },
    calendarDay: row.calendar_day ?? undefined,
    createdAt: row.created_at,
  };
}

function mapJobEvent(row: JobEventRow): JobEvent {
  return {
    id: row.id,
    jobId: row.job_id,
    personId: row.person_id,
    occurredAt: row.occurred_at,
    quantity: row.quantity,
    leftTooLong: Boolean(row.left_too_long),
  };
}

export async function findHousehold(db: D1Database): Promise<HouseholdRow | null> {
  return db
    .prepare('SELECT id, name, admin_pin_hash, admin_pin_salt FROM households ORDER BY created_at LIMIT 1')
    .first<HouseholdRow>();
}

export async function readHousehold(db: D1Database, today: string): Promise<HouseholdState | null> {
  const household = await findHousehold(db);
  if (!household) return null;

  const [peopleResult, jobsResult, eventsResult, flowStatesResult, flowEventsResult] = await Promise.all([
    db.prepare(
      `SELECT p.id, p.name, p.color, p.availability, p.capacity, p.presence, p.updated_at,
              d.date AS daily_date, d.slept_okay, d.feeling_okay, d.vitamins
         FROM people p
         LEFT JOIN daily_checks d ON d.person_id = p.id AND d.date = ?
        WHERE p.household_id = ?
        ORDER BY p.created_at`,
    ).bind(today, household.id).all<PersonRow>(),
    db.prepare(
      `SELECT id, name, icon, kind, enabled, unit_label, cadence_rate, cadence_period,
              cadence_mode, preferred_day, calendar_day, created_at
         FROM jobs
        WHERE household_id = ?
        ORDER BY created_at`,
    ).bind(household.id).all<JobRow>(),
    db.prepare(
      `SELECT id, job_id, person_id, occurred_at, quantity, left_too_long
         FROM job_events
        WHERE household_id = ?
        ORDER BY occurred_at DESC
        LIMIT 500`,
    ).bind(household.id).all<JobEventRow>(),
    db.prepare(
      `SELECT flow_id, state_id, updated_at, updated_by
         FROM flow_states
        WHERE household_id = ?
        ORDER BY flow_id`,
    ).bind(household.id).all<FlowStateRow>(),
    db.prepare(
      `SELECT id, flow_id, from_state_id, to_state_id, person_id, occurred_at
         FROM flow_events
        WHERE household_id = ?
        ORDER BY occurred_at DESC
        LIMIT 200`,
    ).bind(household.id).all<FlowEventRow>(),
  ]);

  const people: Person[] = peopleResult.results.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    availability: row.availability,
    capacity: Math.min(5, Math.max(1, row.capacity)) as Person['capacity'],
    presence: row.presence,
    daily: {
      date: row.daily_date ?? today,
      sleptOkay: Boolean(row.slept_okay),
      feelingOkay: Boolean(row.feeling_okay),
      vitamins: Boolean(row.vitamins),
    },
    updatedAt: row.updated_at,
  }));

  const flowStates: FlowState[] = flowStatesResult.results.map((row) => ({
    flowId: row.flow_id,
    stateId: row.state_id,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by ?? undefined,
  }));

  const flowEvents: FlowEvent[] = flowEventsResult.results.map((row) => ({
    id: row.id,
    flowId: row.flow_id,
    fromStateId: row.from_state_id,
    toStateId: row.to_state_id,
    personId: row.person_id,
    occurredAt: row.occurred_at,
  }));

  return {
    version: 1,
    householdId: household.id,
    householdName: household.name,
    adminPinSet: Boolean(household.admin_pin_hash && household.admin_pin_salt),
    people,
    jobs: jobsResult.results.map(mapJob),
    events: eventsResult.results.map(mapJobEvent),
    flowStates,
    flowEvents,
  };
}

export interface CreateHouseholdInput {
  householdName: string;
  personName: string;
  pinHash: string;
  pinSalt: string;
  personColor: string;
}

export async function createHousehold(db: D1Database, input: CreateHouseholdInput): Promise<string> {
  if (await findHousehold(db)) throw new Error('HOUSEHOLD_EXISTS');
  const householdId = crypto.randomUUID();
  const personId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.batch([
    db.prepare(
      'INSERT INTO households (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
    ).bind(householdId, input.householdName, now, now),
    db.prepare(
      `INSERT INTO people
        (id, household_id, name, pin_hash, pin_salt, color, availability, capacity, presence, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'free', 3, 'home', ?, ?)`,
    ).bind(personId, householdId, input.personName, input.pinHash, input.pinSalt, input.personColor, now, now),
    db.prepare(
      `INSERT INTO flow_states (household_id, flow_id, state_id, updated_at)
       VALUES (?, 'dishwasher', 'empty', ?)`,
    ).bind(householdId, now),
    db.prepare(
      `INSERT INTO flow_states (household_id, flow_id, state_id, updated_at)
       VALUES (?, 'laundry', 'clear', ?)`,
    ).bind(householdId, now),
  ]);

  return personId;
}

export async function addPerson(
  db: D1Database,
  name: string,
  pinHash: string,
  pinSalt: string,
  color: string,
): Promise<void> {
  const household = await findHousehold(db);
  if (!household) throw new Error('HOUSEHOLD_MISSING');
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO people
      (id, household_id, name, pin_hash, pin_salt, color, availability, capacity, presence, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'free', 3, 'home', ?, ?)`,
  ).bind(crypto.randomUUID(), household.id, name, pinHash, pinSalt, color, now, now).run();
}

export async function getPersonPin(db: D1Database, personId: string): Promise<PersonPinRow | null> {
  return db.prepare('SELECT pin_hash, pin_salt FROM people WHERE id = ?').bind(personId).first<PersonPinRow>();
}

export async function updatePerson(
  db: D1Database,
  personId: string,
  patch: { availability?: Availability; capacity?: number; presence?: Presence },
): Promise<void> {
  const row = await db.prepare(
    'SELECT availability, capacity, presence FROM people WHERE id = ?',
  ).bind(personId).first<{ availability: Availability; capacity: number; presence: Presence }>();
  if (!row) throw new Error('PERSON_NOT_FOUND');
  const now = new Date().toISOString();
  await db.prepare(
    'UPDATE people SET availability = ?, capacity = ?, presence = ?, updated_at = ? WHERE id = ?',
  ).bind(
    patch.availability ?? row.availability,
    patch.capacity ?? row.capacity,
    patch.presence ?? row.presence,
    now,
    personId,
  ).run();
}

export async function toggleDailyCheck(
  db: D1Database,
  personId: string,
  date: string,
  key: 'sleptOkay' | 'feelingOkay' | 'vitamins',
): Promise<void> {
  const column = key === 'sleptOkay' ? 'slept_okay' : key === 'feelingOkay' ? 'feeling_okay' : 'vitamins';
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO daily_checks (person_id, date, ${column}, updated_at)
     VALUES (?, ?, 1, ?)
     ON CONFLICT(person_id, date) DO UPDATE SET
       ${column} = CASE WHEN ${column} = 1 THEN 0 ELSE 1 END,
       updated_at = excluded.updated_at`,
  ).bind(personId, date, now).run();
}

export async function addJob(db: D1Database, job: Omit<JobDefinition, 'id' | 'createdAt'>): Promise<void> {
  const household = await findHousehold(db);
  if (!household) throw new Error('HOUSEHOLD_MISSING');
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO jobs
      (id, household_id, name, icon, kind, enabled, unit_label, cadence_rate, cadence_period,
       cadence_mode, preferred_day, calendar_day, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    household.id,
    job.name,
    job.icon,
    job.kind,
    job.enabled ? 1 : 0,
    job.unitLabel ?? null,
    job.cadence.rate,
    job.cadence.period,
    job.cadence.mode,
    job.cadence.preferredDay ?? null,
    job.calendarDay ?? null,
    now,
    now,
  ).run();
}

export async function getJob(db: D1Database, jobId: string): Promise<JobDefinition | null> {
  const row = await db.prepare(
    `SELECT id, name, icon, kind, enabled, unit_label, cadence_rate, cadence_period,
            cadence_mode, preferred_day, calendar_day, created_at
       FROM jobs WHERE id = ?`,
  ).bind(jobId).first<JobRow>();
  return row ? mapJob(row) : null;
}

export async function updateJob(
  db: D1Database,
  jobId: string,
  patch: Partial<JobDefinition>,
): Promise<void> {
  const current = await getJob(db, jobId);
  if (!current) throw new Error('JOB_NOT_FOUND');
  const next: JobDefinition = {
    ...current,
    ...patch,
    cadence: patch.cadence ? { ...current.cadence, ...patch.cadence } : current.cadence,
  };
  await db.prepare(
    `UPDATE jobs
        SET name = ?, icon = ?, kind = ?, enabled = ?, unit_label = ?,
            cadence_rate = ?, cadence_period = ?, cadence_mode = ?, preferred_day = ?,
            calendar_day = ?, updated_at = ?
      WHERE id = ?`,
  ).bind(
    next.name,
    next.icon,
    next.kind,
    next.enabled ? 1 : 0,
    next.unitLabel ?? null,
    next.cadence.rate,
    next.cadence.period,
    next.cadence.mode,
    next.cadence.preferredDay ?? null,
    next.calendarDay ?? null,
    new Date().toISOString(),
    jobId,
  ).run();
}

async function getEventsForJob(db: D1Database, jobId: string): Promise<JobEvent[]> {
  const result = await db.prepare(
    `SELECT id, job_id, person_id, occurred_at, quantity, left_too_long
       FROM job_events WHERE job_id = ? ORDER BY occurred_at ASC LIMIT 500`,
  ).bind(jobId).all<JobEventRow>();
  return result.results.map(mapJobEvent);
}

async function refreshLearnedCadence(db: D1Database, jobId: string): Promise<void> {
  const job = await getJob(db, jobId);
  if (!job || job.cadence.mode !== 'auto' || job.kind === 'calendar') return;
  const events = await getEventsForJob(db, jobId);
  const cadence = learnCadence(job, events);
  await db.prepare(
    `UPDATE jobs
        SET cadence_rate = ?, cadence_period = ?, cadence_mode = ?, preferred_day = ?, updated_at = ?
      WHERE id = ?`,
  ).bind(
    cadence.rate,
    cadence.period,
    cadence.mode,
    cadence.preferredDay ?? null,
    new Date().toISOString(),
    jobId,
  ).run();
}

export async function completeJob(
  db: D1Database,
  jobId: string,
  personId: string,
  quantity: number,
): Promise<string> {
  const household = await findHousehold(db);
  if (!household) throw new Error('HOUSEHOLD_MISSING');
  if (!await getJob(db, jobId)) throw new Error('JOB_NOT_FOUND');
  const eventId = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO job_events
      (id, household_id, job_id, person_id, occurred_at, quantity, left_too_long)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
  ).bind(eventId, household.id, jobId, personId, new Date().toISOString(), quantity).run();
  await refreshLearnedCadence(db, jobId);
  return eventId;
}

export async function markEventLeftTooLong(db: D1Database, eventId: string): Promise<void> {
  const row = await db.prepare(
    'SELECT job_id FROM job_events WHERE id = ?',
  ).bind(eventId).first<{ job_id: string }>();
  if (!row) throw new Error('EVENT_NOT_FOUND');
  await db.prepare('UPDATE job_events SET left_too_long = 1 WHERE id = ?').bind(eventId).run();
  await refreshLearnedCadence(db, row.job_id);
}

export async function advanceFlow(db: D1Database, flowId: string, personId: string): Promise<void> {
  const household = await findHousehold(db);
  if (!household) throw new Error('HOUSEHOLD_MISSING');
  const current = await db.prepare(
    'SELECT state_id FROM flow_states WHERE household_id = ? AND flow_id = ?',
  ).bind(household.id, flowId).first<{ state_id: string }>();
  const fallback = flowId === 'dishwasher' ? 'empty' : 'clear';
  const fromStateId = current?.state_id ?? fallback;
  const toStateId = nextFlowStateId(flowId, fromStateId);
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(
      `INSERT INTO flow_states (household_id, flow_id, state_id, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(household_id, flow_id) DO UPDATE SET
         state_id = excluded.state_id,
         updated_at = excluded.updated_at,
         updated_by = excluded.updated_by`,
    ).bind(household.id, flowId, toStateId, now, personId),
    db.prepare(
      `INSERT INTO flow_events
        (id, household_id, flow_id, from_state_id, to_state_id, person_id, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), household.id, flowId, fromStateId, toStateId, personId, now),
  ]);
}

export async function setAdminPin(db: D1Database, pinHash: string, pinSalt: string): Promise<void> {
  const household = await findHousehold(db);
  if (!household) throw new Error('HOUSEHOLD_MISSING');
  if (household.admin_pin_hash) throw new Error('ADMIN_PIN_ALREADY_SET');
  await db.prepare(
    'UPDATE households SET admin_pin_hash = ?, admin_pin_salt = ?, updated_at = ? WHERE id = ?',
  ).bind(pinHash, pinSalt, new Date().toISOString(), household.id).run();
}

export async function getAdminPin(db: D1Database): Promise<PersonPinRow | null> {
  const household = await findHousehold(db);
  if (!household?.admin_pin_hash || !household.admin_pin_salt) return null;
  return { pin_hash: household.admin_pin_hash, pin_salt: household.admin_pin_salt };
}

export async function resetHousehold(db: D1Database): Promise<void> {
  const household = await findHousehold(db);
  if (!household) return;
  await db.prepare('DELETE FROM households WHERE id = ?').bind(household.id).run();
}

export async function seedDemo(
  db: D1Database,
  pinHashFactory: () => Promise<{ hash: string; salt: string }>,
): Promise<string> {
  if (await findHousehold(db)) throw new Error('HOUSEHOLD_EXISTS');
  const householdId = crypto.randomUUID();
  const now = new Date();
  const nowIso = now.toISOString();
  const people = [
    { id: crypto.randomUUID(), name: 'Tristan', color: '#bdd7ec', availability: 'in-zone', capacity: 4, presence: 'home' },
    { id: crypto.randomUUID(), name: 'Sarah', color: '#cfe3bf', availability: 'free', capacity: 5, presence: 'home' },
    { id: crypto.randomUUID(), name: 'Leo', color: '#f2d69b', availability: 'out', capacity: 3, presence: 'out' },
  ] as const;
  const pinSets = await Promise.all(people.map(() => pinHashFactory()));
  const jobs = {
    bathroom: crypto.randomUUID(),
    garden: crypto.randomUUID(),
    washing: crypto.randomUUID(),
    bins: crypto.randomUUID(),
  };

  const ago = (days: number, hours = 0) => new Date(now.getTime() - (days * 24 + hours) * 3_600_000).toISOString();
  const statements = [
    db.prepare('INSERT INTO households (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').bind(householdId, 'Home', nowIso, nowIso),
    ...people.map((person, index) =>
      db.prepare(
        `INSERT INTO people
          (id, household_id, name, pin_hash, pin_salt, color, availability, capacity, presence, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        person.id,
        householdId,
        person.name,
        pinSets[index].hash,
        pinSets[index].salt,
        person.color,
        person.availability,
        person.capacity,
        person.presence,
        nowIso,
        nowIso,
      ),
    ),
    db.prepare(
      `INSERT INTO jobs
        (id, household_id, name, icon, kind, enabled, cadence_rate, cadence_period, cadence_mode, created_at, updated_at)
       VALUES (?, ?, 'Bathroom', '🛁', 'session', 1, 1, 'week', 'auto', ?, ?)`,
    ).bind(jobs.bathroom, householdId, ago(60), nowIso),
    db.prepare(
      `INSERT INTO jobs
        (id, household_id, name, icon, kind, enabled, cadence_rate, cadence_period, cadence_mode, created_at, updated_at)
       VALUES (?, ?, 'Garden', '🌿', 'session', 1, 0.7, 'week', 'auto', ?, ?)`,
    ).bind(jobs.garden, householdId, ago(60), nowIso),
    db.prepare(
      `INSERT INTO jobs
        (id, household_id, name, icon, kind, enabled, unit_label, cadence_rate, cadence_period, cadence_mode, preferred_day, created_at, updated_at)
       VALUES (?, ?, 'Washing', '🧺', 'counted', 1, 'loads', 14, 'week', 'auto', 0, ?, ?)`,
    ).bind(jobs.washing, householdId, ago(60), nowIso),
    db.prepare(
      `INSERT INTO jobs
        (id, household_id, name, icon, kind, enabled, cadence_rate, cadence_period, cadence_mode, calendar_day, created_at, updated_at)
       VALUES (?, ?, 'Bins', '🗑️', 'calendar', 1, 1, 'week', 'manual', 3, ?, ?)`,
    ).bind(jobs.bins, householdId, ago(60), nowIso),
    db.prepare(`INSERT INTO flow_states (household_id, flow_id, state_id, updated_at, updated_by) VALUES (?, 'dishwasher', 'clean', ?, ?)`).bind(householdId, ago(0, 3), people[0].id),
    db.prepare(`INSERT INTO flow_states (household_id, flow_id, state_id, updated_at, updated_by) VALUES (?, 'laundry', 'ready-to-put-away', ?, ?)`).bind(householdId, ago(0, 1), people[1].id),
  ];

  const demoEvents = [
    [jobs.bathroom, people[1].id, ago(6), 1],
    [jobs.garden, people[0].id, ago(6, 5), 1],
    [jobs.washing, people[1].id, ago(1), 4],
    [jobs.washing, people[0].id, ago(7), 8],
    [jobs.washing, people[1].id, ago(14), 13],
    [jobs.bathroom, people[0].id, ago(13), 1],
    [jobs.garden, people[1].id, ago(15), 1],
  ] as const;
  for (const [jobId, personId, occurredAt, quantity] of demoEvents) {
    statements.push(
      db.prepare(
        `INSERT INTO job_events (id, household_id, job_id, person_id, occurred_at, quantity, left_too_long)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
      ).bind(crypto.randomUUID(), householdId, jobId, personId, occurredAt, quantity),
    );
  }

  await db.batch(statements);
  return people[0].id;
}
