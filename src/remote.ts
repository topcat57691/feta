import { FamilyState } from './model';

export type SyncStatus = 'local' | 'connecting' | 'synced' | 'offline';

interface RemoteRow {
  state: FamilyState;
  updated_at: string;
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const householdId = process.env.EXPO_PUBLIC_FETA_HOUSEHOLD_ID;

export function isRemoteConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey && householdId);
}

function requestHeaders(extra?: Record<string, string>) {
  if (!supabaseAnonKey || !householdId) throw new Error('Remote sync is not configured');
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
    'Content-Type': 'application/json',
    'x-household-token': householdId,
    ...extra,
  };
}

export async function fetchRemoteState(): Promise<RemoteRow | null> {
  if (!isRemoteConfigured() || !supabaseUrl || !householdId) return null;
  const query = new URLSearchParams({
    household_id: `eq.${householdId}`,
    select: 'state,updated_at',
    limit: '1',
  });
  const response = await fetch(`${supabaseUrl}/rest/v1/household_state?${query.toString()}`, {
    headers: requestHeaders(),
  });
  if (!response.ok) throw new Error(`Remote read failed (${response.status})`);
  const rows = (await response.json()) as RemoteRow[];
  return rows[0] ?? null;
}

export async function pushRemoteState(state: FamilyState): Promise<RemoteRow> {
  if (!isRemoteConfigured() || !supabaseUrl || !householdId) throw new Error('Remote sync is not configured');

  // Device identity is deliberately local. Everything else is household state.
  const sharedState: FamilyState = { ...state, currentPersonId: undefined };
  const response = await fetch(`${supabaseUrl}/rest/v1/household_state?on_conflict=household_id`, {
    method: 'POST',
    headers: requestHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify([{ household_id: householdId, state: sharedState }]),
  });
  if (!response.ok) throw new Error(`Remote write failed (${response.status})`);
  const rows = (await response.json()) as RemoteRow[];
  const row = rows[0];
  if (!row) throw new Error('Remote write returned no state');
  return row;
}
