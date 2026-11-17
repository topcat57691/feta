import { describe, expect, it } from 'vitest';
import type { CalendarEvent, HouseholdState } from '../../app/types';
import {
  buildDiaryWindow,
  buildRhythmMoments,
  calendarDayKey,
  dayDistance,
  diaryTier,
  nextDiaryEvents,
} from './previewModel';

const now = new Date('2026-11-17T12:00:00.000Z');
const timed = (day: number, hour: number, id: string): CalendarEvent => {
  const start = new Date(Date.UTC(2026, 10, day, hour));
  return {
    calendarId: 'family', eventId: id, title: id, calendarName: 'Family',
    startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3600_000).toISOString(),
    allDay: false,
  };
};

describe('preview diary windows', () => {
  it('renders exactly five event slots and equal-sized groups for the same date', () => {
    const events = [
      timed(20, 17, 'sixth'), timed(18, 16, 'second'),
      timed(20, 9, 'fifth'), timed(19, 8, 'third'),
      timed(18, 8, 'first'), timed(19, 18, 'fourth'),
      timed(22, 12, 'seventh'),
    ];
    const window = buildDiaryWindow(events, now, 0, 5);
    expect(window.shown).toBe(5);
    expect(window.total).toBe(7);
    expect(window.groups.map((day) => day.events.map((event) => event.eventId))).toEqual([
      ['first', 'second'], ['third', 'fourth'], ['fifth'],
    ]);
    expect(window.groups.map((day) => day.tier)).toEqual(['near', 'next', 'next']);
    expect(window.remaining).toBe(2);
    expect(window.hiddenOnNextDay).toBe(1);
    expect(window.nextDay).toBe('2026-11-20');
  });

  it('paginates remaining events in order instead of moving important events forward', () => {
    const events = [timed(18, 8, 'one'), timed(18, 9, 'two'),
      timed(19, 10, 'three'), timed(20, 11, 'four'), timed(21, 12, 'five')];
    const first = buildDiaryWindow(events, now, 0, 3);
    const later = buildDiaryWindow(events, now, 3, 3);
    expect(first.groups.flatMap((day) => day.events.map((event) => event.eventId)))
      .toEqual(['one', 'two', 'three']);
    expect(later.groups.flatMap((day) => day.events.map((event) => event.eventId)))
      .toEqual(['four', 'five']);
    expect(later.remaining).toBe(0);
  });

  it('keeps all-day events on their Google date', () => {
    const event: CalendarEvent = {
      ...timed(18, 0, 'all-day'), allDay: true,
      startsAt: '2026-11-18T00:00:00.000Z',
      endsAt: '2026-11-19T00:00:00.000Z',
    };
    expect(calendarDayKey(event)).toBe('2026-11-18');
  });

  it('uses calendar-day distance across daylight-saving boundaries', () => {
    expect(dayDistance('2026-03-30', new Date('2026-03-29T12:00:00Z'))).toBe(1);
    expect(dayDistance('2026-11-20', now)).toBe(3);
    expect(diaryTier('2026-11-18', now)).toBe('near');
    expect(diaryTier('2026-11-20', now)).toBe('next');
    expect(diaryTier('2026-11-21', now)).toBe('later');
  });

  it('hides past events while preserving an ongoing appointment', () => {
    const ongoing = timed(17, 11, 'ongoing');
    const past = timed(17, 9, 'past');
    const far = timed(31, 10, 'far');
    const listed = nextDiaryEvents([far, past, ongoing], now, 7);
    expect(listed.map((event) => event.eventId)).toEqual(['ongoing']);
  });
});

describe('preview household rhythm', () => {
  it('orders recent activity and near-term upcoming laundry cycles independently', () => {
    const old = new Date(now.getTime() - 75 * 60_000).toISOString();
    const state = {
      jobs: [], events: [], flowEvents: [],
      flows: [{ id: 'laundry', name: 'Laundry', icon: '🧺',
        states: [{ id: 'washing', label: 'Washing', nextAction: 'Complete', durationMinutes: 180 }] }],
      flowStates: [],
      flowInstances: [{ id: 'wash1', flowId: 'laundry', name: 'Clothes',
        stateId: 'washing', createdAt: old, updatedAt: old }],
      flowInstanceEvents: [{ id: 'moved', instanceId: 'wash2', flowId: 'laundry', instanceName: 'Towels',
        fromStateId: 'washing', toStateId: 'wet', occurredAt: old, automatic: false }],
    } as HouseholdState;
    const rhythm = buildRhythmMoments(state, now);
    expect(rhythm.recent.map((moment) => moment.label)).toEqual(['Towels']);
    expect(rhythm.next.map((moment) => moment.label)).toEqual(['Clothes']);
    expect(rhythm.next[0].at).toBe(new Date(old).getTime() + 180 * 60_000);
  });
});
