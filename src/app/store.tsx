import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Availability, CalendarEvent, FlowDefinition, HouseholdState, JobDefinition, Person } from './types';
import { householdRepository } from '../repositories/household.repository';

const COLORS = ['#bdd7ec', '#cfe3bf', '#f2d69b', '#e2c9e8', '#f0c6bb', '#bfe0d7'];
type CheckKey = 'sleptOkay' | 'feelingOkay' | 'vitamins';

interface StoreValue {
  state: HouseholdState | null;
  ready: boolean;
  error?: string;
  currentPerson?: Person;
  currentPersonId?: string;
  refresh(): Promise<void>;
  setCurrentPerson(id?: string): void;
  createHousehold(name: string, personName: string, pin: string): Promise<void>;
  loadDemo(): Promise<void>;
  verifyPersonPin(personId: string, pin: string): Promise<boolean>;
  addPerson(name: string, pin: string): Promise<void>;
  updatePerson(id: string, patch: Partial<Pick<Person, 'availability' | 'capacity' | 'presence'>>): Promise<void>;
  toggleDaily(id: string, key: CheckKey): Promise<void>;
  completeJob(jobId: string, personId: string, quantity?: number): Promise<string>;
  completeCalendarEvent(event: CalendarEvent, personId: string, completed: boolean): Promise<void>;
  markEventLeftTooLong(eventId: string): Promise<void>;
  advanceFlow(flowId: string, personId: string): Promise<void>;
  addFlow(flow: Omit<FlowDefinition, 'id'>): Promise<void>;
  updateFlow(flowId: string, flow: Omit<FlowDefinition, 'id'>): Promise<void>;
  deleteFlow(flowId: string): Promise<void>;
  addJob(job: Omit<JobDefinition, 'id' | 'createdAt'>): Promise<void>;
  updateJob(jobId: string, patch: Partial<JobDefinition>): Promise<void>;
  setAdminPin(pin: string): Promise<void>;
  verifyAdminPin(pin: string): Promise<boolean>;
  reset(): Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<HouseholdState | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const [currentPersonId, setCurrentPersonIdRaw] = useState<string | undefined>(
    () => householdRepository.loadDevice().currentPersonId,
  );

  const rememberState = useCallback((next: HouseholdState | null) => {
    setState(next);
    setError(undefined);
  }, []);

  const refresh = useCallback(async () => {
    try {
      rememberState(await householdRepository.loadHousehold());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load FETA.');
    } finally {
      setReady(true);
    }
  }, [rememberState]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const setCurrentPerson = useCallback((id?: string) => {
    setCurrentPersonIdRaw(id);
    householdRepository.saveDevice({ currentPersonId: id });
  }, []);

  const createHousehold = useCallback(async (name: string, personName: string, pin: string) => {
    const result = await householdRepository.setupHousehold(name, personName, pin);
    rememberState(result.state);
    setCurrentPerson(result.personId);
  }, [rememberState, setCurrentPerson]);

  const loadDemo = useCallback(async () => {
    const result = await householdRepository.seedDemo();
    rememberState(result.state);
    setCurrentPerson(result.personId);
  }, [rememberState, setCurrentPerson]);

  const verifyPersonPin = useCallback(
    (personId: string, pin: string) => householdRepository.verifyPersonPin(personId, pin),
    [],
  );

  const addPerson = useCallback(async (name: string, pin: string) => {
    const color = COLORS[(state?.people.length ?? 0) % COLORS.length];
    rememberState(await householdRepository.addPerson(name, pin, color));
  }, [rememberState, state?.people.length]);

  const updatePerson = useCallback(async (
    id: string,
    patch: Partial<Pick<Person, 'availability' | 'capacity' | 'presence'>>,
  ) => {
    rememberState(await householdRepository.updatePerson(id, patch));
  }, [rememberState]);

  const toggleDaily = useCallback(async (id: string, key: CheckKey) => {
    rememberState(await householdRepository.toggleDaily(id, key));
  }, [rememberState]);

  const completeJob = useCallback(async (jobId: string, personId: string, quantity = 1) => {
    const result = await householdRepository.completeJob(jobId, personId, quantity);
    rememberState(result.state);
    return result.eventId;
  }, [rememberState]);

  const completeCalendarEvent = useCallback(async (event: CalendarEvent, personId: string, completed: boolean) => {
    rememberState(await householdRepository.completeCalendarEvent(event, personId, completed));
  }, [rememberState]);

  const markEventLeftTooLong = useCallback(async (eventId: string) => {
    rememberState(await householdRepository.markEventLeftTooLong(eventId));
  }, [rememberState]);

  const advanceFlow = useCallback(async (flowId: string, personId: string) => {
    rememberState(await householdRepository.advanceFlow(flowId, personId));
  }, [rememberState]);

  const addFlow = useCallback(async (flow: Omit<FlowDefinition, 'id'>) => {
    rememberState(await householdRepository.addFlow(flow));
  }, [rememberState]);

  const updateFlow = useCallback(async (id: string, flow: Omit<FlowDefinition, 'id'>) => {
    rememberState(await householdRepository.updateFlow(id, flow));
  }, [rememberState]);

  const deleteFlow = useCallback(async (id: string) => {
    rememberState(await householdRepository.deleteFlow(id));
  }, [rememberState]);

  const addJob = useCallback(async (job: Omit<JobDefinition, 'id' | 'createdAt'>) => {
    rememberState(await householdRepository.addJob(job));
  }, [rememberState]);

  const updateJob = useCallback(async (jobId: string, patch: Partial<JobDefinition>) => {
    rememberState(await householdRepository.updateJob(jobId, patch));
  }, [rememberState]);

  const setAdminPin = useCallback(async (pin: string) => {
    rememberState(await householdRepository.setAdminPin(pin));
    sessionStorage.setItem('feta.admin.pin', pin);
  }, [rememberState]);

  const verifyAdminPin = useCallback(async (pin: string) => {
    const ok = await householdRepository.verifyAdminPin(pin);
    if (ok) sessionStorage.setItem('feta.admin.pin', pin);
    return ok;
  }, []);

  const reset = useCallback(async () => {
    const pin = sessionStorage.getItem('feta.admin.pin');
    if (!pin) throw new Error('Unlock Admin again before resetting FETA.');
    await householdRepository.reset(pin);
    sessionStorage.removeItem('feta.admin.pin');
    sessionStorage.removeItem('feta.admin.unlocked');
    setCurrentPersonIdRaw(undefined);
    rememberState(null);
  }, [rememberState]);

  const currentPerson = useMemo(
    () => state?.people.find((person) => person.id === currentPersonId),
    [state, currentPersonId],
  );

  const value = useMemo<StoreValue>(() => ({
    state,
    ready,
    error,
    currentPerson,
    currentPersonId,
    refresh,
    setCurrentPerson,
    createHousehold,
    loadDemo,
    verifyPersonPin,
    addPerson,
    updatePerson,
    toggleDaily,
    completeJob,
    completeCalendarEvent,
    markEventLeftTooLong,
    advanceFlow,
    addFlow,
    updateFlow,
    deleteFlow,
    addJob,
    updateJob,
    setAdminPin,
    verifyAdminPin,
    reset,
  }), [
    state,
    ready,
    error,
    currentPerson,
    currentPersonId,
    refresh,
    setCurrentPerson,
    createHousehold,
    loadDemo,
    verifyPersonPin,
    addPerson,
    updatePerson,
    toggleDaily,
    completeJob,
    completeCalendarEvent,
    markEventLeftTooLong,
    advanceFlow,
    addFlow,
    updateFlow,
    deleteFlow,
    addJob,
    updateJob,
    setAdminPin,
    verifyAdminPin,
    reset,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useAppStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useAppStore must be used inside AppStoreProvider');
  return value;
}

export const availabilityLabels: Record<Availability, string> = {
  'in-zone': 'In the zone',
  free: 'Free',
  drained: 'Drained',
  out: 'Out',
};
