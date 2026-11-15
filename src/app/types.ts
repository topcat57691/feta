export type Availability = 'in-zone' | 'free' | 'drained' | 'out';
export type Presence = 'home' | 'out';
export type CadenceMode = 'auto' | 'manual';
export type CadencePeriod = 'day' | 'week' | 'month';
export type JobKind = 'session' | 'counted' | 'calendar';

export interface DailyChecks {
  date: string;
  sleptOkay: boolean;
  feelingOkay: boolean;
  vitamins: boolean;
}

export interface Person {
  id: string;
  name: string;
  color: string;
  availability: Availability;
  capacity: 1 | 2 | 3 | 4 | 5;
  presence: Presence;
  daily: DailyChecks;
  updatedAt: string;
}

export interface Cadence {
  rate: number;
  period: CadencePeriod;
  mode: CadenceMode;
  preferredDay?: number;
}

export interface JobDefinition {
  id: string;
  name: string;
  icon: string;
  kind: JobKind;
  enabled: boolean;
  unitLabel?: string;
  cadence: Cadence;
  calendarDay?: number;
  createdAt: string;
}

export interface JobEvent {
  id: string;
  jobId: string;
  personId: string;
  occurredAt: string;
  quantity: number;
  leftTooLong?: boolean;
}

export interface FlowDefinition {
  id: string;
  name: string;
  icon: string;
  states: Array<{
    id: string;
    label: string;
    nextAction: string;
    attention?: 'now' | 'soon';
  }>;
}

export interface FlowState {
  flowId: string;
  stateId: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface FlowEvent {
  id: string;
  flowId: string;
  fromStateId: string;
  toStateId: string;
  personId: string;
  occurredAt: string;
}

export interface HouseholdState {
  version: 1;
  householdId: string;
  householdName: string;
  adminPinSet: boolean;
  people: Person[];
  jobs: JobDefinition[];
  events: JobEvent[];
  flowStates: FlowState[];
  flowEvents: FlowEvent[];
}

export interface DeviceState {
  currentPersonId?: string;
}

export interface AttentionItem {
  id: string;
  kind: 'job' | 'flow';
  title: string;
  subtitle: string;
  icon: string;
  urgency: 'now' | 'soon';
  score: number;
  dueAt?: string;
}
