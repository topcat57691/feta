import { describe, expect, it } from 'vitest';
import type { FlowDefinition, FlowState } from '../../app/types';
import {
  dueFlowTransitions,
  flowDefinitions,
  flowTiming,
  nextFlowStateId,
  validateFlow,
} from './flowDefinitions';

const at = '2026-11-16T12:00:00.000Z';
const state = (flowId: string, stateId: string): FlowState =>
  ({ flowId, stateId, updatedAt: at });

describe('flow state machines', () => {
  it('cycles the dishwasher through a calm deterministic flow', () => {
    expect(nextFlowStateId('dishwasher', 'empty')).toBe('filling');
    expect(nextFlowStateId('dishwasher', 'clean')).toBe('empty');
  });

  it('automatically finishes the three-hour washing cycle at the expected time', () => {
    const flow = flowDefinitions.find((candidate) => candidate.id === 'laundry')!;
    expect(dueFlowTransitions(flow, state('laundry', 'washing'), new Date('2026-11-16T14:59:59.000Z'))).toEqual([]);
    expect(dueFlowTransitions(flow, state('laundry', 'washing'), new Date('2026-11-16T17:30:00.000Z'))).toEqual([{
      fromStateId: 'washing',
      toStateId: 'ready-to-dry',
      fromUpdatedAt: at,
      occurredAt: '2026-11-16T15:00:00.000Z',
    }]);
  });

  it('uses the exact finish time as the start of the waiting state', () => {
    const flow = flowDefinitions.find((candidate) => candidate.id === 'laundry')!;
    const ready = { ...state('laundry', 'ready-to-dry'), updatedAt: '2026-11-16T15:00:00.000Z' };
    expect(flowTiming(flow, ready, new Date('2026-11-16T20:59:00.000Z')).reminderDue).toBe(false);
    expect(flowTiming(flow, ready, new Date('2026-11-16T21:00:00.000Z')).reminderDue).toBe(true);
    expect(flowTiming(flow, state('laundry', 'washing'), new Date('2026-11-16T13:30:00.000Z')).remainingMinutes).toBe(90);
  });

  it('supports optional timers and manual transitions', () => {
    const flow: FlowDefinition = {
      id: 'custom', name: 'Custom', icon: '✨',
      states: [
        { id: 'idle', label: 'Idle', nextAction: 'Start' },
        { id: 'run', label: 'Running', nextAction: 'Finish', durationMinutes: 90, autoAdvance: false },
        { id: 'done', label: 'Done', nextAction: 'Reset', remindAfterMinutes: 360 },
      ],
    };
    expect(dueFlowTransitions(flow, state('custom', 'run'), new Date('2026-11-18T12:00:00.000Z'))).toEqual([]);
    expect(flowTiming(flow, state('custom', 'idle')).remainingMinutes).toBeNull();
    expect(validateFlow(flow).states).toHaveLength(3);
  });

  it('prevents cycles that would automatically loop forever', () => {
    expect(() => validateFlow({
      name: 'Broken', icon: '🔄',
      states: [
        { id: 'a', label: 'A', nextAction: 'B', durationMinutes: 1, autoAdvance: true },
        { id: 'b', label: 'B', nextAction: 'A', durationMinutes: 1, autoAdvance: true },
      ],
    })).toThrow('FLOW_INVALID');
  });

  it('rejects duplicate stage IDs, zero timers and stages without actions', () => {
    const base = flowDefinitions[0];
    expect(() => validateFlow({ ...base, states: [
      { id: 'x', label: 'X', nextAction: 'Next' },
      { id: 'x', label: 'Y', nextAction: 'Next' },
    ] })).toThrow('FLOW_INVALID');
    expect(() => validateFlow({ ...base, states: [
      { id: 'x', label: 'X', nextAction: 'Next', durationMinutes: 0, autoAdvance: true },
      { id: 'y', label: 'Y', nextAction: 'Next' },
    ] })).toThrow('FLOW_INVALID');
  });
});
