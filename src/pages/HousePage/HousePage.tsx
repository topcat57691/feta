import { useEffect, useMemo, useState } from 'react';
import { Clock3, Home, Leaf, Sparkles } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '../../app/store';
import { Card } from '../../components/ui/Card';
import { Pill } from '../../components/ui/Pill';
import { PersonCard } from '../../features/people/components/PersonCard';
import { selectJobAttention } from '../../features/cadence/cadence';
import { flowDefinitions, getFlowStateDefinition } from '../../features/flows/flowDefinitions';
import { HouseholdTimeline } from '../../features/timeline/HouseholdTimeline';
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
      const flow = flowDefinitions.find((candidate) => candidate.id === flowState.flowId);
      if (!flow) return [];
      const current = getFlowStateDefinition(flow.id, flowState.stateId);
      if (!current.attention) return [];
      return [{ id: flow.id, kind: 'flow' as const, title: current.nextAction, subtitle: `${flow.name} · ${current.label}`, icon: flow.icon, urgency: current.attention, score: current.attention === 'now' ? 1.4 : 0.8 }];
    });
    return [...flows, ...jobs].sort((a,b) => b.score - a.score).slice(0,5);
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
          {state.flowStates.map((flowState) => {
            const flow = flowDefinitions.find((candidate) => candidate.id === flowState.flowId)!;
            const current = getFlowStateDefinition(flow.id, flowState.stateId);
            return <div className="state-row" key={flow.id}><span className="state-row__icon">{flow.icon}</span><strong>{flow.name}</strong><Pill tone={current.attention ? 'blue' : 'green'}>{current.label}</Pill></div>;
          })}
          {state.jobs.filter((job) => job.enabled).slice(0,5).map((job) => {
            const last = state.events.filter((event) => event.jobId === job.id).sort((a,b) => b.occurredAt.localeCompare(a.occurredAt))[0];
            return <div className="state-row" key={job.id}><span className="state-row__icon">{job.icon}</span><strong>{job.name}</strong><span className="state-row__detail">{last ? relativeTime(last.occurredAt, now) : formatCadence(job.cadence.rate, job.cadence.period, job.kind)}</span></div>;
          })}
        </div>
      </Card>
    </div>

    <HouseholdTimeline state={state} />
  </div>;
}
