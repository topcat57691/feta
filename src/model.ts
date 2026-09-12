export const palette = {
  bg: '#F4F7F6', surface: '#FFFFFF', surfaceMuted: '#F7F9F8', ink: '#14243D', muted: '#64748B', line: '#E7ECEA',
  green: '#35B878', greenSoft: '#DCF6E9', blue: '#4E9EEB', blueSoft: '#E3F1FF', purple: '#8A70D6', purpleSoft: '#EEE7FB',
  amber: '#E9A23B', amberSoft: '#FFF0D8', coral: '#E96F75', coralSoft: '#FFE6E8', shadow: '#172033',
};

export type PersonStatus = 'in-zone' | 'free' | 'drained' | 'out';
export type HealthKey = 'sleptWell' | 'hydrated' | 'feelingOkay';
export type Priority = 'low' | 'medium' | 'high';
export type FlowId = 'dishwasher' | 'laundry' | 'kitchen';
export type FlowState = 'clear' | 'filling' | 'ready-to-run' | 'running' | 'clean-needs-emptying' | 'washing' | 'ready-to-dry' | 'drying' | 'ready-to-put-away' | 'needs-reset';

export interface Person {
  id: string; name: string; isActive: boolean; status: PersonStatus; energy: number; avatarColor: string;
  health: Record<HealthKey, boolean>;
}
export interface Habit { id: string; name: string; icon: string; }
export interface HouseholdFlow {
  id: FlowId; name: string; icon: string; state: FlowState; lastUpdatedAt?: string; lastUpdatedById?: string; lastCompletedAt?: string; lastCompletedById?: string;
}
export interface NextUpItem { id: string; title: string; priority: Priority; assigneeId?: string; createdAt: string; completedAt?: string; }
export interface FamilyState {
  people: Person[]; habits: Habit[]; habitCompletions: Record<string, Record<string, boolean>>; flows: HouseholdFlow[]; nextUp: NextUpItem[];
  currentPersonId?: string; dayKey: string;
}

export const statusMeta: Record<PersonStatus, { label: string; bg: string; fg: string }> = {
  'in-zone': { label: 'In the zone', bg: palette.purpleSoft, fg: '#654DB3' },
  free: { label: 'Free', bg: palette.greenSoft, fg: '#167A4B' },
  drained: { label: 'Drained', bg: '#F2E4F7', fg: '#7D4C96' },
  out: { label: 'Out', bg: '#ECEFF3', fg: '#5B6573' },
};
export const healthMeta: Record<HealthKey, { label: string; icon: string }> = {
  sleptWell: { label: 'Slept well', icon: '🛏️' }, hydrated: { label: 'Hydrated', icon: '💧' }, feelingOkay: { label: 'Feeling okay', icon: '🙂' },
};
export const defaultHabits: Habit[] = [
  { id: 'bed-made', name: 'Bed made', icon: '🛏️' }, { id: 'teeth', name: 'Teeth brushed', icon: '🪥' },
  { id: 'vitamins', name: 'Vitamins / meds', icon: '💊' }, { id: 'movement', name: 'Movement', icon: '🏃' },
];
export const defaultFlows: HouseholdFlow[] = [
  { id: 'dishwasher', name: 'Dishwasher', icon: '🍽️', state: 'clear' }, { id: 'laundry', name: 'Laundry', icon: '🧺', state: 'clear' },
  { id: 'kitchen', name: 'Kitchen', icon: '✨', state: 'clear' },
];
export const avatarColors = ['#BDE7D3', '#CFE5FA', '#E8D5F6', '#FFD9D4', '#F6E2B8', '#D8E1F7'];
export const flowSequences: Record<FlowId, FlowState[]> = {
  dishwasher: ['clear', 'filling', 'ready-to-run', 'running', 'clean-needs-emptying'],
  laundry: ['clear', 'washing', 'ready-to-dry', 'drying', 'ready-to-put-away'], kitchen: ['clear', 'needs-reset'],
};
const flowLabels: Partial<Record<FlowState, string>> = {
  clear: 'All clear', filling: 'Filling up', 'ready-to-run': 'Ready to run', running: 'Running', 'clean-needs-emptying': 'Clean — needs emptying',
  washing: 'Washing', 'ready-to-dry': 'Ready to dry', drying: 'Drying', 'ready-to-put-away': 'Ready to put away', 'needs-reset': 'Needs a quick reset',
};
const nextActions: Record<FlowId, Partial<Record<FlowState, string>>> = {
  dishwasher: { clear: 'Start loading', filling: 'Ready to run', 'ready-to-run': 'Start dishwasher', running: 'Cycle finished', 'clean-needs-emptying': 'Empty dishwasher' },
  laundry: { clear: 'Start a wash', washing: 'Wash finished', 'ready-to-dry': 'Move to dry', drying: 'Drying finished', 'ready-to-put-away': 'Put away' },
  kitchen: { clear: 'Dinner finished', 'needs-reset': 'Kitchen reset' },
};
export function getFlowPresentation(flow: HouseholdFlow) {
  const attention = flow.state === 'clean-needs-emptying' || flow.state === 'ready-to-dry' || flow.state === 'ready-to-put-away' || flow.state === 'needs-reset';
  const inProgress = flow.state !== 'clear';
  return { label: flowLabels[flow.state] ?? flow.state, action: nextActions[flow.id][flow.state] ?? 'Advance', attention, inProgress,
    tone: attention ? palette.amber : inProgress ? palette.blue : palette.green, softTone: attention ? palette.amberSoft : inProgress ? palette.blueSoft : palette.greenSoft };
}
export function nextFlowState(flow: HouseholdFlow): FlowState {
  const sequence = flowSequences[flow.id]; const index = sequence.indexOf(flow.state);
  if (index < 0 || index === sequence.length - 1) return 'clear';
  return sequence[index + 1] ?? 'clear';
}
export function todayKey(date = new Date()) {
  const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || '?';
}
export function formatRelativeTime(value?: string) {
  if (!value) return 'Not yet'; const elapsed = Math.max(0, Date.now() - new Date(value).getTime()); const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return 'just now'; if (minutes < 60) return `${minutes}m ago`; const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`; return `${Math.floor(hours / 24)}d ago`;
}
export function agePercent(value: string | undefined, targetHours: number) {
  if (!value) return 0; const hours = Math.max(0, Date.now() - new Date(value).getTime()) / 3600000;
  return Math.max(6, Math.min(100, (hours / targetHours) * 100));
}
