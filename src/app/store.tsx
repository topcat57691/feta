import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Availability, HouseholdState, JobDefinition, Person } from './types';
import { householdRepository } from '../repositories/household.repository';
import { todayKey } from '../lib/date';
import { makeId } from '../lib/id';
import { hashPin } from '../lib/pin';
import { learnCadence } from '../features/cadence/cadence';
import { nextFlowStateId } from '../features/flows/flowDefinitions';
import { createDemoHousehold } from './demo';

const COLORS = ['#bdd7ec', '#cfe3bf', '#f2d69b', '#e2c9e8', '#f0c6bb', '#bfe0d7'];
type CheckKey = 'sleptOkay' | 'feelingOkay' | 'vitamins';

interface StoreValue {
  state: HouseholdState | null;
  currentPerson?: Person;
  currentPersonId?: string;
  setCurrentPerson(id?: string): void;
  createHousehold(name: string, personName: string, pin: string): Promise<void>;
  loadDemo(): Promise<void>;
  addPerson(name: string, pin: string): Promise<void>;
  updatePerson(id: string, patch: Partial<Pick<Person, 'availability' | 'capacity' | 'presence'>>): void;
  toggleDaily(id: string, key: CheckKey): void;
  completeJob(jobId: string, personId: string, quantity?: number): string;
  markEventLeftTooLong(eventId: string): void;
  advanceFlow(flowId: string, personId: string): void;
  addJob(job: Omit<JobDefinition, 'id' | 'createdAt'>): void;
  updateJob(jobId: string, patch: Partial<JobDefinition>): void;
  setAdminPin(pin: string): Promise<void>;
  reset(): void;
}
const StoreContext = createContext<StoreValue | null>(null);

function normalizeDaily(person: Person): Person {
  const today = todayKey();
  if (person.daily.date === today) return person;
  return { ...person, daily: { date: today, sleptOkay: false, feelingOkay: false, vitamins: false } };
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, setStateRaw] = useState<HouseholdState | null>(() => householdRepository.loadHousehold());
  const [currentPersonId, setCurrentPersonIdRaw] = useState<string | undefined>(() => householdRepository.loadDevice().currentPersonId);

  useEffect(() => householdRepository.subscribeHousehold((next) => setStateRaw(next)), []);

  useEffect(() => {
    const refreshDailyChecks = () => {
      setStateRaw((current) => {
        if (!current) return current;
        const people = current.people.map(normalizeDaily);
        if (people.every((person, index) => person === current.people[index])) return current;
        const next = { ...current, people };
        householdRepository.saveHousehold(next);
        return next;
      });
    };
    refreshDailyChecks();
    const timer = window.setInterval(refreshDailyChecks, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const persist = useCallback((next: HouseholdState) => {
    setStateRaw(next);
    householdRepository.saveHousehold(next);
  }, []);

  const setCurrentPerson = useCallback((id?: string) => {
    setCurrentPersonIdRaw(id);
    householdRepository.saveDevice({ currentPersonId: id });
  }, []);

  const createHousehold = useCallback(async (name: string, personName: string, pin: string) => {
    const id = makeId('person');
    const person: Person = {
      id, name: personName.trim(), pinHash: await hashPin(pin), color: COLORS[0], availability: 'free', capacity: 3, presence: 'home',
      daily: { date: todayKey(), sleptOkay: false, feelingOkay: false, vitamins: false }, updatedAt: new Date().toISOString(),
    };
    const next: HouseholdState = { version: 1, householdName: name.trim() || 'Home', people: [person], jobs: [], events: [], flowStates: [
      { flowId: 'dishwasher', stateId: 'empty', updatedAt: new Date().toISOString() },
      { flowId: 'laundry', stateId: 'clear', updatedAt: new Date().toISOString() },
    ] };
    persist(next); setCurrentPerson(id);
  }, [persist, setCurrentPerson]);

  const loadDemo = useCallback(async () => {
    const next = await createDemoHousehold(); persist(next); setCurrentPerson(next.people[0].id);
  }, [persist, setCurrentPerson]);

  const addPerson = useCallback(async (name: string, pin: string) => {
    if (!state) return;
    const person: Person = { id: makeId('person'), name: name.trim(), pinHash: await hashPin(pin), color: COLORS[state.people.length % COLORS.length], availability: 'free', capacity: 3, presence: 'home', daily: { date: todayKey(), sleptOkay: false, feelingOkay: false, vitamins: false }, updatedAt: new Date().toISOString() };
    persist({ ...state, people: [...state.people, person] });
  }, [persist, state]);

  const updatePerson = useCallback((id: string, patch: Partial<Pick<Person, 'availability' | 'capacity' | 'presence'>>) => {
    if (!state) return;
    persist({ ...state, people: state.people.map((person) => person.id === id ? { ...normalizeDaily(person), ...patch, updatedAt: new Date().toISOString() } : person) });
  }, [persist, state]);

  const toggleDaily = useCallback((id: string, key: CheckKey) => {
    if (!state) return;
    persist({ ...state, people: state.people.map((person) => {
      if (person.id !== id) return person;
      const fresh = normalizeDaily(person);
      return { ...fresh, daily: { ...fresh.daily, [key]: !fresh.daily[key] }, updatedAt: new Date().toISOString() };
    }) });
  }, [persist, state]);

  const completeJob = useCallback((jobId: string, personId: string, quantity = 1) => {
    if (!state) return '';
    const event = { id: makeId('event'), jobId, personId, occurredAt: new Date().toISOString(), quantity };
    const events = [...state.events, event];
    const jobs = state.jobs.map((job) => job.id === jobId ? { ...job, cadence: learnCadence(job, events) } : job);
    persist({ ...state, events, jobs });
    return event.id;
  }, [persist, state]);

  const markEventLeftTooLong = useCallback((eventId: string) => {
    if (!state) return;
    const events = state.events.map((event) => event.id === eventId ? { ...event, leftTooLong: true } : event);
    const affected = state.events.find((event) => event.id === eventId);
    const jobs = affected ? state.jobs.map((job) => job.id === affected.jobId ? { ...job, cadence: learnCadence(job, events) } : job) : state.jobs;
    persist({ ...state, events, jobs });
  }, [persist, state]);

  const advanceFlow = useCallback((flowId: string, personId: string) => {
    if (!state) return;
    const current = state.flowStates.find((flow) => flow.flowId === flowId);
    const stateId = nextFlowStateId(flowId, current?.stateId ?? (flowId === 'dishwasher' ? 'empty' : 'clear'));
    const nextFlow = { flowId, stateId, updatedAt: new Date().toISOString(), updatedBy: personId };
    persist({ ...state, flowStates: [...state.flowStates.filter((flow) => flow.flowId !== flowId), nextFlow] });
  }, [persist, state]);

  const addJob = useCallback((job: Omit<JobDefinition, 'id' | 'createdAt'>) => {
    if (!state) return;
    persist({ ...state, jobs: [...state.jobs, { ...job, id: makeId('job'), createdAt: new Date().toISOString() }] });
  }, [persist, state]);

  const updateJob = useCallback((jobId: string, patch: Partial<JobDefinition>) => {
    if (!state) return;
    persist({ ...state, jobs: state.jobs.map((job) => job.id === jobId ? { ...job, ...patch } : job) });
  }, [persist, state]);

  const setAdminPin = useCallback(async (pin: string) => {
    if (!state) return;
    persist({ ...state, adminPinHash: await hashPin(pin) });
  }, [persist, state]);

  const reset = useCallback(() => { householdRepository.clear(); sessionStorage.removeItem('feta.admin.unlocked'); setStateRaw(null); setCurrentPersonIdRaw(undefined); }, []);

  const currentPerson = useMemo(() => state?.people.find((person) => person.id === currentPersonId), [state, currentPersonId]);
  const value = useMemo<StoreValue>(() => ({ state, currentPerson, currentPersonId, setCurrentPerson, createHousehold, loadDemo, addPerson, updatePerson, toggleDaily, completeJob, markEventLeftTooLong, advanceFlow, addJob, updateJob, setAdminPin, reset }), [state, currentPerson, currentPersonId, setCurrentPerson, createHousehold, loadDemo, addPerson, updatePerson, toggleDaily, completeJob, markEventLeftTooLong, advanceFlow, addJob, updateJob, setAdminPin, reset]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useAppStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useAppStore must be used inside AppStoreProvider');
  return value;
}

export const availabilityLabels: Record<Availability, string> = { 'in-zone': 'In the zone', free: 'Free', drained: 'Drained', out: 'Out' };
