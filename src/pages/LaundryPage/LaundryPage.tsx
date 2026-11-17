import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Pencil, Plus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../../app/store';
import type { FlowInstance } from '../../app/types';
import { Card } from '../../components/ui/Card';
import { Pill } from '../../components/ui/Pill';
import { laundryStates, laundryStats, laundryTiming, laundryTransitions, occupiedAppliance, type LaundryAction, type LaundryState } from '../../features/laundry/laundry';

function LoadRow({
  load, busy, flow, now, onAction, onRename,
}: {
  load: FlowInstance;
  busy: boolean;
  flow: NonNullable<ReturnType<typeof useAppStore>['state']>['flows'][number] | undefined;
  now: Date;
  onAction(action: LaundryAction): Promise<void>;
  onRename(name: string): Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(load.name);
  const stage = laundryStates[load.stateId as LaundryState];
  if (!stage) return null;
  const timer = laundryTiming(load, flow, now);
  const details = timer.remainingMinutes !== null
    ? timer.remainingMinutes === 0 ? 'Estimated cycle time elapsed' : timer.remainingMinutes + 'm remaining'
    : timer.reminderDue ? 'Worth doing when you can'
      : timer.elapsedMinutes < 60 ? timer.elapsedMinutes + 'm in this state'
        : Math.floor(timer.elapsedMinutes / 60) + 'h in this state';
  const actions = laundryTransitions[load.stateId as LaundryState];
  return <div className="laundry-load">
    <div className="laundry-load__main">
      <span className="laundry-load__icon" aria-hidden>{stage.icon}</span>
      <div className="laundry-load__description">
        {editing ? <form className="laundry-rename" onSubmit={(event) => {
          event.preventDefault();
          void onRename(name).then(() => setEditing(false));
        }}>
          <input autoFocus aria-label="Load name" maxLength={70} value={name} onChange={(event) => setName(event.target.value)} />
          <button aria-label="Save name" type="submit" disabled={busy || !name.trim()}><Check size={17}/></button>
          <button aria-label="Cancel editing" type="button" onClick={() => { setName(load.name); setEditing(false); }}><X size={17}/></button>
        </form> : <div className="laundry-load__title"><strong>{load.name}</strong><button type="button" aria-label={'Rename ' + load.name} onClick={() => setEditing(true)}><Pencil size={15}/></button></div>}
        <span>{stage.label}</span>
        <small>{details}</small>
      </div>
      {timer.reminderDue && <Pill tone="amber">Gentle nudge</Pill>}
    </div>
    <div className="laundry-load__actions">
      {actions.map((choice, index) => <button key={choice.action} type="button"
        className={index === 0 ? 'laundry-action laundry-action--primary' : 'laundry-action'}
        disabled={busy} onClick={() => void onAction(choice.action)}>{choice.label}</button>)}
    </div>
  </div>;
}

export function LaundryPage() {
  const store = useAppStore();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!store.state) return null;
  const loads = store.state.flowInstances ?? [];
  const stats = laundryStats(loads);
  const flow = store.state.flows.find((item) => item.id === 'laundry');
  const person = store.currentPerson;
  const order: Record<string, number> = {
    'wash-complete': 0, 'dryer-complete': 1, wet: 2, 'ready-to-put-away': 3,
    washing: 4, drying: 5, 'air-drying': 6, waiting: 7,
  };
  const sorted = [...loads].filter((item) => item.flowId === 'laundry')
    .sort((a, b) => (order[a.stateId] ?? 99) - (order[b.stateId] ?? 99) || a.createdAt.localeCompare(b.createdAt));

  async function action(id: string, perform: () => Promise<void>) {
    setBusy(id);
    setError('');
    try { await perform(); }
    catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update that load.');
      await store.refresh();
    } finally { setBusy(null); }
  }

  return <div className="phone-page laundry-page">
    <header className="phone-header">
      <Link to="/house" className="icon-button" aria-label="Back to house"><ArrowLeft/></Link>
      <div><span className="eyebrow">Household state</span><h1>🧺 Laundry</h1></div>
      <span className="laundry-count">{stats.total} active</span>
    </header>
    <Card className="laundry-overview">
      <h2>At a glance</h2>
      <div className="laundry-overview__grid">
        <div><span>🫧 Washer</span><strong>{stats.washing?.name ?? 'Available'}</strong></div>
        <div><span>🌬️ Tumble dryer</span><strong>{stats.drying?.name ?? 'Available'}</strong></div>
        <div><span>💧 Wet / waiting</span><strong>{stats.wet}</strong></div>
        <div><span>👕 Put away</span><strong>{stats.ready}</strong></div>
      </div>
    </Card>
    {!person ? <Card><p>Choose who you are to add and move laundry loads.</p><Link to="/who" className="primary-button">Choose a person</Link></Card> : <>
      <Card>
        <h2>Add a load</h2>
        <form className="laundry-add" onSubmit={(event) => {
          event.preventDefault();
          void action('new', async () => { await store.createLaundryLoad(person.id, name.trim() || undefined); setName(''); });
        }}>
          <input aria-label="Load name (optional)" maxLength={70} placeholder="Optional: school uniforms" value={name} onChange={(event) => setName(event.target.value)}/>
          <button type="submit" className="primary-button" disabled={busy !== null}><Plus size={18}/>New load</button>
        </form>
        <p className="helper-copy">Leave the name blank and FETA will number it for you.</p>
      </Card>
      {error && <p className="form-error" role="alert">{error}</p>}
      <Card className="laundry-loads-card">
        <h2>Loads in progress</h2>
        {sorted.length === 0 ? <p className="muted">Nothing on the go. Enjoy the empty laundry basket!</p> : <div className="laundry-loads">
          {sorted.map((load) => <LoadRow key={load.id} load={load} flow={flow} now={now} busy={busy !== null}
            onAction={(selected) => action(load.id, () => store.transitionLaundryLoad(load.id, person.id, selected))}
            onRename={(value) => action(load.id, () => store.renameLaundryLoad(load.id, person.id, value))}/>)}
        </div>}
      </Card>
      <p className="helper-copy laundry-note">Finished timers don't free appliances. Move or unload the load when you've actually done it. Air drying doesn't occupy the tumble dryer.</p>
    </>}
  </div>;
}
