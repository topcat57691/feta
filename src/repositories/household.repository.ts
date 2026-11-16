import type {
  Availability,
  DeviceState,
  CalendarEvent,
  FlowDefinition,
  HouseholdState,
  JobDefinition,
  Person,
  Presence,
} from '../app/types';
import { todayKey } from '../lib/date';

const CACHE_KEY = 'feta.household.cache.v1';
const DEVICE_KEY = 'feta.device.v1';

export class HouseholdApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
    public readonly stage?: string,
  ) {
    const diagnostic = requestId ? ` [${stage ?? code} · ${requestId.slice(0, 8)}]` : '';
    super(`${message}${diagnostic}`);
  }
}

interface SetupResult {
  state: HouseholdState;
  personId: string;
}

interface CompleteJobResult {
  state: HouseholdState;
  eventId: string;
}

class HouseholdRepository {
  private cache(state: HouseholdState | null): void {
    if (state) localStorage.setItem(CACHE_KEY, JSON.stringify(state));
    else localStorage.removeItem(CACHE_KEY);
  }

  private cached(): HouseholdState | null {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as HouseholdState; } catch { return null; }
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('x-feta-date', todayKey());
    if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');

    const response = await fetch(path, { ...init, headers });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as {
        code?: string;
        message?: string;
        requestId?: string;
        stage?: string;
      };
      throw new HouseholdApiError(
        response.status,
        payload.code ?? 'REQUEST_FAILED',
        payload.message ?? `FETA request failed with ${response.status}`,
        payload.requestId,
        payload.stage,
      );
    }
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  }

  async loadHousehold(): Promise<HouseholdState | null> {
    try {
      const state = await this.request<HouseholdState>('/api/household');
      this.cache(state);
      return state;
    } catch (error) {
      if (error instanceof HouseholdApiError) {
        if (error.status === 404) {
          this.cache(null);
          return null;
        }
        throw error;
      }
      const cached = this.cached();
      if (cached?.householdId && Array.isArray(cached.flowEvents)) return cached;
      throw error;
    }
  }

  async setupHousehold(householdName: string, personName: string, pin: string): Promise<SetupResult> {
    const result = await this.request<SetupResult>('/api/setup', {
      method: 'POST',
      body: JSON.stringify({ householdName, personName, pin, color: '#bdd7ec' }),
    });
    this.cache(result.state);
    return result;
  }

  async seedDemo(): Promise<SetupResult> {
    const result = await this.request<SetupResult>('/api/demo', { method: 'POST', body: '{}' });
    this.cache(result.state);
    return result;
  }

  async verifyPersonPin(personId: string, pin: string): Promise<boolean> {
    const result = await this.request<{ ok: boolean }>('/api/auth/person', {
      method: 'POST',
      body: JSON.stringify({ personId, pin }),
    });
    return result.ok;
  }

  async addPerson(name: string, pin: string, color: string): Promise<HouseholdState> {
    const state = await this.request<HouseholdState>('/api/people', {
      method: 'POST',
      body: JSON.stringify({ name, pin, color }),
    });
    this.cache(state);
    return state;
  }

  async updatePerson(
    id: string,
    patch: Partial<Pick<Person, 'availability' | 'capacity' | 'presence'>>,
  ): Promise<HouseholdState> {
    const state = await this.request<HouseholdState>(`/api/people/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    this.cache(state);
    return state;
  }

  async toggleDaily(
    personId: string,
    key: 'sleptOkay' | 'feelingOkay' | 'vitamins',
  ): Promise<HouseholdState> {
    const state = await this.request<HouseholdState>(`/api/people/${encodeURIComponent(personId)}/daily`, {
      method: 'POST',
      body: JSON.stringify({ key }),
    });
    this.cache(state);
    return state;
  }

  async completeJob(jobId: string, personId: string, quantity = 1): Promise<CompleteJobResult> {
    const result = await this.request<CompleteJobResult>(`/api/jobs/${encodeURIComponent(jobId)}/complete`, {
      method: 'POST',
      body: JSON.stringify({ personId, quantity }),
    });
    this.cache(result.state);
    return result;
  }

  async completeCalendarEvent(event: CalendarEvent, personId: string, completed: boolean): Promise<HouseholdState> {
    const state = await this.request<HouseholdState>('/api/calendar/complete', {
      method: completed ? 'POST' : 'DELETE',
      body: JSON.stringify({ calendarId: event.calendarId, eventId: event.eventId, personId }),
    });
    this.cache(state);
    return state;
  }

  async markEventLeftTooLong(eventId: string): Promise<HouseholdState> {
    const state = await this.request<HouseholdState>(`/api/events/${encodeURIComponent(eventId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ leftTooLong: true }),
    });
    this.cache(state);
    return state;
  }

  async advanceFlow(flowId: string, personId: string): Promise<HouseholdState> {
    const state = await this.request<HouseholdState>(`/api/flows/${encodeURIComponent(flowId)}/advance`, {
      method: 'POST',
      body: JSON.stringify({ personId }),
    });
    this.cache(state);
    return state;
  }


  private adminHeaders(): Record<string, string> {
    const pin = sessionStorage.getItem('feta.admin.pin');
    if (!pin) throw new Error('Unlock Admin again to configure cycles.');
    return { 'x-admin-pin': pin };
  }

  async addFlow(flow: Omit<FlowDefinition, 'id'>): Promise<HouseholdState> {
    const state = await this.request<HouseholdState>('/api/flows', {
      method: 'POST', headers: this.adminHeaders(), body: JSON.stringify(flow),
    });
    this.cache(state);
    return state;
  }

  async updateFlow(flowId: string, flow: Omit<FlowDefinition, 'id'>): Promise<HouseholdState> {
    const state = await this.request<HouseholdState>('/api/flows/' + encodeURIComponent(flowId), {
      method: 'PUT', headers: this.adminHeaders(), body: JSON.stringify(flow),
    });
    this.cache(state);
    return state;
  }

  async deleteFlow(flowId: string): Promise<HouseholdState> {
    const state = await this.request<HouseholdState>('/api/flows/' + encodeURIComponent(flowId), {
      method: 'DELETE', headers: this.adminHeaders(),
    });
    this.cache(state);
    return state;
  }

  async addJob(job: Omit<JobDefinition, 'id' | 'createdAt'>): Promise<HouseholdState> {
    const state = await this.request<HouseholdState>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(job),
    });
    this.cache(state);
    return state;
  }

  async updateJob(jobId: string, patch: Partial<JobDefinition>): Promise<HouseholdState> {
    const state = await this.request<HouseholdState>(`/api/jobs/${encodeURIComponent(jobId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    this.cache(state);
    return state;
  }

  async setAdminPin(pin: string): Promise<HouseholdState> {
    const state = await this.request<HouseholdState>('/api/admin/pin', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
    this.cache(state);
    return state;
  }

  async verifyAdminPin(pin: string): Promise<boolean> {
    const result = await this.request<{ ok: boolean }>('/api/auth/admin', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
    return result.ok;
  }

  async reset(adminPin: string): Promise<void> {
    await this.request<void>('/api/household', {
      method: 'DELETE',
      headers: { 'x-admin-pin': adminPin },
    });
    this.cache(null);
    localStorage.removeItem(DEVICE_KEY);
  }

  loadDevice(): DeviceState {
    const raw = localStorage.getItem(DEVICE_KEY);
    if (!raw) return {};
    try { return JSON.parse(raw) as DeviceState; } catch { return {}; }
  }

  saveDevice(state: DeviceState): void {
    localStorage.setItem(DEVICE_KEY, JSON.stringify(state));
  }

  clearCache(): void {
    this.cache(null);
  }
}

export const householdRepository = new HouseholdRepository();

export type PersonPatch = {
  availability?: Availability;
  capacity?: Person['capacity'];
  presence?: Presence;
};
