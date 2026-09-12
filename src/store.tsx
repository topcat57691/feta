import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  avatarColors, defaultFlows, defaultHabits, FamilyState, FlowId, HealthKey, HouseholdFlow,
  nextFlowState, PersonStatus, Priority, todayKey,
} from './model';
import { fetchRemoteState, isRemoteConfigured, pushRemoteState, SyncStatus } from './remote';

const STORAGE_KEY = 'feta.family-state.v1';
const initialState: FamilyState = { people: [], habits: defaultHabits, habitCompletions: {}, flows: defaultFlows, nextUp: [], dayKey: todayKey() };

interface FamilyContextValue {
  state: FamilyState; ready: boolean; syncStatus: SyncStatus;
  addPerson(name: string): void; togglePersonActive(personId: string): void; setCurrentPerson(personId?: string): void;
  setStatus(personId: string, status: PersonStatus): void; setEnergy(personId: string, energy: number): void; toggleHealth(personId: string, key: HealthKey): void;
  toggleHabit(personId: string, habitId: string): void; advanceFlow(flowId: FlowId): void;
  addNextUp(title: string, priority: Priority, assigneeId?: string): void; toggleNextUp(itemId: string): void; claimNextUp(itemId: string, personId: string): void; removeNextUp(itemId: string): void;
}
const FamilyContext = createContext<FamilyContextValue | null>(null);

function resetForToday(state: FamilyState): FamilyState {
  const currentDay = todayKey();
  if (state.dayKey === currentDay) return state;
  return { ...state, dayKey: currentDay, habitCompletions: {}, people: state.people.map((person) => ({ ...person, health: { sleptWell: false, hydrated: false, feelingOkay: false } })) };
}
function normaliseState(raw: FamilyState): FamilyState {
  const flowMap = new Map(raw.flows?.map((flow) => [flow.id, flow] as const) ?? []);
  const habitMap = new Map(raw.habits?.map((habit) => [habit.id, habit] as const) ?? []);
  return resetForToday({
    ...initialState, ...raw,
    people: raw.people ?? [], nextUp: raw.nextUp ?? [], habitCompletions: raw.habitCompletions ?? {},
    habits: defaultHabits.map((habit) => ({ ...habit, ...(habitMap.get(habit.id) ?? {}) })),
    flows: defaultFlows.map((flow) => ({ ...flow, ...(flowMap.get(flow.id) ?? {}) })),
  });
}

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FamilyState>(initialState);
  const [ready, setReady] = useState(false);
  const [remoteReady, setRemoteReady] = useState(!isRemoteConfigured());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(isRemoteConfigured() ? 'connecting' : 'local');
  const remoteRevision = useRef<string | undefined>(undefined);
  const applyingRemote = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && saved) setState(normaliseState(JSON.parse(saved) as FamilyState));
      } catch {
        // Local state should never be able to stop the dashboard opening.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setState((current) => resetForToday(current)), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => undefined);
  }, [ready, state]);

  useEffect(() => {
    if (!ready || !isRemoteConfigured()) return;
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    const pull = async (initial = false) => {
      try {
        const remote = await fetchRemoteState();
        if (cancelled) return;
        if (remote) {
          if (initial || remote.updated_at !== remoteRevision.current) {
            remoteRevision.current = remote.updated_at;
            applyingRemote.current = true;
            setState(normaliseState(remote.state));
          }
        } else if (initial) {
          const created = await pushRemoteState(state);
          if (cancelled) return;
          remoteRevision.current = created.updated_at;
        }
        setSyncStatus('synced');
      } catch {
        if (!cancelled) setSyncStatus('offline');
      }
    };

    (async () => {
      setSyncStatus('connecting');
      await pull(true);
      if (!cancelled) {
        setRemoteReady(true);
        pollTimer = setInterval(() => { void pull(false); }, 5000);
      }
    })();

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
    };
    // The initial local state is intentionally captured once; later changes are pushed by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (!ready || !remoteReady || !isRemoteConfigured()) return;
    if (applyingRemote.current) {
      applyingRemote.current = false;
      return;
    }
    const timer = setTimeout(() => {
      pushRemoteState(state)
        .then((row) => {
          remoteRevision.current = row.updated_at;
          setSyncStatus('synced');
        })
        .catch(() => setSyncStatus('offline'));
    }, 450);
    return () => clearTimeout(timer);
  }, [ready, remoteReady, state]);

  const value = useMemo<FamilyContextValue>(() => ({
    state, ready, syncStatus,
    addPerson(name) {
      const clean = name.trim(); if (!clean) return;
      setState((current) => {
        const id = `person-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        return { ...current, people: [...current.people, {
          id, name: clean, isActive: true, status: 'free', energy: 80,
          avatarColor: avatarColors[current.people.length % avatarColors.length] ?? '#DCEBE4',
          health: { sleptWell: false, hydrated: false, feelingOkay: true },
        }], currentPersonId: current.currentPersonId ?? id };
      });
    },
    togglePersonActive(personId) {
      setState((current) => ({ ...current, people: current.people.map((person) => person.id === personId ? { ...person, isActive: !person.isActive } : person) }));
    },
    setCurrentPerson(personId) {
      setState((current) => ({ ...current, currentPersonId: personId, people: current.people.map((person) => person.id === personId ? { ...person, isActive: true } : person) }));
    },
    setStatus(personId, status) {
      setState((current) => ({ ...current, people: current.people.map((person) => person.id === personId ? { ...person, status } : person) }));
    },
    setEnergy(personId, energy) {
      setState((current) => ({ ...current, people: current.people.map((person) => person.id === personId ? { ...person, energy: Math.max(0, Math.min(100, energy)) } : person) }));
    },
    toggleHealth(personId, key) {
      setState((current) => ({ ...current, people: current.people.map((person) => person.id === personId ? { ...person, health: { ...person.health, [key]: !person.health[key] } } : person) }));
    },
    toggleHabit(personId, habitId) {
      setState((current) => {
        const habit = current.habitCompletions[habitId] ?? {};
        return { ...current, habitCompletions: { ...current.habitCompletions, [habitId]: { ...habit, [personId]: !habit[personId] } } };
      });
    },
    advanceFlow(flowId) {
      setState((current) => {
        const now = new Date().toISOString(); const actor = current.currentPersonId;
        const flows = current.flows.map((flow): HouseholdFlow => {
          if (flow.id !== flowId) return flow;
          const nextState = nextFlowState(flow); const completed = nextState === 'clear';
          return { ...flow, state: nextState, lastUpdatedAt: now, lastUpdatedById: actor,
            ...(completed ? { lastCompletedAt: now, lastCompletedById: actor } : {}) };
        });
        if (flowId === 'kitchen' && current.flows.find((flow) => flow.id === 'kitchen')?.state === 'clear') {
          const index = flows.findIndex((flow) => flow.id === 'dishwasher'); const dishwasher = flows[index];
          if (dishwasher?.state === 'clear') flows[index] = { ...dishwasher, state: 'filling', lastUpdatedAt: now, lastUpdatedById: actor };
        }
        return { ...current, flows };
      });
    },
    addNextUp(title, priority, assigneeId) {
      const clean = title.trim(); if (!clean) return;
      setState((current) => ({ ...current, nextUp: [...current.nextUp, {
        id: `next-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: clean, priority, assigneeId, createdAt: new Date().toISOString(),
      }] }));
    },
    toggleNextUp(itemId) {
      setState((current) => ({ ...current, nextUp: current.nextUp.map((item) => item.id === itemId ? { ...item, completedAt: item.completedAt ? undefined : new Date().toISOString() } : item) }));
    },
    claimNextUp(itemId, personId) {
      setState((current) => ({ ...current, nextUp: current.nextUp.map((item) => item.id === itemId ? { ...item, assigneeId: personId } : item) }));
    },
    removeNextUp(itemId) {
      setState((current) => ({ ...current, nextUp: current.nextUp.filter((item) => item.id !== itemId) }));
    },
  }), [ready, state, syncStatus]);

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily() {
  const context = useContext(FamilyContext);
  if (!context) throw new Error('useFamily must be used inside FamilyProvider');
  return context;
}
