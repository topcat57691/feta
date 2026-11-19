import type { CalendarEvent, HouseholdState } from '../../app/types';

export interface PreviewTodo {
  id: string;
  title: string;
  createdAt: string;
  completedAt?: string;
}
export type CalendarMarks = Record<string, string>;
export interface PreviewData {
  todos: PreviewTodo[];
  calendarMarks: CalendarMarks;
}
export interface HistoryItem {
  id: string;
  title: string;
  detail: string;
  kind: 'todo' | 'calendar' | 'household';
  at: string;
  undo?: { kind: 'todo' | 'calendar'; id: string };
}

export const calendarKey = (event: CalendarEvent) => JSON.stringify([event.calendarId, event.eventId]);
export const activeTodos = (todos: PreviewTodo[]) => todos.filter((todo) => !todo.completedAt);
export const activeCalendar = (events: CalendarEvent[], marks: CalendarMarks) =>
  events.filter((event) => !event.completedAt && !marks[calendarKey(event)]);

export function buildPreviewHistory(state: HouseholdState, data: PreviewData, now: Date): HistoryItem[] {
  const rows: HistoryItem[] = [];
  for (const todo of data.todos) {
    if (todo.completedAt) rows.push({
      id: 'todo-' + todo.id, title: todo.title, detail: 'To-do · Completed',
      kind: 'todo', at: todo.completedAt, undo: { kind: 'todo', id: todo.id },
    });
  }
  for (const event of state.calendarEvents ?? []) {
    const key = calendarKey(event);
    const marked = data.calendarMarks[key];
    const past = new Date(event.endsAt).getTime() <= now.getTime();
    const at = event.completedAt || marked || (past ? event.endsAt : undefined);
    if (at) rows.push({
      id: 'calendar-' + key, title: event.title,
      detail: event.calendarName + (event.completedAt || marked ? ' · Marked done' : ' · Event ended'),
      kind: 'calendar', at,
      undo: marked && !event.completedAt && !past ? { kind: 'calendar', id: key } : undefined,
    });
  }
  for (const event of state.events) {
    const job = state.jobs.find((item) => item.id === event.jobId);
    const person = state.people.find((item) => item.id === event.personId);
    rows.push({ id: 'job-' + event.id, title: job?.name ?? 'Household activity',
      detail: 'Completed' + (person ? ' · ' + person.name : ''), kind: 'household', at: event.occurredAt });
  }
  for (const event of state.flowEvents) {
    const flow = state.flows.find((item) => item.id === event.flowId);
    const stage = flow?.states.find((item) => item.id === event.toStateId);
    rows.push({ id: 'flow-' + event.id, title: flow?.name ?? 'Household cycle',
      detail: stage?.label ?? 'State changed', kind: 'household', at: event.occurredAt });
  }
  for (const load of state.flowInstances ?? []) {
    if (load.completedAt) rows.push({ id: 'load-done-' + load.id, title: load.name,
      detail: 'Laundry · Completed', kind: 'household', at: load.completedAt });
  }
  for (const event of state.flowInstanceEvents ?? []) {
    if (state.flowInstances?.some((load) => load.id === event.instanceId && load.completedAt === event.occurredAt)) continue;
    const flow = state.flows.find((item) => item.id === event.flowId);
    const stage = flow?.states.find((item) => item.id === event.toStateId);
    rows.push({ id: 'load-' + event.id, title: event.instanceName,
      detail: stage?.label ?? 'Laundry · State changed', kind: 'household', at: event.occurredAt });
  }
  return rows.filter((row) => Number.isFinite(Date.parse(row.at)) && Date.parse(row.at) <= now.getTime())
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || a.id.localeCompare(b.id));
}
