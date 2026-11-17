import { describe, expect, it } from 'vitest';
import type { FlowDefinition, FlowInstance } from '../../app/types';
import {
  isLaundryState, laundryAutoTransition, laundryNextState, laundryStats,
  laundryTiming, occupiedAppliance,
} from './laundry';

const now = '2026-11-16T12:00:00.000Z';
const flow: FlowDefinition = {
  id: 'laundry', name: 'Laundry', icon: '🧺',
  states: [
    { id: 'clear', label: 'Clear', nextAction: 'Start wash' },
    { id: 'washing', label: 'Washing', nextAction: 'Finished', durationMinutes: 180, autoAdvance: true },
    { id: 'ready-to-dry', label: 'Wet', nextAction: 'Start drying', remindAfterMinutes: 360 },
    { id: 'drying', label: 'Drying', nextAction: 'Finished', durationMinutes: 90, autoAdvance: true },
    { id: 'ready-to-put-away', label: 'Dry', nextAction: 'Put away', remindAfterMinutes: 720 },
  ],
};
function load(id: string, stateId: string, updatedAt = now): FlowInstance {
  return { id, flowId: 'laundry', name: 'Load ' + id, stateId, updatedAt, createdAt: now };
}

describe('independent laundry loads', () => {
  it('counts several loads in different states without collapsing into one state', () => {
    const loads = [load('1', 'waiting'), load('2', 'washing'), load('3', 'drying'),
      load('4', 'wet'), load('5', 'ready-to-put-away')];
    const stats = laundryStats(loads);
    expect(stats.total).toBe(5);
    expect(stats.waiting).toBe(1);
    expect(stats.wet).toBe(1);
    expect(stats.ready).toBe(1);
    expect(stats.washing?.id).toBe('2');
    expect(stats.drying?.id).toBe('3');
  });

  it('keeps finished laundry physically in its machine until unloading', () => {
    const washed = laundryAutoTransition(load('1', 'washing'), flow, new Date('2026-11-16T15:00:00.000Z'));
    const dried = laundryAutoTransition(load('2', 'drying'), flow, new Date('2026-11-16T13:30:00.000Z'));
    expect(washed).toEqual({ to: 'wash-complete', occurredAt: '2026-11-16T15:00:00.000Z' });
    expect(dried).toEqual({ to: 'dryer-complete', occurredAt: '2026-11-16T13:30:00.000Z' });
    expect(occupiedAppliance('wash-complete')).toBe('washer');
    expect(occupiedAppliance('dryer-complete')).toBe('dryer');
    expect(occupiedAppliance('wet')).toBeNull();
    expect(occupiedAppliance('air-drying')).toBeNull();
  });

  it('does not automatically finish a cycle early, or when auto-advance is off', () => {
    expect(laundryAutoTransition(load('1', 'washing'), flow, new Date('2026-11-16T14:59:59.000Z'))).toBeNull();
    const manualFlow: FlowDefinition = { ...flow, states: flow.states.map(s =>
      s.id === 'washing' ? { ...s, autoAdvance: false } : s) };
    expect(laundryAutoTransition(load('1', 'washing'), manualFlow, new Date('2026-11-17T12:00:00.000Z'))).toBeNull();
  });

  it('supports a direct washer-to-dryer transfer, wet waiting and air drying', () => {
    expect(laundryNextState('wash-complete', 'transfer-to-dryer')).toBe('drying');
    expect(laundryNextState('wash-complete', 'unload-wet')).toBe('wet');
    expect(laundryNextState('wet', 'air-dry')).toBe('air-drying');
    expect(laundryNextState('air-drying', 'finish-air')).toBe('ready-to-put-away');
    expect(laundryNextState('ready-to-put-away', 'put-away')).toBe('done');
    expect(laundryNextState('waiting', 'put-away')).toBeNull();
    expect(isLaundryState('done')).toBe(false);
  });

  it('keeps time for each load independently and reminds gently when wet or dry', () => {
    expect(laundryTiming(load('a', 'washing'), flow, new Date('2026-11-16T13:30:00.000Z')).remainingMinutes).toBe(90);
    expect(laundryTiming(load('b', 'wet'), flow, new Date('2026-11-16T17:59:00.000Z')).reminderDue).toBe(false);
    expect(laundryTiming(load('b', 'wet'), flow, new Date('2026-11-16T18:00:00.000Z')).reminderDue).toBe(true);
    expect(laundryTiming(load('c', 'ready-to-put-away'), flow, new Date('2026-11-17T00:00:00.000Z')).reminderDue).toBe(true);
  });

  it('keeps wet and ready-load counts even while the appliances are occupied', () => {
    const stats = laundryStats([load('a', 'wash-complete'), load('b', 'dryer-complete'),
      load('c', 'wet'), load('d', 'ready-to-put-away'), load('e', 'air-drying')]);
    expect(stats.wet).toBe(2);
    expect(stats.ready).toBe(2);
    expect(stats.airDrying).toBe(1);
    expect(stats.washing?.id).toBe('a');
    expect(stats.drying?.id).toBe('b');
  });
});
