import { describe, expect, it } from 'vitest';
import type { CalendarEvent, HouseholdState } from '../../app/types';
import { activeCalendar, activeTodos, buildPreviewHistory, calendarKey, type PreviewData } from './previewTasks';

const now = new Date('2026-11-19T12:00:00Z');
const earlier = '2026-11-18T12:00:00Z';
const event = (id: string, endsAt: string): CalendarEvent => ({
  calendarId: 'family', eventId: id, title: id, calendarName: 'Family',
  startsAt: earlier, endsAt, allDay: false,
});
const future = event('future', '2026-11-20T12:00:00Z');
const past = event('past', earlier);
const marked = event('marked', future.endsAt);
const done = { ...event('done', future.endsAt), completedAt: earlier };
const state: HouseholdState = {
  version: 1, householdId: 'test', householdName: 'Test', adminPinSet: true,
  people: [], jobs: [], events: [], flows: [], flowStates: [], flowEvents: [],
  flowInstances: [{ id: 'load', flowId: 'laundry', name: 'Towels', stateId: 'clear', createdAt: earlier, updatedAt: earlier, completedAt: earlier }],
  flowInstanceEvents: [], calendarEvents: [past, future, marked, done],
};
const data: PreviewData = { calendarMarks: { [calendarKey(marked)]: earlier }, todos: [
  { id: 'open', title: 'Phone garage', createdAt: earlier },
  { id: 'done', title: 'Collect photos', createdAt: earlier, completedAt: earlier },
] };

describe('preview forward-looking dashboard', () => {
  it('keeps unfinished to-dos irrespective of creation date', () => {
    expect(activeTodos(data.todos).map((todo) => todo.id)).toEqual(['open']);
  });
  it('excludes saved and preview calendar completions', () => {
    expect(activeCalendar(state.calendarEvents, data.calendarMarks).map((item) => item.eventId)).toEqual(['past', 'future']);
  });
  it('combines completed to-dos, past/checked calendar events and completed loads in history', () => {
    const rows = buildPreviewHistory(state, data, now);
    expect(rows.map((row) => row.title).sort()).toEqual(['Collect photos', 'Towels', 'done', 'marked', 'past']);
    expect(rows.find((row) => row.title === 'past')?.detail).toContain('Event ended');
    expect(rows.find((row) => row.title === 'marked')?.undo).toEqual({ kind: 'calendar', id: calendarKey(marked) });
    expect(rows.find((row) => row.title === 'done')?.undo).toBeUndefined();
    expect(rows.find((row) => row.title === 'Collect photos')?.undo).toEqual({ kind: 'todo', id: 'done' });
  });
});
