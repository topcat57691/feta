import type { Availability, JobDefinition, Presence } from '../src/app/types';
import {
  addJob,
  addPerson,
  advanceFlow,
  completeJob,
  createHousehold,
  findHousehold,
  getAdminPin,
  getPersonPin,
  markEventLeftTooLong,
  readHousehold,
  resetHousehold,
  seedDemo,
  setAdminPin,
  toggleDailyCheck,
  updateJob,
  updatePerson,
} from './db';
import { createPinSalt, hashPin, validPin, verifyPin } from './pin';
import type { D1Database, Env } from './types';

const DEFAULT_COLOR = '#bdd7ec';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function error(status: number, code: string, message: string): Response {
  return json({ message, code }, status);
}

async function body<T>(request: Request): Promise<T> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) throw new Error('INVALID_JSON');
  return await request.json() as T;
}

function localDate(request: Request): string {
  const supplied = request.headers.get('x-feta-date');
  if (supplied && /^\d{4}-\d{2}-\d{2}$/.test(supplied)) return supplied;
  return new Date().toISOString().slice(0, 10);
}

function requireDb(env: Env): D1Database | Response {
  if (!env.DB) {
    return error(
      503,
      'D1_NOT_CONFIGURED',
      'FETA is deployed, but its D1 database binding has not been configured yet.',
    );
  }
  return env.DB;
}

async function stateResponse(db: D1Database, request: Request): Promise<Response> {
  const state = await readHousehold(db, localDate(request));
  return state ? json(state) : error(404, 'HOUSEHOLD_NOT_FOUND', 'No household has been set up yet.');
}

function asAvailability(value: unknown): Availability | undefined {
  return value === 'in-zone' || value === 'free' || value === 'drained' || value === 'out'
    ? value
    : undefined;
}

function asPresence(value: unknown): Presence | undefined {
  return value === 'home' || value === 'out' ? value : undefined;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (!path.startsWith('/api/')) return env.ASSETS.fetch(request);

    const dbOrResponse = requireDb(env);
    if (dbOrResponse instanceof Response) return dbOrResponse;
    const db = dbOrResponse;

    try {
      if (request.method === 'GET' && path === '/api/health') {
        const household = await findHousehold(db);
        return json({ ok: true, database: 'd1', householdConfigured: Boolean(household) });
      }

      if (request.method === 'GET' && path === '/api/household') {
        return stateResponse(db, request);
      }

      if (request.method === 'POST' && path === '/api/setup') {
        const input = await body<{ householdName?: string; personName?: string; pin?: string; color?: string }>(request);
        if (!input.personName?.trim()) return error(400, 'PERSON_NAME_REQUIRED', 'Your name is required.');
        if (!validPin(input.pin)) return error(400, 'PIN_INVALID', 'Use a 4-digit PIN.');
        if (await findHousehold(db)) return error(409, 'HOUSEHOLD_EXISTS', 'This FETA database already has a household.');

        const salt = createPinSalt();
        const pinHash = await hashPin(input.pin, salt);
        const personId = await createHousehold(db, {
          householdName: input.householdName?.trim() || 'Home',
          personName: input.personName.trim(),
          pinHash,
          pinSalt: salt,
          personColor: input.color || DEFAULT_COLOR,
        });
        const state = await readHousehold(db, localDate(request));
        return json({ state, personId }, 201);
      }

      if (request.method === 'POST' && path === '/api/demo') {
        if (await findHousehold(db)) return error(409, 'HOUSEHOLD_EXISTS', 'This FETA database already has a household.');
        const personId = await seedDemo(db, async () => {
          const salt = createPinSalt();
          return { salt, hash: await hashPin('1234', salt) };
        });
        const state = await readHousehold(db, localDate(request));
        return json({ state, personId }, 201);
      }

      if (request.method === 'POST' && path === '/api/auth/person') {
        const input = await body<{ personId?: string; pin?: string }>(request);
        if (!input.personId || !validPin(input.pin)) return json({ ok: false });
        const stored = await getPersonPin(db, input.personId);
        if (!stored) return json({ ok: false });
        return json({ ok: await verifyPin(input.pin, stored.pin_salt, stored.pin_hash) });
      }

      if (request.method === 'POST' && path === '/api/people') {
        const input = await body<{ name?: string; pin?: string; color?: string }>(request);
        if (!input.name?.trim()) return error(400, 'PERSON_NAME_REQUIRED', 'A name is required.');
        if (!validPin(input.pin)) return error(400, 'PIN_INVALID', 'Use a 4-digit PIN.');
        const salt = createPinSalt();
        await addPerson(db, input.name.trim(), await hashPin(input.pin, salt), salt, input.color || DEFAULT_COLOR);
        return stateResponse(db, request);
      }

      const personMatch = path.match(/^\/api\/people\/([^/]+)$/);
      if (request.method === 'PATCH' && personMatch) {
        const input = await body<{ availability?: unknown; capacity?: unknown; presence?: unknown }>(request);
        const capacity = typeof input.capacity === 'number' && input.capacity >= 1 && input.capacity <= 5
          ? input.capacity
          : undefined;
        await updatePerson(db, personMatch[1], {
          availability: asAvailability(input.availability),
          capacity,
          presence: asPresence(input.presence),
        });
        return stateResponse(db, request);
      }

      const dailyMatch = path.match(/^\/api\/people\/([^/]+)\/daily$/);
      if (request.method === 'POST' && dailyMatch) {
        const input = await body<{ key?: 'sleptOkay' | 'feelingOkay' | 'vitamins' }>(request);
        if (!input.key || !['sleptOkay', 'feelingOkay', 'vitamins'].includes(input.key)) {
          return error(400, 'DAILY_KEY_INVALID', 'Unknown daily check.');
        }
        await toggleDailyCheck(db, dailyMatch[1], localDate(request), input.key);
        return stateResponse(db, request);
      }

      if (request.method === 'POST' && path === '/api/jobs') {
        const input = await body<Omit<JobDefinition, 'id' | 'createdAt'>>(request);
        if (!input.name?.trim() || !input.kind || !input.cadence) {
          return error(400, 'JOB_INVALID', 'Job name, kind and cadence are required.');
        }
        await addJob(db, input);
        return stateResponse(db, request);
      }

      const jobMatch = path.match(/^\/api\/jobs\/([^/]+)$/);
      if (request.method === 'PATCH' && jobMatch) {
        const patch = await body<Partial<JobDefinition>>(request);
        await updateJob(db, jobMatch[1], patch);
        return stateResponse(db, request);
      }

      const completeMatch = path.match(/^\/api\/jobs\/([^/]+)\/complete$/);
      if (request.method === 'POST' && completeMatch) {
        const input = await body<{ personId?: string; quantity?: number }>(request);
        if (!input.personId) return error(400, 'PERSON_REQUIRED', 'A person is required.');
        const quantity = typeof input.quantity === 'number' && input.quantity > 0 ? input.quantity : 1;
        const eventId = await completeJob(db, completeMatch[1], input.personId, quantity);
        const state = await readHousehold(db, localDate(request));
        return json({ state, eventId });
      }

      const eventMatch = path.match(/^\/api\/events\/([^/]+)$/);
      if (request.method === 'PATCH' && eventMatch) {
        const input = await body<{ leftTooLong?: boolean }>(request);
        if (input.leftTooLong) await markEventLeftTooLong(db, eventMatch[1]);
        return stateResponse(db, request);
      }

      const flowMatch = path.match(/^\/api\/flows\/([^/]+)\/advance$/);
      if (request.method === 'POST' && flowMatch) {
        const input = await body<{ personId?: string }>(request);
        if (!input.personId) return error(400, 'PERSON_REQUIRED', 'A person is required.');
        await advanceFlow(db, flowMatch[1], input.personId);
        return stateResponse(db, request);
      }

      if (request.method === 'POST' && path === '/api/admin/pin') {
        const input = await body<{ pin?: string }>(request);
        if (!validPin(input.pin)) return error(400, 'PIN_INVALID', 'Use a 4-digit PIN.');
        const salt = createPinSalt();
        await setAdminPin(db, await hashPin(input.pin, salt), salt);
        return stateResponse(db, request);
      }

      if (request.method === 'POST' && path === '/api/auth/admin') {
        const input = await body<{ pin?: string }>(request);
        if (!validPin(input.pin)) return json({ ok: false });
        const stored = await getAdminPin(db);
        if (!stored) return json({ ok: false });
        return json({ ok: await verifyPin(input.pin, stored.pin_salt, stored.pin_hash) });
      }

      if (request.method === 'DELETE' && path === '/api/household') {
        const pin = request.headers.get('x-admin-pin');
        if (!validPin(pin)) return error(401, 'ADMIN_PIN_REQUIRED', 'Admin PIN required.');
        const stored = await getAdminPin(db);
        if (!stored || !(await verifyPin(pin, stored.pin_salt, stored.pin_hash))) {
          return error(403, 'ADMIN_PIN_INVALID', 'Admin PIN did not match.');
        }
        await resetHousehold(db);
        return new Response(null, { status: 204 });
      }

      return error(404, 'API_NOT_FOUND', 'Unknown FETA API route.');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unexpected error';
      if (message === 'HOUSEHOLD_EXISTS') return error(409, message, 'A household already exists.');
      if (message === 'HOUSEHOLD_MISSING') return error(404, message, 'No household exists yet.');
      if (message === 'PERSON_NOT_FOUND' || message === 'JOB_NOT_FOUND' || message === 'EVENT_NOT_FOUND') {
        return error(404, message, 'The requested item could not be found.');
      }
      if (message === 'ADMIN_PIN_ALREADY_SET') {
        return error(409, message, 'An admin PIN has already been configured.');
      }
      if (message === 'INVALID_JSON') return error(400, message, 'Expected a JSON request body.');
      console.error('FETA API error', caught);
      return error(500, 'INTERNAL_ERROR', 'FETA could not complete that change.');
    }
  },
};
