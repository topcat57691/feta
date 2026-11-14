import type { FlowDefinition } from '../../app/types';

export const flowDefinitions: FlowDefinition[] = [
  {
    id: 'dishwasher',
    name: 'Dishwasher',
    icon: '🍽️',
    states: [
      { id: 'empty', label: 'Empty', nextAction: 'Started loading' },
      { id: 'filling', label: 'Filling', nextAction: 'Run dishwasher', attention: 'soon' },
      { id: 'running', label: 'Running', nextAction: 'Mark clean' },
      { id: 'clean', label: 'Clean', nextAction: 'Empty dishwasher', attention: 'now' },
    ],
  },
  {
    id: 'laundry',
    name: 'Laundry',
    icon: '🧺',
    states: [
      { id: 'clear', label: 'Clear', nextAction: 'Start wash' },
      { id: 'washing', label: 'Washing', nextAction: 'Wash finished' },
      { id: 'ready-to-dry', label: 'Ready to dry', nextAction: 'Start drying', attention: 'now' },
      { id: 'drying', label: 'Drying', nextAction: 'Drying finished' },
      { id: 'ready-to-put-away', label: 'Ready to put away', nextAction: 'Put away', attention: 'now' },
    ],
  },
];

export function getFlowDefinition(flowId: string): FlowDefinition {
  const flow = flowDefinitions.find((candidate) => candidate.id === flowId);
  if (!flow) throw new Error(`Unknown flow: ${flowId}`);
  return flow;
}

export function getFlowStateDefinition(flowId: string, stateId: string) {
  const flow = getFlowDefinition(flowId);
  return flow.states.find((state) => state.id === stateId) ?? flow.states[0];
}

export function nextFlowStateId(flowId: string, stateId: string): string {
  const flow = getFlowDefinition(flowId);
  const index = Math.max(0, flow.states.findIndex((state) => state.id === stateId));
  return flow.states[(index + 1) % flow.states.length].id;
}
