import { useMemo } from 'react';
import type { HouseholdState } from '../../app/types';
import { calculateJobPressure } from '../cadence/cadence';
import { flowDefinitions, getFlowStateDefinition } from '../flows/flowDefinitions';
import { DAY_MS } from '../../lib/date';

interface Marker {
  id: string;
  icon: string;
  label: string;
  at: number;
  calendar?: boolean;
  done?: boolean;
}

export function HouseholdTimeline({ state }: { state: HouseholdState }) {
  const markers = useMemo(() => {
    const now = Date.now();
    const windowMs = 7 * DAY_MS;
    const pastJobs: Marker[] = state.events
      .filter((event) => now - new Date(event.occurredAt).getTime() <= windowMs)
      .map((event) => ({
        id: 'job-' + event.id,
        at: new Date(event.occurredAt).getTime(),
        icon: state.jobs.find((job) => job.id === event.jobId)?.icon ?? '✓',
        label: state.jobs.find((job) => job.id === event.jobId)?.name ?? 'Done',
        done: true,
      }));
    const pastFlows: Marker[] = state.flowEvents
      .filter((event) => now - new Date(event.occurredAt).getTime() <= windowMs)
      .map((event) => ({
        id: 'flow-' + event.id,
        at: new Date(event.occurredAt).getTime(),
        icon: (state.flows ?? flowDefinitions).find((flow) => flow.id === event.flowId)?.icon ?? '↻',
        label: (state.flows ?? flowDefinitions).find((flow) => flow.id === event.flowId)?.name ?? 'Cycle',
        done: true,
      }));
    const upcomingJobs: Marker[] = state.jobs.filter((job) => job.enabled)
      .map((job) => ({ job, pressure: calculateJobPressure(job, state.events) }))
      .filter(({ pressure }) => pressure.dueAt && pressure.dueAt.getTime() >= now)
      .map(({ job, pressure }) => ({
        id: 'due-' + job.id, at: pressure.dueAt!.getTime(), icon: job.icon, label: job.name,
      }));
    const upcomingFlows: Marker[] = state.flowStates.flatMap((current) => {
      const flow = (state.flows ?? flowDefinitions).find((item) => item.id === current.flowId);
      if (!flow) return [];
      const stage = getFlowStateDefinition(flow, current.stateId);
      const minutes = stage.durationMinutes ?? stage.remindAfterMinutes;
      if (!minutes) return [];
      const at = new Date(current.updatedAt).getTime() + minutes * 60_000;
      return at >= now ? [{
        id: 'cycle-' + flow.id, at, icon: flow.icon,
        label: stage.durationMinutes ? stage.nextAction : flow.name + ' reminder',
      }] : [];
    });
    const googleEvents: Marker[] = (state.calendarEvents ?? [])
      .map((event) => ({
        id: 'google-' + event.calendarId + ':' + event.eventId,
        at: new Date(event.completedAt ?? event.startsAt).getTime(),
        icon: event.completedAt ? '✓' : '📅',
        label: event.title,
        calendar: true,
        done: Boolean(event.completedAt),
      }));
    const all = [...pastJobs, ...pastFlows, ...upcomingJobs, ...upcomingFlows, ...googleEvents]
      .filter((marker) => Number.isFinite(marker.at) && Math.abs(marker.at - now) <= windowMs);
    const past = all.filter((item) => item.at < now).sort((a, b) => b.at - a.at).slice(0, 8);
    const future = all.filter((item) => item.at >= now).sort((a, b) => a.at - b.at).slice(0, 8);
    return [...past.reverse(), ...future].map((marker) => {
      const closeness = 1 - Math.min(1, Math.abs(marker.at - now) / windowMs);
      return {
        ...marker,
        side: marker.at < now ? 'past' as const : 'future' as const,
        left: Math.max(3, Math.min(97, 50 + (marker.at - now) / windowMs * 46)),
        size: marker.calendar ? Math.round(28 + closeness * 18) : 34,
      };
    });
  }, [state]);

  return <div className="timeline-card">
    <div className="timeline-card__title"><strong>Household rhythm</strong><span>recently ← now → next up</span></div>
    <div className="timeline">
      <div className="timeline__line" />
      <div className="timeline__now"><span>NOW</span></div>
      {markers.map((marker, index) => <div key={marker.id}
        className={`timeline__marker timeline__marker--${marker.side} timeline__marker--row-${index % 2} ${marker.calendar ? 'timeline__marker--calendar' : ''}`}
        style={{ left: marker.left + '%' }}
        title={marker.label + (marker.done ? ' · Done' : '')}>
        <span style={{ width: marker.size, height: marker.size }}>{marker.icon}</span><small>{marker.label}</small>
      </div>)}
    </div>
  </div>;
}
