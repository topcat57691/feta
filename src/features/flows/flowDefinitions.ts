import type { FlowDefinition, FlowStage, FlowState } from '../../app/types';

export const flowDefinitions: FlowDefinition[] = [
  {
    id: 'dishwasher',
    name: 'Dishwasher',
    icon: '🍽️',
    states: [
      { id: 'empty', label: 'Empty', nextAction: 'Started loading' },
      { id: 'filling', label: 'Filling', nextAction: 'Run dishwasher', attention: 'soon' },
      { id: 'running', label: 'Running', nextAction: 'Mark clean', durationMinutes: 120, autoAdvance: true },
      { id: 'clean', label: 'Clean', nextAction: 'Empty dishwasher', remindAfterMinutes: 1440 },
    ],
  },
  {
    id: 'laundry',
    name: 'Laundry',
    icon: '🧺',
    states: [
      { id: 'clear', label: 'Clear', nextAction: 'Start wash' },
      { id: 'washing', label: 'Washing', nextAction: 'Wash finished', durationMinutes: 180, autoAdvance: true },
      { id: 'ready-to-dry', label: 'Ready to dry', nextAction: 'Start drying', remindAfterMinutes: 360 },
      { id: 'drying', label: 'Drying', nextAction: 'Drying finished', durationMinutes: 90, autoAdvance: true },
      { id: 'ready-to-put-away', label: 'Ready to put away', nextAction: 'Put away', remindAfterMinutes: 720 },
    ],
  },
];

export function getFlowDefinition(flowId: string): FlowDefinition {
  const flow = flowDefinitions.find((candidate) => candidate.id === flowId);
  if (!flow) throw new Error('FLOW_NOT_FOUND');
  return flow;
}

export function getFlowStateDefinition(flow: FlowDefinition | string, stateId: string): FlowStage {
  const definition = typeof flow === 'string' ? getFlowDefinition(flow) : flow;
  return definition.states.find((state) => state.id === stateId) ?? definition.states[0];
}

export function nextFlowStateId(flow: FlowDefinition | string, stateId: string): string {
  const definition = typeof flow === 'string' ? getFlowDefinition(flow) : flow;
  const index = Math.max(0, definition.states.findIndex((state) => state.id === stateId));
  return definition.states[(index + 1) % definition.states.length].id;
}

export function flowTiming(flow: FlowDefinition, state: FlowState, now = new Date()) {
  const stage = getFlowStateDefinition(flow, state.stateId);
  const entered = new Date(state.updatedAt).getTime();
  const elapsed = Math.max(0, now.getTime() - entered);
  const duration = stage.durationMinutes ? stage.durationMinutes * 60_000 : null;
  const waiting = stage.remindAfterMinutes ? stage.remindAfterMinutes * 60_000 : null;
  const remainingMinutes = duration === null ? null : Math.max(0, Math.ceil((duration - elapsed) / 60_000));
  const reminderDue = waiting !== null && elapsed >= waiting;
  const reminderMinutes = waiting === null ? null : Math.max(0, Math.ceil((waiting - elapsed) / 60_000));
  return { stage, remainingMinutes, reminderDue, reminderMinutes, elapsedMinutes: Math.floor(elapsed / 60_000) };
}

export interface TimedTransition {
  fromStateId: string;
  toStateId: string;
  fromUpdatedAt: string;
  occurredAt: string;
}

// Calculate from stored timestamps so timers work even when the app is closed.
// At least one manually advanced stage is required to prevent endless automatic loops.
export function dueFlowTransitions(flow: FlowDefinition, state: FlowState, now = new Date()): TimedTransition[] {
  const transitions: TimedTransition[] = [];
  let current = state.stateId;
  let entered = state.updatedAt;
  const nowMs = now.getTime();
  for (let index = 0; index < flow.states.length; index += 1) {
    const stage = getFlowStateDefinition(flow, current);
    if (!stage.autoAdvance || !stage.durationMinutes) break;
    const enteredMs = new Date(entered).getTime();
    if (!Number.isFinite(enteredMs)) break;
    const dueMs = enteredMs + stage.durationMinutes * 60_000;
    if (dueMs > nowMs) break;
    const next = nextFlowStateId(flow, current);
    const occurredAt = new Date(dueMs).toISOString();
    transitions.push({ fromStateId: current, toStateId: next, fromUpdatedAt: entered, occurredAt });
    current = next;
    entered = occurredAt;
  }
  return transitions;
}

export function validateFlow(input: unknown): Omit<FlowDefinition, 'id'> {
  if (!input || typeof input !== 'object') throw new Error('FLOW_INVALID');
  const value = input as Partial<FlowDefinition>;
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 70 ||
      typeof value.icon !== 'string' || !value.icon.trim() || value.icon.length > 12 ||
      !Array.isArray(value.states) || value.states.length < 2 || value.states.length > 16) {
    throw new Error('FLOW_INVALID');
  }
  const ids = new Set<string>();
  const stages: FlowStage[] = value.states.map((stage) => {
    if (!stage || typeof stage.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(stage.id) ||
        ids.has(stage.id) || typeof stage.label !== 'string' || !stage.label.trim() ||
        stage.label.length > 60 || typeof stage.nextAction !== 'string' ||
        !stage.nextAction.trim() || stage.nextAction.length > 80) throw new Error('FLOW_INVALID');
    ids.add(stage.id);
    for (const minutes of [stage.durationMinutes, stage.remindAfterMinutes]) {
      if (minutes !== undefined && (!Number.isInteger(minutes) || minutes < 1 || minutes > 43200)) {
        throw new Error('FLOW_INVALID');
      }
    }
    if (stage.autoAdvance && !stage.durationMinutes) throw new Error('FLOW_INVALID');
    return {
      id: stage.id,
      label: stage.label.trim(),
      nextAction: stage.nextAction.trim(),
      ...(stage.durationMinutes ? { durationMinutes: stage.durationMinutes } : {}),
      ...(stage.remindAfterMinutes ? { remindAfterMinutes: stage.remindAfterMinutes } : {}),
      ...(stage.autoAdvance ? { autoAdvance: true } : {}),
      ...(stage.attention === 'soon' ? { attention: 'soon' as const } : {}),
    };
  });
  if (stages.every((stage) => stage.autoAdvance)) throw new Error('FLOW_INVALID');
  return { name: value.name.trim(), icon: value.icon.trim(), states: stages };
}
