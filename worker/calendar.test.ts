import { describe, expect, it } from 'vitest';
import { normaliseGoogleEvent } from './calendar';

describe('Google Calendar event mapping', () => {
  it('normalises timezone offsets to UTC', () => {
    expect(normaliseGoogleEvent({
      id: 'event-1', summary: 'Swimming',
      start: { dateTime: '2026-07-01T16:30:00+01:00' },
      end: { dateTime: '2026-07-01T17:30:00+01:00' },
    })).toEqual({
      id: 'event-1', title: 'Swimming',
      start: '2026-07-01T15:30:00.000Z',
      end: '2026-07-01T16:30:00.000Z',
      allDay: false,
    });
  });

  it('keeps all-day dates stable across device time zones', () => {
    expect(normaliseGoogleEvent({
      id: 'birthday', summary: 'Birthday',
      start: { date: '2026-08-16' }, end: { date: '2026-08-17' },
    })).toMatchObject({
      start: '2026-08-16T00:00:00.000Z',
      end: '2026-08-17T00:00:00.000Z',
      allDay: true,
    });
  });

  it('masks titles marked private by Google', () => {
    expect(normaliseGoogleEvent({
      id: 'private-1', summary: 'Confidential appointment',
      visibility: 'private',
      start: { dateTime: '2026-11-17T10:00:00Z' },
      end: { dateTime: '2026-11-17T11:00:00Z' },
    })?.title).toBe('Busy (private event)');
  });

  it('preserves occurrence-specific IDs for recurring events', () => {
    const item = {
      summary: 'Daily medication',
      recurringEventId: 'daily-meds',
      start: { dateTime: '2026-11-17T08:00:00Z' },
      end: { dateTime: '2026-11-17T08:15:00Z' },
    };
    expect(normaliseGoogleEvent({ ...item, id: 'daily-meds_20261117' })?.id)
      .not.toBe(normaliseGoogleEvent({ ...item, id: 'daily-meds_20261118' })?.id);
  });

  it('does not store cancelled or malformed events', () => {
    const start = { dateTime: '2026-11-17T08:00:00Z' };
    const end = { dateTime: '2026-11-17T08:15:00Z' };
    expect(normaliseGoogleEvent({ id: 'removed', status: 'cancelled', start, end })).toBeNull();
    expect(normaliseGoogleEvent({ id: 'bad', start: { dateTime: 'invalid' }, end })).toBeNull();
    expect(normaliseGoogleEvent({ id: 'missing', start })).toBeNull();
  });
});
