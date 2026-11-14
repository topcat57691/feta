import { useMemo, useState } from 'react';
import { Check, LogOut, Settings2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { availabilityLabels, useAppStore } from '../../app/store';
import type { Availability } from '../../app/types';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { selectJobAttention } from '../../features/cadence/cadence';
import { flowDefinitions, getFlowStateDefinition } from '../../features/flows/flowDefinitions';

const availabilities: Availability[] = ['in-zone','free','drained','out'];

export function MePage() {
  const store = useAppStore();
  const navigate = useNavigate();
  const [justDone, setJustDone] = useState<string | null>(null);
  const [showAllJobs, setShowAllJobs] = useState(false);
  const person = store.currentPerson;
  const state = store.state;
  const suggestions = useMemo(() => state ? selectJobAttention(state.jobs, state.events).slice(0,4) : [], [state]);

  if (!state) return null;
  if (!person) return <div className="phone-page"><div className="phone-header"><div><span className="eyebrow">FETA</span><h1>Who are you?</h1></div></div><Card><p className="muted">Choose your profile to make quick updates.</p><button className="primary-button" onClick={() => navigate('/who')}>Choose person</button></Card></div>;

  function doJob(jobId: string, quantity = 1) {
    const eventId = store.completeJob(jobId, person!.id, quantity);
    setJustDone(eventId);
    window.setTimeout(() => setJustDone((current) => current === eventId ? null : current), 7000);
  }

  return <div className="phone-page me-page">
    <header className="phone-header">
      <div className="profile-heading"><div className="avatar avatar--large" style={{background:person.color}}>{person.name.slice(0,1).toUpperCase()}</div><div><span className="eyebrow">This is me</span><h1>{person.name}</h1></div></div>
      <Link className="icon-button" to="/admin" aria-label="Admin"><Settings2/></Link>
    </header>

    <Card><h2>How are you?</h2><div className="choice-grid">{availabilities.map((availability) => <button key={availability} className={`choice-button choice-button--${availability} ${person.availability === availability ? 'selected' : ''}`} onClick={() => store.updatePerson(person.id,{availability,presence:availability==='out'?'out':'home'})}>{availabilityLabels[availability]}</button>)}</div></Card>

    <Card><div className="section-heading"><div><h2>How much is in the tank?</h2></div><strong className="capacity-label">{person.capacity}/5</strong></div><div className="capacity-picker" aria-label="Capacity">{[1,2,3,4,5].map((value) => <button key={value} aria-label={`${value} out of 5`} className={value <= person.capacity ? 'filled' : ''} onClick={() => store.updatePerson(person.id,{capacity:value as 1|2|3|4|5})}/>)}</div><p className="helper-copy">Your call, not a calculation. Rough is enough.</p></Card>

    <Card><h2>Today</h2><div className="check-list">{([
      ['sleptOkay','Slept okay','🛏️'],['feelingOkay','Feeling okay','💚'],['vitamins','Vitamins / meds','💊']
    ] as const).map(([key,label,icon]) => <button key={key} className="check-row" onClick={() => store.toggleDaily(person.id,key)}><span>{icon}</span><strong>{label}</strong><span className={`check-box ${person.daily[key]?'checked':''}`}>{person.daily[key] && <Check/>}</span></button>)}</div></Card>

    <Card className="did-card"><div className="section-heading"><div><h2>What did you do?</h2></div><span>Tap and carry on</span></div>
      <div className="action-list">
        {state.flowStates.map((flowState) => { const flow=flowDefinitions.find((candidate)=>candidate.id===flowState.flowId)!; const current=getFlowStateDefinition(flow.id,flowState.stateId); return <button className="action-row" key={flow.id} onClick={() => store.advanceFlow(flow.id,person.id)}><span className="action-row__icon">{flow.icon}</span><span><strong>{current.nextAction}</strong><small>{flow.name} · {current.label}</small></span><span className="action-cta">Done</span></button>; })}
        {suggestions.map((item) => { const job=state.jobs.find((candidate)=>candidate.id===item.id); if(!job) return null; return <button className="action-row" key={job.id} onClick={()=>doJob(job.id,1)}><span className="action-row__icon">{job.icon}</span><span><strong>{job.name}</strong><small>{job.kind==='counted'?`Add 1 ${job.unitLabel??'time'}`:'One good go resets it'}</small></span><span className="action-cta">{job.kind==='counted'?'+1':'Done'}</span></button>; })}
      </div>
      {justDone && <div className="gentle-followup"><span>Logged ✓</span><button onClick={() => store.markEventLeftTooLong(justDone)}>I left that too long</button></div>}
      <button className="secondary-button" onClick={() => setShowAllJobs(true)}>More…</button>
      <Link className="text-button" to="/house">See whole house</Link>
    </Card>

    {showAllJobs && <Modal title="What did you do?" onClose={() => setShowAllJobs(false)}><div className="action-list all-jobs-list">{state.jobs.filter((job) => job.enabled).map((job) => <button className="action-row" key={job.id} onClick={() => { doJob(job.id, 1); setShowAllJobs(false); }}><span className="action-row__icon">{job.icon}</span><span><strong>{job.name}</strong><small>{job.kind === 'counted' ? `Add 1 ${job.unitLabel ?? 'time'}` : job.kind === 'calendar' ? 'Done for this occurrence' : 'One good go resets it'}</small></span><span className="action-cta">{job.kind === 'counted' ? '+1' : 'Done'}</span></button>)}</div></Modal>}

    <button className="text-button switch-person" onClick={() => {store.setCurrentPerson(undefined);navigate('/who');}}><LogOut size={18}/>Switch person</button>
  </div>;
}
