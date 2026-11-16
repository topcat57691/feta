import { useMemo } from 'react';
import type { HouseholdState } from '../../app/types';
import { calculateJobPressure } from '../cadence/cadence';
import { flowDefinitions, getFlowStateDefinition } from '../flows/flowDefinitions';
import { DAY_MS } from '../../lib/date';

export function HouseholdTimeline({ state }: { state: HouseholdState }) {
  const markers = useMemo(() => {
    const now = Date.now();
    const jobPast = state.events
      .filter((event) => now - new Date(event.occurredAt).getTime() <= 7 * DAY_MS)
      .map((event) => {
        const job = state.jobs.find((candidate) => candidate.id === event.jobId);
        const delta = (now - new Date(event.occurredAt).getTime()) / (7 * DAY_MS);
        return { id: event.id, occurredAt: event.occurredAt, icon: job?.icon ?? '✓', label: job?.name ?? 'Done', left: Math.max(2, 50 - delta * 46), side: 'past' as const };
      });

    const flowPast = state.flowEvents
      .filter((event) => now - new Date(event.occurredAt).getTime() <= 7 * DAY_MS)
      .map((event) => {
        const flow = (state.flows ?? flowDefinitions).find((candidate) => candidate.id === event.flowId);
        const delta = (now - new Date(event.occurredAt).getTime()) / (7 * DAY_MS);
        return { id: event.id, occurredAt: event.occurredAt, icon: flow?.icon ?? '↻', label: flow?.name ?? 'Flow', left: Math.max(2, 50 - delta * 46), side: 'past' as const };
      });

    const past = [...jobPast, ...flowPast]
      .sort((a,b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
      .slice(-8);

    const future = state.jobs.filter((job) => job.enabled).map((job) => ({ job, pressure: calculateJobPressure(job, state.events) }))
      .filter(({ pressure }) => pressure.dueAt)
      .sort((a,b) => a.pressure.dueAt!.getTime() - b.pressure.dueAt!.getTime())
      .slice(0,6)
      .map(({ job, pressure }) => {
        const delta = Math.max(0, (pressure.dueAt!.getTime() - now) / (7 * DAY_MS));
        return { id: `next-${job.id}`, icon: job.icon, label: job.name, left: Math.min(98, 50 + delta * 46), side: 'future' as const };
      });
    const flowFuture = state.flowStates.flatMap((flowState) => {
      const flow = (state.flows ?? flowDefinitions).find((candidate) => candidate.id === flowState.flowId);
      if (!flow) return [];
      const stage = getFlowStateDefinition(flow, flowState.stateId);
      const minutes = stage.durationMinutes ?? stage.remindAfterMinutes;
      if (!minutes) return [];
      const at = new Date(flowState.updatedAt).getTime() + minutes * 60_000;
      if (at < now) return [];
      const delta = (at - now) / (7 * DAY_MS);
      return [{ id: 'cycle-' + flow.id, icon: flow.icon,
        label: stage.durationMinutes ? stage.nextAction : flow.name + ' reminder',
        left: Math.min(98, 50 + delta * 46), side: 'future' as const, at }];
    });
    const next = [
      ...future.map((item) => ({ ...item, at: now + (item.left - 50) / 46 * 7 * DAY_MS })),
      ...flowFuture,
    ].sort((a,b) => a.at - b.at).slice(0,6);
    return [...past, ...next];
  }, [state]);

  return <div className="timeline-card">
    <div className="timeline-card__title"><strong>Household rhythm</strong><span>recently ← now → next up</span></div>
    <div className="timeline">
      <div className="timeline__line" />
      <div className="timeline__now"><span>NOW</span></div>
      {markers.map((marker, index) => <div key={marker.id} className={`timeline__marker timeline__marker--${marker.side} timeline__marker--row-${index % 2}`} style={{ left: `${marker.left}%` }} title={marker.label}>
        <span>{marker.icon}</span><small>{marker.label}</small>
      </div>)}
    </div>
  </div>;
}
