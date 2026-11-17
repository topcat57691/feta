import type { CalendarEvent, HouseholdState } from '../../app/types';
import { calculateJobPressure } from '../cadence/cadence';
import { flowTiming, getFlowStateDefinition } from '../flows/flowDefinitions';
import { laundryStates, laundryTiming, isLaundryState } from '../laundry/laundry';
import { todayKey, DAY_MS } from '../../lib/date';

export type DiaryTier = 'near' | 'next' | 'later';

export interface DiaryGroup {
  key: string;
  label: string;
  tier: DiaryTier;
  events: CalendarEvent[];
}
export interface DiaryWindow {
  groups: DiaryGroup[];
  total: number;
  shown: number;
  start: number;
  remaining: number;
  nextDay?: string;
  hiddenOnNextDay: number;
}

export interface RhythmTile {
  id: string;
  icon: string;
  title: string;
  state: string;
  detail: string;
  attention: boolean;
}
export interface RhythmMoment {
  id: string;
  at: number;
  icon: string;
  label: string;
  detail: string;
}

export function calendarDayKey(event: CalendarEvent): string {
  if (event.allDay) return event.startsAt.slice(0, 10);
  return todayKey(new Date(event.startsAt));
}

export function dayDistance(key: string, now: Date): number {
  // Compare calendar dates (not elapsed milliseconds) so DST changes don't shift tiers.
  const ordinal = (date: string) => {
    const [year, month, day] = date.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((ordinal(key) - ordinal(todayKey(now))) / DAY_MS);
}

export function diaryDayLabel(key: string, now: Date): string {
  const days = dayDistance(key, now);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    weekday: 'long', timeZone: 'UTC',
  });
}

export function diaryTier(key: string, now: Date): DiaryTier {
  const days = dayDistance(key, now);
  return days <= 1 ? 'near' : days <= 3 ? 'next' : 'later';
}

export function nextDiaryEvents(events: CalendarEvent[], now: Date, horizonDays = 21): CalendarEvent[] {
  return events
    .filter((event) => {
      const start = new Date(event.startsAt).getTime();
      const end = new Date(event.endsAt).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
      const days = dayDistance(calendarDayKey(event), now);
      // Include ongoing events from today, but not things that have already ended.
      return days >= 0 && days <= horizonDays && end > now.getTime();
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
      || a.calendarId.localeCompare(b.calendarId) || a.eventId.localeCompare(b.eventId));
}

export function buildDiaryWindow(events: CalendarEvent[], now: Date, start: number, count: number): DiaryWindow {
  const ordered = nextDiaryEvents(events, now);
  const safeCount = Math.max(1, Math.floor(count));
  const offset = Math.max(0, Math.min(Math.floor(start), Math.max(0, ordered.length - 1)));
  const visible = ordered.slice(offset, offset + safeCount);
  const groups: DiaryGroup[] = [];
  for (const event of visible) {
    const key = calendarDayKey(event);
    const previous = groups[groups.length - 1];
    if (previous && previous.key === key) previous.events.push(event);
    else groups.push({ key, label: diaryDayLabel(key, now), tier: diaryTier(key, now), events: [event] });
  }
  const later = ordered.slice(offset + visible.length);
  const nextDay = later.length ? calendarDayKey(later[0]) : undefined;
  return {
    groups, total: ordered.length, shown: visible.length, start: offset,
    remaining: later.length, nextDay,
    hiddenOnNextDay: nextDay ? later.filter((event) => calendarDayKey(event) === nextDay).length : 0,
  };
}

function timeNote(minutes: number | null, reminder: boolean, elapsedMinutes: number): string {
  if (reminder) return 'Worth a gentle nudge';
  if (minutes !== null) return minutes ? minutes + 'm remaining' : 'Due now';
  return elapsedMinutes < 60 ? elapsedMinutes + 'm in this state' : Math.floor(elapsedMinutes / 60) + 'h in this state';
}

export function buildRhythmTiles(state: HouseholdState, now: Date): RhythmTile[] {
  const tiles: RhythmTile[] = [];
  for (const flowState of state.flowStates) {
    if (flowState.flowId === 'laundry') continue;
    const flow = state.flows.find((candidate) => candidate.id === flowState.flowId);
    if (!flow) continue;
    const timing = flowTiming(flow, flowState, now);
    tiles.push({
      id: 'flow-' + flow.id, icon: flow.icon, title: flow.name, state: timing.stage.label,
      detail: timeNote(timing.remainingMinutes ?? timing.reminderMinutes, timing.reminderDue, timing.elapsedMinutes),
      attention: timing.reminderDue || Boolean(timing.stage.attention),
    });
  }
  const laundry = state.flows.find((flow) => flow.id === 'laundry');
  for (const load of state.flowInstances ?? []) {
    if (load.flowId !== 'laundry' || load.completedAt || !isLaundryState(load.stateId)) continue;
    const timing = laundryTiming(load, laundry, now);
    tiles.push({
      id: 'load-' + load.id, icon: laundryStates[load.stateId].icon,
      title: load.name, state: laundryStates[load.stateId].label,
      detail: timeNote(timing.remainingMinutes ?? timing.reminderMinutes, timing.reminderDue, timing.elapsedMinutes),
      attention: timing.reminderDue || load.stateId === 'wash-complete' || load.stateId === 'dryer-complete',
    });
  }
  const urgentJobs = state.jobs.filter((job) => job.enabled)
    .map((job) => ({ job, pressure: calculateJobPressure(job, state.events, now) }))
    .filter(({ pressure }) => pressure.urgency === 'now').slice(0, 2);
  for (const { job, pressure } of urgentJobs) {
    tiles.push({
      id: 'job-' + job.id, icon: job.icon, title: job.name,
      state: 'Useful now', detail: pressure.subtitle, attention: true,
    });
  }
  return tiles;
}

export function buildRhythmMoments(state: HouseholdState, now: Date): { recent: RhythmMoment[]; next: RhythmMoment[] } {
  const nowMs = now.getTime();
  const recent: RhythmMoment[] = [];
  for (const event of state.events) {
    const at = new Date(event.occurredAt).getTime();
    const job = state.jobs.find((item) => item.id === event.jobId);
    if (job && at <= nowMs && at >= nowMs - 3 * 3600_000) {
      recent.push({ id: 'job-' + event.id, at, icon: job.icon, label: job.name, detail: 'Done' });
    }
  }
  for (const event of state.flowEvents) {
    const at = new Date(event.occurredAt).getTime();
    const flow = state.flows.find((item) => item.id === event.flowId);
    if (flow && at <= nowMs && at >= nowMs - 3 * 3600_000) {
      recent.push({ id: 'flow-' + event.id, at, icon: flow.icon, label: flow.name, detail: 'State changed' });
    }
  }
  for (const event of state.flowInstanceEvents ?? []) {
    const at = new Date(event.occurredAt).getTime();
    if (at <= nowMs && at >= nowMs - 3 * 3600_000) {
      recent.push({ id: 'load-' + event.id, at, icon: '🧺', label: event.instanceName, detail: 'Load moved' });
    }
  }
  const next: RhythmMoment[] = [];
  const pushNext = (moment: RhythmMoment) => {
    if (Number.isFinite(moment.at) && moment.at >= nowMs && moment.at <= nowMs + 12 * 3600_000) next.push(moment);
  };
  for (const current of state.flowStates) {
    if (current.flowId === 'laundry') continue;
    const flow = state.flows.find((item) => item.id === current.flowId);
    if (!flow) continue;
    const stage = getFlowStateDefinition(flow, current.stateId);
    const minutes = stage.durationMinutes ?? stage.remindAfterMinutes;
    if (minutes) pushNext({
      id: 'flow-' + flow.id, at: new Date(current.updatedAt).getTime() + minutes * 60_000,
      icon: flow.icon, label: flow.name,
      detail: stage.durationMinutes ? 'Cycle expected to finish' : 'Gentle reminder',
    });
  }
  const laundry = state.flows.find((item) => item.id === 'laundry');
  for (const load of state.flowInstances ?? []) {
    if (load.flowId !== 'laundry' || load.completedAt || !isLaundryState(load.stateId)) continue;
    const timing = laundryTiming(load, laundry, now);
    const minutes = timing.remainingMinutes ?? timing.reminderMinutes;
    if (minutes !== null && !timing.reminderDue && minutes > 0) pushNext({
      id: 'load-' + load.id, at: nowMs + minutes * 60_000,
      icon: '🧺', label: load.name,
      detail: timing.remainingMinutes !== null ? 'Cycle expected to finish' : 'Gentle reminder',
    });
  }
  for (const job of state.jobs.filter((item) => item.enabled)) {
    const pressure = calculateJobPressure(job, state.events, now);
    const at = pressure.dueAt?.getTime();
    if (at !== undefined) pushNext({ id: 'job-' + job.id, at, icon: job.icon, label: job.name, detail: 'Estimated due' });
  }
  return {
    recent: recent.sort((a, b) => b.at - a.at).slice(0, 3),
    next: next.sort((a, b) => a.at - b.at).slice(0, 4),
  };
}
