import { useState } from 'react';
import { ArrowLeft, Monitor, Pencil, Plus, RotateCcw, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../app/store';
import type { CadencePeriod, FlowDefinition, JobDefinition, JobKind } from '../../app/types';
import { AdminGate } from '../../features/admin/components/AdminGate';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { formatCadence } from '../../lib/date';
import { FlowEditor } from '../../features/flows/FlowEditor';
import { flowDefinitions } from '../../features/flows/flowDefinitions';

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export function AdminPage() { return <AdminGate><AdminContent/></AdminGate>; }

function AdminContent() {
  const store = useAppStore(); const state=store.state!; const navigate=useNavigate();
  const [jobOpen,setJobOpen]=useState(false); const [personOpen,setPersonOpen]=useState(false); const [editingJob,setEditingJob]=useState<JobDefinition|null>(null);
  const [addingFlow,setAddingFlow]=useState(false); const [editingFlow,setEditingFlow]=useState<FlowDefinition|null>(null);
  const [jobName,setJobName]=useState(''); const [jobKind,setJobKind]=useState<JobKind>('session'); const [jobIcon,setJobIcon]=useState('✨');
  const [personName,setPersonName]=useState(''); const [personPin,setPersonPin]=useState(''); const [error,setError]=useState('');

  async function addJob(){
    if(!jobName.trim())return;
    setError('');
    try {
      await store.addJob({name:jobName.trim(),icon:jobIcon,kind:jobKind,enabled:true,unitLabel:jobKind==='counted'?'times':undefined,cadence:{rate:1,period:'day',mode:jobKind==='calendar'?'manual':'auto'},calendarDay:jobKind==='calendar'?3:undefined});
      setJobOpen(false); setJobName('');
    } catch(caught) { setError(caught instanceof Error ? caught.message : 'Could not add that job.'); }
  }

  async function resetHousehold(){
    if(!confirm('Reset the shared FETA household? This clears people, jobs and history.')) return;
    try { await store.reset(); navigate('/setup'); }
    catch(caught) { setError(caught instanceof Error ? caught.message : 'Could not reset FETA.'); }
  }

  return <div className="phone-page admin-page"><header className="phone-header"><button className="icon-button" onClick={()=>navigate(-1)}><ArrowLeft/></button><div><span className="eyebrow">Rarely needed</span><h1>Admin</h1></div></header>
    {error&&<p className="form-error admin-error">{error}</p>}
    <div className="admin-summary"><Card><UsersRound/><div><strong>{state.people.length}</strong><span>people</span></div></Card><Card><span className="summary-emoji">✓</span><div><strong>{state.jobs.filter(j=>j.enabled).length}</strong><span>jobs</span></div></Card></div>
    <Card><div className="section-heading"><div><h2>Jobs</h2></div><button className="small-button" onClick={()=>setJobOpen(true)}><Plus/>Add</button></div><div className="admin-list">{state.jobs.map((job)=><div className="admin-row" key={job.id}><span className="admin-row__icon">{job.icon}</span><button className="admin-row__main" onClick={()=>setEditingJob(job)}><strong>{job.name}</strong><small>{job.kind==='session'?'One good go':job.kind==='counted'?'Each one counts':'Fixed schedule'} · {formatCadence(job.cadence.rate,job.cadence.period,job.kind)}</small></button><button className="row-edit" onClick={()=>setEditingJob(job)} aria-label={`Edit ${job.name}`}><Pencil/></button><label className="toggle"><input type="checkbox" checked={job.enabled} onChange={(e)=>void store.updateJob(job.id,{enabled:e.target.checked})}/><span/></label></div>)}</div></Card>
    <Card><div className="section-heading"><div><h2>Cycles</h2></div><button className="small-button" onClick={()=>setAddingFlow(true)}><Plus/>Add</button></div>
      <p className="helper-copy">Make household states your own. Set durations and gentle reminders for each stage.</p>
      <div className="admin-list">{(state.flows ?? flowDefinitions).map((flow)=><div className="admin-row" key={flow.id}>
        <span className="admin-row__icon">{flow.icon}</span>
        <button className="admin-row__main" onClick={()=>setEditingFlow(flow)}><strong>{flow.name}</strong><small>{flow.states.length} stages · {flow.states.filter(s=>s.durationMinutes).length} timed</small></button>
        <button className="row-edit" onClick={()=>setEditingFlow(flow)} aria-label={'Edit ' + flow.name}><Pencil/></button>
      </div>)}</div>
    </Card>
    <Card><div className="section-heading"><div><h2>People</h2></div><button className="small-button" onClick={()=>setPersonOpen(true)}><Plus/>Add</button></div>{state.people.map((person)=><div className="admin-row" key={person.id}><span className="avatar" style={{background:person.color}}>{person.name[0]}</span><div><strong>{person.name}</strong><small>PIN protected profile</small></div></div>)}</Card>
    <Card><div className="admin-row"><Monitor/><div><strong>Wall display</strong><small>Open /display on the always-on screen.</small></div><button className="small-button" onClick={()=>window.open('/display','_blank')}>Open</button></div></Card>
    <button className="text-button danger" onClick={()=>void resetHousehold()}><RotateCcw/>Reset shared household</button>
    {jobOpen&&<Modal title="Add a job" onClose={()=>setJobOpen(false)}><div className="form-stack"><label>Name<input value={jobName} onChange={(e)=>setJobName(e.target.value)} placeholder="Clean bathroom"/></label><label>Icon<input value={jobIcon} onChange={(e)=>setJobIcon(e.target.value)} maxLength={4}/></label><fieldset><legend>What happens when you do it?</legend>{([['session','One good go resets it'],['counted','Each one counts'],['calendar','Happens on a schedule']] as [JobKind,string][]).map(([value,label])=><label className="radio-row" key={value}><input type="radio" checked={jobKind===value} onChange={()=>setJobKind(value)}/><span>{label}</span></label>)}</fieldset><p className="helper-copy">New jobs start at a daily rhythm. FETA learns from what actually happens.</p><button className="primary-button" onClick={()=>void addJob()}>Add job</button></div></Modal>}
    {personOpen&&<Modal title="Add a person" onClose={()=>setPersonOpen(false)}><div className="form-stack"><label>Name<input value={personName} onChange={(e)=>setPersonName(e.target.value)}/></label><label>4-digit PIN<input inputMode="numeric" maxLength={4} value={personPin} onChange={(e)=>setPersonPin(e.target.value.replace(/\D/g,''))}/></label><button className="primary-button" disabled={!personName.trim()||personPin.length!==4} onClick={async()=>{try{await store.addPerson(personName,personPin);setPersonOpen(false);setPersonName('');setPersonPin('');}catch(caught){setError(caught instanceof Error?caught.message:'Could not add that person.');}}}>Add person</button></div></Modal>}
    {editingJob&&<JobEditor job={editingJob} onClose={()=>setEditingJob(null)} onSave={async(patch)=>{await store.updateJob(editingJob.id,patch);setEditingJob(null);}}/>}
    {addingFlow&&<FlowEditor onClose={()=>setAddingFlow(false)} onSave={async(flow)=>{await store.addFlow(flow);setAddingFlow(false);}}/>}
    {editingFlow&&<FlowEditor flow={editingFlow} onClose={()=>setEditingFlow(null)} onSave={async(flow)=>{await store.updateFlow(editingFlow.id,flow);setEditingFlow(null);}} onDelete={flowDefinitions.some((flow)=>flow.id===editingFlow.id)?undefined:async()=>{await store.deleteFlow(editingFlow.id);setEditingFlow(null);}}/>}
  </div>;
}

function JobEditor({job,onClose,onSave}:{job:JobDefinition;onClose():void;onSave(patch:Partial<JobDefinition>):Promise<void>}) {
  const [name,setName]=useState(job.name); const [rate,setRate]=useState(String(job.cadence.rate)); const [period,setPeriod]=useState<CadencePeriod>(job.cadence.period); const [mode,setMode]=useState(job.cadence.mode); const [preferredDay,setPreferredDay]=useState(job.cadence.preferredDay===undefined?'':String(job.cadence.preferredDay)); const [calendarDay,setCalendarDay]=useState(String(job.calendarDay??3)); const [busy,setBusy]=useState(false);
  async function save(){setBusy(true);try{await onSave({name:name.trim()||job.name,cadence:{...job.cadence,rate:Math.max(.1,Number(rate)||1),period,mode,preferredDay:preferredDay===''?undefined:Number(preferredDay)},calendarDay:job.kind==='calendar'?Number(calendarDay):job.calendarDay});}finally{setBusy(false);}}
  return <Modal title={job.name} onClose={onClose}><div className="form-stack"><label>Name<input value={name} onChange={(e)=>setName(e.target.value)}/></label>
    {job.kind!=='calendar'&&<><fieldset><legend>Learning</legend><label className="radio-row"><input type="radio" checked={mode==='auto'} onChange={()=>setMode('auto')}/><span><strong>Auto</strong><small>FETA may gently update the cadence from useful history.</small></span></label><label className="radio-row"><input type="radio" checked={mode==='manual'} onChange={()=>setMode('manual')}/><span><strong>Manual</strong><small>Keep exactly the rhythm you set below.</small></span></label></fieldset><div className="cadence-fields"><label>Rate<input type="number" min="0.1" step="0.1" value={rate} onChange={(e)=>{setRate(e.target.value);setMode('manual');}}/></label><label>Per<select value={period} onChange={(e)=>{setPeriod(e.target.value as CadencePeriod);setMode('manual');}}><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select></label></div>
    <label>Preferred day (optional)<select value={preferredDay} onChange={(e)=>setPreferredDay(e.target.value)}><option value="">Any day</option>{DAYS.map((day,index)=><option value={index} key={day}>{day}</option>)}</select></label></>}
    {job.kind==='calendar'&&<label>Day<select value={calendarDay} onChange={(e)=>setCalendarDay(e.target.value)}>{DAYS.map((day,index)=><option value={index} key={day}>{day}</option>)}</select></label>}
    <p className="helper-copy">There is one cadence value. Auto-learning writes to it; changing it yourself switches to Manual. Choose Auto again whenever you want FETA to resume learning.</p>
    <button className="primary-button" disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Save changes'}</button></div></Modal>;
}
