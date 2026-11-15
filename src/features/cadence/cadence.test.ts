import { describe, expect, it } from 'vitest';
import type { JobDefinition, JobEvent } from '../../app/types';
import { calculateJobPressure, learnCountedCadence, learnSessionCadence } from './cadence';

const sessionJob: JobDefinition = {
  id: 'garden', name: 'Garden', icon: '🌿', kind: 'session', enabled: true,
  cadence: { rate: 1, period: 'week', mode: 'auto' }, createdAt: '2026-01-01T00:00:00Z',
};

function event(id: string, occurredAt: string, leftTooLong = false): JobEvent {
  return { id, jobId: 'garden', personId: 'p1', occurredAt, quantity: 1, leftTooLong };
}

describe('cadence learning', () => {
  it('ignores a session interval marked left too long', () => {
    const cadence = learnSessionCadence(sessionJob, [
      event('1', '2026-09-01T10:00:00Z'),
      event('2', '2026-09-08T10:00:00Z'),
      event('3', '2026-10-06T10:00:00Z', true),
      event('4', '2026-10-13T10:00:00Z'),
    ]);
    expect(cadence.rate).toBeGreaterThan(0.8);
    expect(cadence.rate).toBeLessThan(1.3);
  });

  it('learns counted work as a rate in the configured period', () => {
    const job: JobDefinition = { ...sessionJob, id: 'washing', kind: 'counted', unitLabel: 'loads', cadence: { rate: 7, period: 'week', mode: 'auto' } };
    const events: JobEvent[] = Array.from({ length: 14 }, (_, index) => ({
      id: String(index), jobId: 'washing', personId: 'p1', quantity: 2,
      occurredAt: new Date(Date.UTC(2026, 9, 25 + index)).toISOString(),
    }));
    const learned = learnCountedCadence(job, events, new Date('2026-11-14T12:00:00Z'));
    expect(learned.rate).toBeGreaterThan(7);
  });

  it('turns session age into gentle pressure rather than an overdue flag', () => {
    const pressure = calculateJobPressure(sessionJob, [event('1', '2026-11-07T12:00:00Z')], new Date('2026-11-14T12:00:00Z'));
    expect(pressure.urgency).toBe('now');
    expect(pressure.score).toBeCloseTo(1, 1);
  });

  it('moves a calendar job to next week after it is completed today', () => {
    const calendarJob: JobDefinition = {
      ...sessionJob,
      id: 'bins',
      kind: 'calendar',
      calendarDay: 0,
      cadence: { rate: 1, period: 'week', mode: 'manual' },
    };
    const now = new Date('2026-11-15T12:00:00');
    const completed: JobEvent = {
      id: 'bins-done',
      jobId: 'bins',
      personId: 'p1',
      quantity: 1,
      occurredAt: new Date('2026-11-15T09:00:00').toISOString(),
    };
    const pressure = calculateJobPressure(calendarJob, [completed], now);
    expect(pressure.urgency).toBe('calm');
    expect(pressure.dueAt?.getDate()).toBe(22);
  });
});
