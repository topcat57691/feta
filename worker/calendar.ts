import type { CalendarEvent } from '../src/app/types';
import { findHousehold, getAdminPin } from './db';
import { validPin, verifyPin } from './pin';
import type { D1Database, Env } from './types';

const ORIGIN = 'https://feta.topcat57691.workers.dev';
const REDIRECT_URI = ORIGIN + '/api/integrations/google-calendar/callback';
const WEBHOOK_URI = ORIGIN + '/api/integrations/google-calendar/webhook';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
].join(' ');
const WINDOW_PAST_DAYS = 7;
const WINDOW_FUTURE_DAYS = 90;

interface ConnectionRow {
  household_id: string;
  refresh_token: string;
  account_label: string;
  updated_at: string;
}
interface SourceRow {
  household_id: string;
  calendar_id: string;
  name: string;
  color: string | null;
  selected: number;
  last_sync: string | null;
  last_error: string | null;
  channel_id: string | null;
  channel_token: string | null;
  resource_id: string | null;
  channel_expiration: number | null;
}
interface GoogleCalendar {
  id: string;
  summary?: string;
  primary?: boolean;
  backgroundColor?: string;
  accessRole?: string;
}
interface GoogleEvent {
  id: string;
  summary?: string;
  status?: string;
  visibility?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  recurringEventId?: string;
}
interface GooglePage<T> {
  items?: T[];
  nextPageToken?: string;
  nextSyncToken?: string;
}
interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  error?: string;
}
interface OAuthRow { household_id: string; verifier: string; expires_at: number }

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
function failure(status: number, code: string, message: string): Response {
  return response({ code, message }, status);
}
function backToAdmin(outcome: 'connected' | 'error' | 'cancelled'): Response {
  return new Response(null, {
    status: 303,
    headers: { location: '/admin?calendar=' + outcome, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' },
  });
}
function randomUrlSafe(bytes = 32): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return toBase64(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
function webBytes(input: Uint8Array): Uint8Array<ArrayBuffer> {
  const output = new Uint8Array(new ArrayBuffer(input.length));
  output.set(input);
  return output;
}
async function encryptionKey(env: Env): Promise<CryptoKey> {
  const bytes = fromBase64(env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? '');
  if (bytes.length !== 32) throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY must be 32 Base64-encoded bytes');
  return crypto.subtle.importKey('raw', webBytes(bytes), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function encryptToken(env: Env, token: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(token);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(env), data);
  return 'v1:' + toBase64(iv) + ':' + toBase64(new Uint8Array(encrypted));
}
async function decryptToken(env: Env, value: string): Promise<string> {
  const [version, iv, ciphertext] = value.split(':');
  if (version !== 'v1' || !iv || !ciphertext) throw new Error('Unsupported encrypted calendar token');
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: webBytes(fromBase64(iv)) }, await encryptionKey(env), webBytes(fromBase64(ciphertext)),
  );
  return new TextDecoder().decode(decrypted);
}
/** Returns only variable names; never expose their secret values. */
export function missingGoogleSecrets(env: Env): string[] {
  return ([
    ['GOOGLE_CLIENT_ID', env.GOOGLE_CLIENT_ID],
    ['GOOGLE_CLIENT_SECRET', env.GOOGLE_CLIENT_SECRET],
    ['GOOGLE_TOKEN_ENCRYPTION_KEY', env.GOOGLE_TOKEN_ENCRYPTION_KEY],
  ] as const).filter(([, value]) => typeof value !== 'string' || !value.trim())
    .map(([name]) => name);
}
function credentialsAvailable(env: Env): boolean {
  return missingGoogleSecrets(env).length === 0;
}
async function googleToken(env: Env, params: Record<string, string>): Promise<TokenResponse> {
  const result = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID ?? '',
      client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
      ...params,
    }),
  });
  const data = await result.json() as TokenResponse;
  if (!result.ok || !data.access_token) throw new Error('Google token exchange failed: ' + (data.error ?? result.status));
  return data;
}
async function googleApi<T>(accessToken: string, url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { authorization: 'Bearer ' + accessToken, ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = new Error('Google Calendar returned ' + res.status) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return await res.json() as T;
}
async function accessToken(env: Env, row: ConnectionRow): Promise<string> {
  const refresh = await decryptToken(env, row.refresh_token);
  const token = await googleToken(env, { refresh_token: refresh, grant_type: 'refresh_token' });
  return token.access_token!;
}
async function connection(db: D1Database, householdId: string): Promise<ConnectionRow | null> {
  return db.prepare('SELECT household_id, refresh_token, account_label, updated_at FROM calendar_connections WHERE household_id = ?')
    .bind(householdId).first<ConnectionRow>();
}
async function sources(db: D1Database, householdId: string): Promise<SourceRow[]> {
  const result = await db.prepare(
    'SELECT household_id, calendar_id, name, color, selected, last_sync, last_error, channel_id, channel_token, resource_id, channel_expiration FROM calendar_sources WHERE household_id = ? ORDER BY name',
  ).bind(householdId).all<SourceRow>();
  return result.results;
}
async function listCalendars(token: string): Promise<GoogleCalendar[]> {
  const items: GoogleCalendar[] = [];
  let page: string | undefined;
  for (let i = 0; i < 12; i++) {
    const url = new URL('https://www.googleapis.com/calendar/v3/users/me/calendarList');
    url.searchParams.set('maxResults', '250');
    if (page) url.searchParams.set('pageToken', page);
    const data = await googleApi<GooglePage<GoogleCalendar>>(token, url.toString());
    items.push(...(data.items ?? []));
    page = data.nextPageToken;
    if (!page) return items;
  }
  throw new Error('Google calendar list exceeded pagination limit');
}
async function refreshCalendarList(db: D1Database, householdId: string, token: string): Promise<void> {
  const calendars = await listCalendars(token);
  const now = new Date().toISOString();
  for (const item of calendars) {
    if (!item.id) continue;
    await db.prepare(
      `INSERT INTO calendar_sources (household_id, calendar_id, name, color, selected)
       VALUES (?, ?, ?, ?, 0)
       ON CONFLICT (household_id, calendar_id) DO UPDATE SET name = excluded.name, color = excluded.color`,
    ).bind(householdId, item.id, item.summary ?? item.id, item.backgroundColor ?? null).run();
  }
  // Revoke access to calendars that are no longer in the Google account.
  const available = new Set(calendars.map((item) => item.id));
  for (const old of await sources(db, householdId)) {
    if (!available.has(old.calendar_id)) {
      await db.prepare('DELETE FROM calendar_sources WHERE household_id = ? AND calendar_id = ?')
        .bind(householdId, old.calendar_id).run();
      await db.prepare('DELETE FROM calendar_events WHERE household_id = ? AND calendar_id = ?')
        .bind(householdId, old.calendar_id).run();
    }
  }
  await db.prepare('UPDATE calendar_connections SET updated_at = ? WHERE household_id = ?')
    .bind(now, householdId).run();
}
function ensureSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (new URL(request.url).origin !== ORIGIN) return false;
  if (origin && origin !== ORIGIN) return false;
  // Same-origin GET requests generally omit Origin; mutations must supply it.
  return request.method === 'GET' || origin === ORIGIN;
}
async function adminAllowed(db: D1Database, request: Request): Promise<boolean> {
  const pin = request.headers.get('x-admin-pin');
  const stored = await getAdminPin(db);
  return Boolean(validPin(pin) && stored && await verifyPin(pin!, stored.pin_salt, stored.pin_hash));
}

async function callback(request: Request, env: Env, db: D1Database): Promise<Response> {
  if (!credentialsAvailable(env)) return backToAdmin('error');
  const url = new URL(request.url);
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  if (!state || state.length > 200) return backToAdmin('error');
  // A one-use random state binds consent to a PIN-authorised connection request.
  const record = await db.prepare(
    'DELETE FROM calendar_oauth_states WHERE state = ? AND expires_at > ? RETURNING household_id, verifier, expires_at',
  ).bind(state, Date.now()).first<OAuthRow>();
  if (!record) return backToAdmin('error');
  if (!code) return backToAdmin('cancelled');
  try {
    const token = await googleToken(env, {
      code, code_verifier: record.verifier, grant_type: 'authorization_code', redirect_uri: REDIRECT_URI,
    });
    if (!token.refresh_token) throw new Error('Google did not issue an offline refresh token');
    const calendars = await listCalendars(token.access_token!);
    const account = calendars.find((calendar) => calendar.primary)?.id ?? 'Google account';
    const encrypted = await encryptToken(env, token.refresh_token);
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO calendar_connections (household_id, refresh_token, account_label, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (household_id) DO UPDATE SET refresh_token = excluded.refresh_token,
       account_label = excluded.account_label, updated_at = excluded.updated_at`,
    ).bind(record.household_id, encrypted, account, now).run();
    await refreshCalendarList(db, record.household_id, token.access_token!);
    return backToAdmin('connected');
  } catch (err) {
    console.error('Google Calendar callback failed', err instanceof Error ? err.message : 'unknown');
    return backToAdmin('error');
  }
}

async function stopChannel(token: string, row: SourceRow): Promise<void> {
  if (!row.channel_id || !row.resource_id) return;
  await fetch('https://www.googleapis.com/calendar/v3/channels/stop', {
    method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify({ id: row.channel_id, resourceId: row.resource_id }),
  }).catch(() => undefined);
}
async function ensureWatch(db: D1Database, row: SourceRow, token: string): Promise<void> {
  if (row.channel_expiration && row.channel_expiration > Date.now() + 24 * 60 * 60 * 1000) return;
  const id = crypto.randomUUID(), secret = randomUrlSafe();
  const calendar = encodeURIComponent(row.calendar_id);
  const watch = await googleApi<{ resourceId: string; expiration?: string }>(
    token, 'https://www.googleapis.com/calendar/v3/calendars/' + calendar + '/events/watch',
    { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, type: 'web_hook', address: WEBHOOK_URI, token: secret, params: { ttl: '604800' } }) },
  );
  await db.prepare(
    `UPDATE calendar_sources SET channel_id = ?, channel_token = ?, resource_id = ?, channel_expiration = ?
     WHERE household_id = ? AND calendar_id = ? AND selected = 1`,
  ).bind(id, secret, watch.resourceId, Number(watch.expiration ?? Date.now() + 6 * 86400_000),
    row.household_id, row.calendar_id).run();
  await stopChannel(token, row);
}
export function normaliseGoogleEvent(item: GoogleEvent): {
  id: string; title: string; start: string; end: string; allDay: boolean;
} | null {
  if (!item.id || item.status === 'cancelled' || !item.start || !item.end) return null;
  const rawStart = item.start.dateTime ?? (item.start.date ? item.start.date + 'T00:00:00Z' : null);
  const rawEnd = item.end.dateTime ?? (item.end.date ? item.end.date + 'T00:00:00Z' : null);
  if (!rawStart || !rawEnd) return null;
  const startTime = new Date(rawStart);
  const endTime = new Date(rawEnd);
  if (!Number.isFinite(startTime.getTime()) || !Number.isFinite(endTime.getTime())) return null;
  return {
    id: item.id,
    title: item.visibility === 'private' ? 'Busy (private event)' : (item.summary || 'Untitled event'),
    start: startTime.toISOString(),
    end: endTime.toISOString(),
    allDay: Boolean(item.start.date),
  };
}
async function syncSource(db: D1Database, source: SourceRow, token: string): Promise<void> {
  const from = new Date(Date.now() - WINDOW_PAST_DAYS * 86400_000).toISOString();
  const to = new Date(Date.now() + WINDOW_FUTURE_DAYS * 86400_000).toISOString();
  const gathered: GoogleEvent[] = [];
  let page: string | undefined;
  for (let i = 0; i < 25; i++) {
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/' +
      encodeURIComponent(source.calendar_id) + '/events');
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('maxResults', '250');
    url.searchParams.set('timeMin', from);
    url.searchParams.set('timeMax', to);
    if (page) url.searchParams.set('pageToken', page);
    const result = await googleApi<GooglePage<GoogleEvent>>(token, url.toString());
    gathered.push(...(result.items ?? []));
    page = result.nextPageToken;
    if (!page) break;
    if (i === 24) throw new Error('Too many events in calendar sync');
  }
  const batchId = crypto.randomUUID();
  // Upsert everything before pruning. A failed fetch never wipes cached events.
  for (const item of gathered) {
    const mapped = normaliseGoogleEvent(item);
    if (!mapped) continue;
    await db.prepare(
      `INSERT INTO calendar_events
       (household_id, calendar_id, event_id, title, starts_at, ends_at, all_day, batch_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (household_id, calendar_id, event_id) DO UPDATE SET
       title = excluded.title, starts_at = excluded.starts_at, ends_at = excluded.ends_at,
       all_day = excluded.all_day, batch_id = excluded.batch_id`,
    ).bind(source.household_id, source.calendar_id, mapped.id, mapped.title,
      mapped.start, mapped.end, mapped.allDay ? 1 : 0, batchId).run();
  }
  await db.prepare('DELETE FROM calendar_events WHERE household_id = ? AND calendar_id = ? AND batch_id != ?')
    .bind(source.household_id, source.calendar_id, batchId).run();
  await db.prepare(
    'UPDATE calendar_sources SET last_sync = ?, last_error = NULL WHERE household_id = ? AND calendar_id = ?',
  ).bind(new Date().toISOString(), source.household_id, source.calendar_id).run();
  // A watch failure is non-fatal because cron polling is the fallback.
  try { await ensureWatch(db, source, token); }
  catch (caught) { console.warn('Calendar watch registration failed', caught instanceof Error ? caught.message : 'unknown'); }
}

export async function syncCalendars(db: D1Database, env: Env): Promise<void> {
  const household = await findHousehold(db);
  if (!household || !credentialsAvailable(env)) return;
  const saved = await connection(db, household.id);
  if (!saved) return;
  const active = (await sources(db, household.id)).filter((item) => item.selected);
  if (!active.length) return;
  let token: string;
  try { token = await accessToken(env, saved); }
  catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Google token unavailable';
    for (const source of active) {
      await db.prepare('UPDATE calendar_sources SET last_error = ? WHERE household_id = ? AND calendar_id = ?')
        .bind(message.slice(0, 200), household.id, source.calendar_id).run();
    }
    return;
  }
  for (const source of active) {
    try { await syncSource(db, source, token); }
    catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Calendar sync failed';
      console.error('FETA calendar sync failed', { calendarId: source.calendar_id, message });
      await db.prepare('UPDATE calendar_sources SET last_error = ? WHERE household_id = ? AND calendar_id = ?')
        .bind(message.slice(0, 200), household.id, source.calendar_id).run();
    }
  }
}

async function webhook(request: Request, env: Env, db: D1Database,
  ctx?: { waitUntil(promise: Promise<unknown>): void }): Promise<Response> {
  const id = request.headers.get('x-goog-channel-id');
  const token = request.headers.get('x-goog-channel-token');
  const resource = request.headers.get('x-goog-resource-id');
  if (!id || !token || !resource) return new Response(null, { status: 204 });
  const record = await db.prepare(
    `SELECT calendar_id FROM calendar_sources
     WHERE channel_id = ? AND channel_token = ? AND resource_id = ? AND selected = 1`,
  ).bind(id, token, resource).first();
  if (record && request.headers.get('x-goog-resource-state') !== 'sync') {
    if (ctx) ctx.waitUntil(syncCalendars(db, env));
    else await syncCalendars(db, env);
  }
  return new Response(null, { status: 204 });
}

export async function readCalendarEvents(db: D1Database, householdId: string): Promise<CalendarEvent[]> {
  const result = await db.prepare(
    `SELECT e.calendar_id, e.event_id, e.title, e.starts_at, e.ends_at, e.all_day,
            s.name AS calendar_name, s.color,
            c.person_id, c.completed_at
     FROM calendar_events e
     JOIN calendar_sources s ON s.household_id = e.household_id AND s.calendar_id = e.calendar_id
     LEFT JOIN calendar_completions c ON c.household_id = e.household_id
       AND c.calendar_id = e.calendar_id AND c.event_id = e.event_id
     WHERE e.household_id = ? AND s.selected = 1 AND e.ends_at >= ?
     ORDER BY e.starts_at LIMIT 250`,
  ).bind(householdId, new Date(Date.now() - 7 * 86400_000).toISOString()).all<{
    calendar_id: string; event_id: string; title: string; starts_at: string; ends_at: string;
    all_day: number; calendar_name: string; color: string | null;
    person_id: string | null; completed_at: string | null;
  }>();
  return result.results.map((row) => ({
    calendarId: row.calendar_id,
    eventId: row.event_id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    allDay: Boolean(row.all_day),
    calendarName: row.calendar_name,
    color: row.color ?? undefined,
    completedBy: row.person_id ?? undefined,
    completedAt: row.completed_at ?? undefined,
  }));
}

export async function completeCalendarEvent(
  db: D1Database, request: Request, householdId: string,
): Promise<Response> {
  if (!ensureSameOrigin(request)) return failure(403, 'ORIGIN_INVALID', 'Open FETA from its usual address.');
  const input = await request.json().catch(() => ({})) as { calendarId?: string; eventId?: string; personId?: string };
  if (!input.calendarId || !input.eventId || !input.personId ||
      input.calendarId.length > 1024 || input.eventId.length > 1024) {
    return failure(400, 'CALENDAR_EVENT_INVALID', 'Choose an event and household member.');
  }
  const allowed = await db.prepare(
    `SELECT 1 FROM calendar_events e JOIN calendar_sources s
       ON s.household_id = e.household_id AND s.calendar_id = e.calendar_id
     JOIN people p ON p.household_id = e.household_id AND p.id = ?
     WHERE e.household_id = ? AND e.calendar_id = ? AND e.event_id = ? AND s.selected = 1`,
  ).bind(input.personId, householdId, input.calendarId, input.eventId).first();
  if (!allowed) return failure(404, 'CALENDAR_EVENT_NOT_FOUND', 'That event is not available.');
  if (request.method === 'DELETE') {
    await db.prepare(
      'DELETE FROM calendar_completions WHERE household_id = ? AND calendar_id = ? AND event_id = ?',
    ).bind(householdId, input.calendarId, input.eventId).run();
  } else {
    await db.prepare(
      `INSERT INTO calendar_completions (household_id, calendar_id, event_id, person_id, completed_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (household_id, calendar_id, event_id) DO UPDATE SET
       person_id = excluded.person_id, completed_at = excluded.completed_at`,
    ).bind(householdId, input.calendarId, input.eventId, input.personId, new Date().toISOString()).run();
  }
  return response({ ok: true });
}

export async function handleCalendarRequest(
  request: Request, env: Env, db: D1Database, ctx?: { waitUntil(promise: Promise<unknown>): void },
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method === 'GET' && path.endsWith('/callback')) return callback(request, env, db);
  if (request.method === 'POST' && path.endsWith('/webhook')) return webhook(request, env, db, ctx);
  if (!ensureSameOrigin(request) || !await adminAllowed(db, request)) {
    return failure(403, 'ADMIN_REQUIRED', 'Unlock Admin to manage calendars.');
  }
  const household = await findHousehold(db);
  if (!household) return failure(404, 'HOUSEHOLD_MISSING', 'Set up the household first.');
  const missingSecrets = missingGoogleSecrets(env);
  // Always allow PIN-authenticated status to load, even when the runtime bindings are missing.
  if (request.method === 'GET' && path.endsWith('/status')) {
    const saved = await connection(db, household.id);
    return response({
      configured: missingSecrets.length === 0,
      missingSecrets,
      connected: Boolean(saved),
      account: saved?.account_label ?? null,
      calendars: (await sources(db, household.id)).map((row) => ({
        id: row.calendar_id, name: row.name, color: row.color, selected: Boolean(row.selected),
        lastSync: row.last_sync, error: row.last_error,
      })),
    });
  }
  if (missingSecrets.length) {
    return failure(503, 'CALENDAR_NOT_CONFIGURED',
      'Missing runtime Worker secrets: ' + missingSecrets.join(', ') +
      '. Add these under Worker Settings → Variables and Secrets, not Build variables, and deploy the changes.');
  }
  if (request.method === 'POST' && path.endsWith('/connect')) {
    const verifier = randomUrlSafe();
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = toBase64(new Uint8Array(digest)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    const state = randomUrlSafe();
    await db.prepare('DELETE FROM calendar_oauth_states WHERE expires_at < ?').bind(Date.now()).run();
    await db.prepare(
      'INSERT INTO calendar_oauth_states (state, household_id, verifier, expires_at) VALUES (?, ?, ?, ?)',
    ).bind(state, household.id, verifier, Date.now() + 10 * 60_000).run();
    const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    for (const [key, value] of Object.entries({
      client_id: env.GOOGLE_CLIENT_ID!, redirect_uri: REDIRECT_URI, response_type: 'code',
      scope: SCOPES, access_type: 'offline', prompt: 'consent', state,
      code_challenge: challenge, code_challenge_method: 'S256',
    })) auth.searchParams.set(key, value);
    return response({ url: auth.toString() });
  }
  if (request.method === 'POST' && path.endsWith('/refresh')) {
    const saved = await connection(db, household.id);
    if (!saved) return failure(409, 'CALENDAR_NOT_CONNECTED', 'Connect Google Calendar first.');
    await refreshCalendarList(db, household.id, await accessToken(env, saved));
    return response({ ok: true });
  }
  if (request.method === 'PUT' && path.endsWith('/selection')) {
    const input = await request.json().catch(() => ({})) as { calendarIds?: unknown };
    if (!Array.isArray(input.calendarIds) || input.calendarIds.some((id) => typeof id !== 'string') ||
        input.calendarIds.length > 100) {
      return failure(400, 'SELECTION_INVALID', 'Select valid calendars.');
    }
    const selected = new Set(input.calendarIds as string[]);
    const known = await sources(db, household.id);
    if ([...selected].some((id) => !known.some((row) => row.calendar_id === id))) {
      return failure(400, 'SELECTION_INVALID', 'One or more calendars are not available.');
    }
    for (const source of known) {
      const enabled = selected.has(source.calendar_id);
      await db.prepare('UPDATE calendar_sources SET selected = ? WHERE household_id = ? AND calendar_id = ?')
        .bind(enabled ? 1 : 0, household.id, source.calendar_id).run();
      if (!enabled) {
        await db.prepare('DELETE FROM calendar_events WHERE household_id = ? AND calendar_id = ?')
          .bind(household.id, source.calendar_id).run();
      }
    }
    await syncCalendars(db, env);
    return response({ ok: true });
  }
  if (request.method === 'POST' && path.endsWith('/sync')) {
    await syncCalendars(db, env);
    return response({ ok: true });
  }
  if (request.method === 'DELETE' && path.endsWith('/disconnect')) {
    const saved = await connection(db, household.id);
    if (saved) {
      const token = await accessToken(env, saved).catch(() => null);
      if (token) for (const source of await sources(db, household.id)) await stopChannel(token, source);
    }
    await db.prepare('DELETE FROM calendar_connections WHERE household_id = ?').bind(household.id).run();
    await db.prepare('DELETE FROM calendar_sources WHERE household_id = ?').bind(household.id).run();
    await db.prepare('DELETE FROM calendar_events WHERE household_id = ?').bind(household.id).run();
    await db.prepare('DELETE FROM calendar_completions WHERE household_id = ?').bind(household.id).run();
    return response({ ok: true });
  }
  return failure(404, 'NOT_FOUND', 'Unknown calendar operation.');
}
