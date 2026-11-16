import type { FlowDefinition, FlowInstance } from '../../app/types';

export type LaundryState =
  | 'waiting' | 'washing' | 'wash-complete' | 'wet' | 'drying'
  | 'dryer-complete' | 'air-drying' | 'ready-to-put-away';
export type LaundryAction =
  | 'start-wash' | 'finish-wash' | 'unload-wet' | 'transfer-to-dryer'
  | 'start-dryer' | 'air-dry' | 'finish-dry' | 'unload-dryer'
  | 'finish-air' | 'put-away';

export const laundryStates: Record<LaundryState, { label: string; icon: string }> = {
  waiting: { label: 'Waiting to wash', icon: '🧺' },
  washing: { label: 'Washing', icon: '🫧' },
  'wash-complete': { label: 'Washed · in machine', icon: '💧' },
  wet: { label: 'Wet · waiting to dry', icon: '💧' },
  drying: { label: 'Tumble drying', icon: '🌬️' },
  'dryer-complete': { label: 'Dry · in tumble dryer', icon: '👕' },
  'air-drying': { label: 'Air drying', icon: '🌤️' },
  'ready-to-put-away': { label: 'Ready to put away', icon: '👕' },
};

export const laundryTransitions: Record<LaundryState, { action: LaundryAction; label: string; to: LaundryState | 'done' }[]> = {
  waiting: [{ action: 'start-wash', label: 'Start wash', to: 'washing' }],
  washing: [{ action: 'finish-wash', label: 'Wash finished', to: 'wash-complete' }],
  'wash-complete': [
    { action: 'unload-wet', label: 'Take out · keep wet', to: 'wet' },
    { action: 'transfer-to-dryer', label: 'Move to tumble dryer', to: 'drying' },
    { action: 'air-dry', label: 'Hang to dry', to: 'air-drying' },
  ],
  wet: [
    { action: 'start-dryer', label: 'Start tumble dryer', to: 'drying' },
    { action: 'air-dry', label: 'Hang to dry', to: 'air-drying' },
  ],
  drying: [{ action: 'finish-dry', label: 'Dryer finished', to: 'dryer-complete' }],
  'dryer-complete': [{ action: 'unload-dryer', label: 'Unload dryer', to: 'ready-to-put-away' }],
  'air-drying': [{ action: 'finish-air', label: 'Mark dry', to: 'ready-to-put-away' }],
  'ready-to-put-away': [{ action: 'put-away', label: 'Put away', to: 'done' }],
};

export function isLaundryState(value: string): value is LaundryState {
  return Object.prototype.hasOwnProperty.call(laundryStates, value);
}

export function laundryNextState(state: LaundryState, action: LaundryAction): LaundryState | 'done' | null {
  return laundryTransitions[state].find((choice) => choice.action === action)?.to ?? null;
}

export type LaundryAppliance = 'washer' | 'dryer';
export function occupiedAppliance(state: LaundryState): LaundryAppliance | null {
  if (state === 'washing' || state === 'wash-complete') return 'washer';
  if (state === 'drying' || state === 'dryer-complete') return 'dryer';
  return null;
}

export function laundryTiming(
  load: Pick<FlowInstance, 'stateId' | 'updatedAt'>,
  flow: FlowDefinition | undefined,
  now = new Date(),
): { remainingMinutes: number | null; reminderDue: boolean; reminderMinutes: number | null; elapsedMinutes: number } {
  const elapsed = Math.max(0, now.getTime() - new Date(load.updatedAt).getTime());
  const stage = load.stateId;
  const config = (id: string) => flow?.states.find((item) => item.id === id);
  const duration = stage === 'washing' ? config('washing')?.durationMinutes ?? 180
    : stage === 'drying' ? config('drying')?.durationMinutes ?? 90 : null;
  const reminder = stage === 'wash-complete' || stage === 'wet'
    ? config('ready-to-dry')?.remindAfterMinutes ?? 360
    : stage === 'dryer-complete' || stage === 'ready-to-put-away'
      ? config('ready-to-put-away')?.remindAfterMinutes ?? 720 : null;
  return {
    remainingMinutes: duration === null ? null : Math.max(0, Math.ceil((duration * 60_000 - elapsed) / 60_000)),
    reminderDue: reminder !== null && elapsed >= reminder * 60_000,
    reminderMinutes: reminder === null ? null : Math.max(0, Math.ceil((reminder * 60_000 - elapsed) / 60_000)),
    elapsedMinutes: Math.floor(elapsed / 60_000),
  };
}

export function laundryAutoTransition(
  load: Pick<FlowInstance, 'stateId' | 'updatedAt'>,
  flow: FlowDefinition | undefined,
  now = new Date(),
): { to: LaundryState; occurredAt: string } | null {
  if (load.stateId !== 'washing' && load.stateId !== 'drying') return null;
  const stage = flow?.states.find((item) => item.id === load.stateId);
  if (stage && !stage.autoAdvance) return null;
  const minutes = stage?.durationMinutes ?? (load.stateId === 'washing' ? 180 : 90);
  const due = new Date(load.updatedAt).getTime() + minutes * 60_000;
  if (!Number.isFinite(due) || due > now.getTime()) return null;
  return {
    to: load.stateId === 'washing' ? 'wash-complete' : 'dryer-complete',
    occurredAt: new Date(due).toISOString(),
  };
}

export function laundryStats(loads: FlowInstance[]) {
  const active = loads.filter((load) => load.flowId === 'laundry' && !load.completedAt);
  return {
    total: active.length,
    waiting: active.filter((load) => load.stateId === 'waiting').length,
    wet: active.filter((load) => load.stateId === 'wet' || load.stateId === 'wash-complete').length,
    ready: active.filter((load) => load.stateId === 'ready-to-put-away' || load.stateId === 'dryer-complete').length,
    washing: active.find((load) => load.stateId === 'washing' || load.stateId === 'wash-complete'),
    drying: active.find((load) => load.stateId === 'drying' || load.stateId === 'dryer-complete'),
    airDrying: active.filter((load) => load.stateId === 'air-drying').length,
  };
}
