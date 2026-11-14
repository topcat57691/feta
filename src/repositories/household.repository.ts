import type { DeviceState, HouseholdState } from '../app/types';

const HOUSEHOLD_KEY = 'feta.household.v1';
const DEVICE_KEY = 'feta.device.v1';

export interface HouseholdRepository {
  loadHousehold(): HouseholdState | null;
  saveHousehold(state: HouseholdState): void;
  loadDevice(): DeviceState;
  saveDevice(state: DeviceState): void;
  subscribeHousehold(listener: (state: HouseholdState | null) => void): () => void;
  clear(): void;
}

export class LocalHouseholdRepository implements HouseholdRepository {
  loadHousehold(): HouseholdState | null {
    const raw = localStorage.getItem(HOUSEHOLD_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as HouseholdState; } catch { return null; }
  }

  saveHousehold(state: HouseholdState): void {
    localStorage.setItem(HOUSEHOLD_KEY, JSON.stringify(state));
  }

  loadDevice(): DeviceState {
    const raw = localStorage.getItem(DEVICE_KEY);
    if (!raw) return {};
    try { return JSON.parse(raw) as DeviceState; } catch { return {}; }
  }

  saveDevice(state: DeviceState): void {
    localStorage.setItem(DEVICE_KEY, JSON.stringify(state));
  }

  subscribeHousehold(listener: (state: HouseholdState | null) => void): () => void {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== HOUSEHOLD_KEY) return;
      listener(this.loadHousehold());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }

  clear(): void {
    localStorage.removeItem(HOUSEHOLD_KEY);
    localStorage.removeItem(DEVICE_KEY);
  }
}

export const householdRepository = new LocalHouseholdRepository();
