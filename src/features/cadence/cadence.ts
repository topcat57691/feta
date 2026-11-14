import type { AttentionItem, JobDefinition, JobEvent } from '../../app/types';
import { cadencePeriodDays, DAY_MS, nextWeekday } from '../../lib/date';

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function roundRate(value: number): number {
  if (value >= 10) return Math.round(value);
  if (value >= 2) return Math.round(value * 2) / 2;
  return Math.round(value * 10) / 10;
}

export function learnSessionCadence(job: JobDefinition, events: JobEvent[]): JobDefinition['cadence'] {
  if (job.cadence.mode !== 'auto') return job.cadence;
  const relevant = events
    .filter((event) => event.jobId === job.id)
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
  if (relevant.length < 3) return job.cadence;

  const intervals: number[] = [];
  for (let index = 1; index < relevant.length; index += 1) {
    if (relevant[index].leftTooLong) continue;
    const days = (new Date(relevant[index].occurredAt).getTime() - new Date(relevant[index - 1].occurredAt).getTime()) / DAY_MS;
    if (days > 0.2 && days < 366) intervals.push(days);
  }
  if (intervals.length < 2) return job.cadence;

  const observedInterval = median(intervals.slice(-8));
  const periodDays = cadencePeriodDays(job.cadence.period);
  const existingInterval = periodDays / Math.max(job.cadence.rate, 0.05);
  const smoothedInterval = existingInterval * 0.65 + observedInterval * 0.35;
  return { ...job.cadence, rate: roundRate(periodDays / smoothedInterval) };
}

export function learnCountedCadence(job: JobDefinition, events: JobEvent[], now = new Date()): JobDefinition['cadence'] {
  if (job.cadence.mode !== 'auto') return job.cadence;
  const cutoff = now.getTime() - 42 * DAY_MS;
  const relevant = events.filter((event) => event.jobId === job.id && new Date(event.occurredAt).getTime() >= cutoff);
  if (relevant.length < 3) return job.cadence;
  const firstAt = Math.min(...relevant.map((event) => new Date(event.occurredAt).getTime()));
  const observedDays = Math.max(7, (now.getTime() - firstAt) / DAY_MS);
  const quantity = relevant.reduce((sum, event) => sum + event.quantity, 0);
  const observedRate = (quantity / observedDays) * cadencePeriodDays(job.cadence.period);
  const smoothed = job.cadence.rate * 0.7 + observedRate * 0.3;
  return { ...job.cadence, rate: Math.max(0.1, roundRate(smoothed)) };
}

export function learnCadence(job: JobDefinition, events: JobEvent[], now = new Date()): JobDefinition['cadence'] {
  if (job.kind === 'session') return learnSessionCadence(job, events);
  if (job.kind === 'counted') return learnCountedCadence(job, events, now);
  return job.cadence;
}

export interface JobPressure {
  score: number;
  urgency: 'calm' | 'soon' | 'now';
  dueAt?: Date;
  subtitle: string;
}

export function calculateJobPressure(job: JobDefinition, events: JobEvent[], now = new Date()): JobPressure {
  const relevant = events
    .filter((event) => event.jobId === job.id)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  if (job.kind === 'calendar') {
    const dueAt = nextWeekday(job.calendarDay ?? 3, now);
    const days = Math.max(0, (dueAt.getTime() - now.getTime()) / DAY_MS);
    const score = days <= 0.25 ? 1.1 : days <= 1.5 ? 0.82 : Math.max(0.05, 0.55 - days * 0.08);
    return {
      score,
      urgency: score >= 1 ? 'now' : score >= 0.72 ? 'soon' : 'calm',
      dueAt,
      subtitle: dueAt.toLocaleDateString(undefined, { weekday: 'long' }),
    };
  }

  if (job.kind === 'session') {
    const intervalDays = cadencePeriodDays(job.cadence.period) / Math.max(job.cadence.rate, 0.05);
    const last = relevant[0];
    if (!last) return { score: 1, urgency: 'now', subtitle: 'Not done yet' };
    const ageDays = Math.max(0, (now.getTime() - new Date(last.occurredAt).getTime()) / DAY_MS);
    const score = ageDays / intervalDays;
    const dueAt = new Date(new Date(last.occurredAt).getTime() + intervalDays * DAY_MS);
    return {
      score,
      urgency: score >= 1 ? 'now' : score >= 0.72 ? 'soon' : 'calm',
      dueAt,
      subtitle: score < 0.72 ? 'Fine' : score >= 1 ? 'Useful now' : 'Starting to be useful',
    };
  }

  const periodDays = cadencePeriodDays(job.cadence.period);
  const windowStart = now.getTime() - periodDays * DAY_MS;
  const completed = relevant
    .filter((event) => new Date(event.occurredAt).getTime() >= windowStart)
    .reduce((sum, event) => sum + event.quantity, 0);
  const remaining = Math.max(0, job.cadence.rate - completed);
  let score = remaining <= 0 ? 0.15 : Math.min(1.3, remaining / Math.max(1, job.cadence.rate) + 0.45);

  if (job.cadence.preferredDay !== undefined) {
    const preferred = nextWeekday(job.cadence.preferredDay, now);
    const daysUntil = (preferred.getTime() - now.getTime()) / DAY_MS;
    if (daysUntil > 2) score *= 0.45;
    else if (daysUntil > 0.5) score *= 0.75;
  }

  return {
    score,
    urgency: score >= 0.95 ? 'now' : score >= 0.68 ? 'soon' : 'calm',
    dueAt: job.cadence.preferredDay !== undefined ? nextWeekday(job.cadence.preferredDay, now) : undefined,
    subtitle: remaining <= 0 ? 'Plenty done for now' : `${Math.round(remaining * 10) / 10} ${job.unitLabel ?? 'times'} in the current rhythm`,
  };
}

export function selectJobAttention(jobs: JobDefinition[], events: JobEvent[], now = new Date()): AttentionItem[] {
  return jobs
    .filter((job) => job.enabled)
    .map((job) => ({ job, pressure: calculateJobPressure(job, events, now) }))
    .filter(({ pressure }) => pressure.urgency !== 'calm')
    .map(({ job, pressure }) => ({
      id: job.id,
      kind: 'job' as const,
      title: job.name,
      subtitle: pressure.subtitle,
      icon: job.icon,
      urgency: pressure.urgency as 'now' | 'soon',
      score: pressure.score,
      dueAt: pressure.dueAt?.toISOString(),
    }))
    .sort((a, b) => b.score - a.score);
}
