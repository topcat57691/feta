import { useEffect, useMemo, useState } from 'react';
import { Clock3, Home, Leaf, Sparkles } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '../../app/store';
import { Card } from '../../components/ui/Card';
import { Pill } from '../../components/ui/Pill';
import { PersonCard } from '../../features/people/components/PersonCard';
import { calculateJobPressure, selectJobAttention } from '../../features/cadence/cadence';
import { flowDefinitions, flowTiming, getFlowStateDefinition } from '../../features/flows/flowDefinitions';
import { HouseholdTimeline } from '../../features/timeline/HouseholdTimeline';
import { UpcomingCalendar } from '../../features/timeline/UpcomingCalendar';
import { LaundrySummary } from '../../features/laundry/LaundrySummary';
import { laundryStates, laundryTiming, type LaundryState } from '../../features/laundry/laundry';
import { formatCadence, relativeTime } from '../../lib/date';

function urgencyTone(urgency: 'now'|'soon') { return urgency === 'now' ? 'amber' : 'blue'; }

export function HousePage() {
  const { state } = useAppStore();
  const location = useLocation();
  const displayMode = location.pathname === '/display';
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 30_000); return () => window.clearInterval(timer); }, []);

  const attention = useMemo(() => {
    if (!state) return [];
    const jobs = selectJobAttention(state.jobs, state.events, now);
    const flows = state.flowStates.flatMap((flowState) => {
      const flow = (state.flows ?? flowDefinitions).find((candidate) => candidate.id === flowState.flowId);
      if (!flow) return [];
      const timing = flowTiming(flow, flowState, now);
      if (!timing.reminderDue && !timing.stage.attention) return [];
      const title = timing.reminderDue ? flow.name + ' is ready' : timing.stage.nextAction;
      return [{ id: flow.id, kind: 'flow' as const, title, subtitle: flow.name + ' · ' + timing.stage.label, icon: flow.icon, urgency: 'soon' as const, score: 0.8 }];
    });
    const laundryFlow = state.flows.find((flow) => flow.id === 'laundry');
    const laundry = (state.flowInstances ?? []).flatMap((load) => {
      const timing = laundryTiming(load, laundryFlow, now);
      if (!['wash-complete', 'dryer-complete'].includes(load.stateId) && !timing.reminderDue) return [];
      return [{
        id: load.id, kind: 'flow' as const,
        title: load.stateId === 'wash-complete' ? 'Washing has finished'
          : load.stateId === 'dryer-complete' ? 'Dryer has finished' : 'Laundry is waiting',
        subtitle: load.name + ' · ' + (laundryStates[load.stateId as LaundryState]?.label ?? 'Laundry'),
        icon: '🧺', urgency: 'soon' as const, score: timing.reminderDue ? 0.92 : 0.76,
      }];
    });
    return [...laundry, ...flows, ...jobs].sort((a,b) => b.score - a.score).slice(0,5);
  }, [state, now]);

  if (!state) return null;
  const householdSummary = attention.length === 0 ? "Everything's pretty calm" : attention.some((item) => item.urgency === 'now') ? 'A couple of things want attention' : 'A few things are coming up';

  return <div className={`house-page ${displayMode ? 'house-page--display' : ''}`}>
    <header className="house-header">
      <div className="brand"><span className="brand__mark"><Home /></span><strong>FETA</strong></div>
      <div className="calm-banner"><Sparkles size={22}/><strong>{householdSummary}</strong></div>
      <div className="date-time"><span>{now.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'}).toUpperCase()}</span><span><Clock3 size={18}/>{now.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</span></div>
    </header>

    <section className="house-section">
      <h2>People</h2>
      <div className="people-grid">{state.people.map((person) => <PersonCard key={person.id} person={person} />)}</div>
    </section>

    <div className="house-columns">
      <Card className="attention-card">
        <div className="section-heading"><div><Leaf/><h2>What wants attention</h2></div><span>Useful, not urgent</span></div>
        {attention.length === 0 ? <div className="empty-calm"><strong>Nothing needs you right now.</strong><span>Carry on with your day.</span></div> : <div className="attention-list">{attention.map((item) => <div className="attention-row" key={`${item.kind}-${item.id}`}>
          <span className="attention-row__icon">{item.icon}</span>
          <div className="attention-row__text"><strong>{item.title}</strong><span>{item.subtitle}</span></div>
          <Pill tone={urgencyTone(item.urgency)}>{item.urgency === 'now' ? 'Now' : 'Soon'}</Pill>
        </div>)}</div>}
      </Card>

      <Card className="state-card">
        <div className="section-heading"><div><Home/><h2>Household state</h2></div><span>At a glance</span></div>
        <div className="state-list">
          <LaundrySummary loads={state.flowInstances ?? []} flow={state.flows.find((flow) => flow.id === 'laundry')} now={now} interactive={!displayMode} />
          {state.flowStates.map((flowState) => {
            const flow = (state.flows ?? flowDefinitions).find((candidate) => candidate.id === flowState.flowId);
            if (!flow) return null;
            const timing = flowTiming(flow, flowState, now);
            const current = getFlowStateDefinition(flow, flowState.stateId);
            const detail = timing.remainingMinutes !== null ? timing.remainingMinutes + 'm left' : timing.reminderDue ? 'Gentle reminder' : timing.reminderMinutes !== null ? 'Remind in ' + timing.reminderMinutes + 'm' : '';
            return <div className="state-row" key={flow.id}><span className="state-row__icon">{flow.icon}</span><strong>{flow.name}</strong><div className="flow-state-detail"><Pill tone={timing.reminderDue ? 'amber' : timing.remainingMinutes !== null ? 'blue' : 'green'}>{current.label}</Pill>{detail && <small>{detail}</small>}</div></div>;
          })}
          {state.jobs.filter((job) => job.enabled).slice(0,5).map((job) => {
            const last = state.events.filter((event) => event.jobId === job.id).sort((a,b) => b.occurredAt.localeCompare(a.occurredAt))[0];
            const pressure = calculateJobPressure(job, state.events, now);
            const stateLabel = pressure.urgency === 'calm' ? 'Fine' : pressure.urgency === 'soon' ? 'Soon' : 'Now';
            const detail = last ? `${stateLabel} · ${relativeTime(last.occurredAt, now)}` : `${stateLabel} · ${formatCadence(job.cadence.rate, job.cadence.period, job.kind)}`;
            return <div className="state-row" key={job.id}><span className="state-row__icon">{job.icon}</span><strong>{job.name}</strong><span className="state-row__detail">{detail}</span></div>;
          })}
        </div>
      </Card>
    </div>

    <UpcomingCalendar />
    <HouseholdTimeline state={state} />
  </div>;
}
