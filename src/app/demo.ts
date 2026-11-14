import type { HouseholdState, JobEvent, Person } from './types';
import { hashPin } from '../lib/pin';
import { todayKey } from '../lib/date';

function ago(days: number, hours = 0): string {
  return new Date(Date.now() - (days * 24 + hours) * 60 * 60 * 1000).toISOString();
}

export async function createDemoHousehold(): Promise<HouseholdState> {
  const pinHash = await hashPin('1234');
  const today = todayKey();
  const people: Person[] = [
    { id: 'tristan', name: 'Tristan', pinHash, color: '#bdd7ec', availability: 'in-zone', capacity: 4, presence: 'home', daily: { date: today, sleptOkay: true, feelingOkay: true, vitamins: false }, updatedAt: new Date().toISOString() },
    { id: 'sarah', name: 'Sarah', pinHash, color: '#cfe3bf', availability: 'free', capacity: 5, presence: 'home', daily: { date: today, sleptOkay: true, feelingOkay: true, vitamins: true }, updatedAt: new Date().toISOString() },
    { id: 'leo', name: 'Leo', pinHash, color: '#f2d69b', availability: 'free', capacity: 3, presence: 'out', daily: { date: today, sleptOkay: true, feelingOkay: true, vitamins: true }, updatedAt: new Date().toISOString() },
  ];
  const events: JobEvent[] = [
    { id: 'e1', jobId: 'bathroom', personId: 'sarah', occurredAt: ago(6), quantity: 1 },
    { id: 'e2', jobId: 'garden', personId: 'tristan', occurredAt: ago(6, 5), quantity: 1 },
    { id: 'e3', jobId: 'washing', personId: 'sarah', occurredAt: ago(1), quantity: 4 },
    { id: 'e4', jobId: 'washing', personId: 'tristan', occurredAt: ago(7), quantity: 8 },
    { id: 'e5', jobId: 'washing', personId: 'sarah', occurredAt: ago(14), quantity: 13 },
    { id: 'e6', jobId: 'bathroom', personId: 'tristan', occurredAt: ago(13), quantity: 1 },
    { id: 'e7', jobId: 'garden', personId: 'sarah', occurredAt: ago(15), quantity: 1 },
  ];

  return {
    version: 1,
    householdName: 'Home',
    people,
    jobs: [
      { id: 'bathroom', name: 'Bathroom', icon: '🛁', kind: 'session', enabled: true, cadence: { rate: 1, period: 'week', mode: 'auto' }, createdAt: ago(60) },
      { id: 'garden', name: 'Garden', icon: '🌿', kind: 'session', enabled: true, cadence: { rate: 0.7, period: 'week', mode: 'auto' }, createdAt: ago(60) },
      { id: 'washing', name: 'Washing', icon: '🧺', kind: 'counted', enabled: true, unitLabel: 'loads', cadence: { rate: 14, period: 'week', mode: 'auto', preferredDay: 0 }, createdAt: ago(60) },
      { id: 'bins', name: 'Bins', icon: '🗑️', kind: 'calendar', enabled: true, cadence: { rate: 1, period: 'week', mode: 'manual' }, calendarDay: 3, createdAt: ago(60) },
    ],
    events,
    flowStates: [
      { flowId: 'dishwasher', stateId: 'clean', updatedAt: ago(0, 3), updatedBy: 'tristan' },
      { flowId: 'laundry', stateId: 'ready-to-put-away', updatedAt: ago(0, 1), updatedBy: 'sarah' },
    ],
  };
}
