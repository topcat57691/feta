import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { FlowDefinition, FlowStage } from '../../app/types';
import { Modal } from '../../components/ui/Modal';
import { validateFlow } from './flowDefinitions';

const blankFlow: FlowDefinition = {
  id: '', name: '', icon: '🔄',
  states: [
    { id: 'ready', label: 'Ready', nextAction: 'Start' },
    { id: 'running', label: 'Running', nextAction: 'Mark done', durationMinutes: 60, autoAdvance: true },
    { id: 'done', label: 'Done', nextAction: 'Reset', remindAfterMinutes: 360 },
  ],
};

function toHours(minutes?: number): string { return minutes ? String(minutes / 60) : ''; }
function fromHours(text: string): number | undefined {
  if (!text.trim()) return undefined;
  const hours = Number(text);
  return Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60) : undefined;
}

export function FlowEditor({
  flow, onClose, onSave, onDelete,
}: {
  flow?: FlowDefinition;
  onClose(): void;
  onSave(value: Omit<FlowDefinition, 'id'>): Promise<void>;
  onDelete?(): Promise<void>;
}) {
  const initial = flow ?? blankFlow;
  const [name, setName] = useState(initial.name);
  const [icon, setIcon] = useState(initial.icon);
  const [stages, setStages] = useState<FlowStage[]>(initial.states.map((stage) => ({ ...stage })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function edit(id: string, patch: Partial<FlowStage>) {
    setStages((current) => current.map((stage) => stage.id === id ? { ...stage, ...patch } : stage));
  }

  function move(index: number, direction: number) {
    setStages((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    setError('');
    let value: Omit<FlowDefinition, 'id'>;
    try {
      value = validateFlow({ name, icon, states: stages });
    } catch {
      setError('Give each stage a name and action. Timers must be between 1 minute and 30 days; at least one stage must be manual.');
      return;
    }
    setBusy(true);
    try { await onSave(value); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save cycle.'); }
    finally { setBusy(false); }
  }

  return <Modal title={flow ? 'Edit ' + flow.name : 'Add a cycle'} onClose={onClose}>
    <div className="form-stack">
      {error && <p className="form-error">{error}</p>}
      <div className="flow-editor-intro">
        Set up each state in order. A timed state can finish automatically; a completed state can offer a gentle reminder later.
      </div>
      <div className="cadence-fields">
        <label>Cycle name<input value={name} maxLength={70} placeholder="Tumble dryer" onChange={(event) => setName(event.target.value)}/></label>
        <label>Icon<input value={icon} maxLength={12} onChange={(event) => setIcon(event.target.value)}/></label>
      </div>
      {stages.map((stage, index) => <section className="flow-stage-editor" key={stage.id}>
        <div className="flow-stage-header">
          <strong>Stage {index + 1}</strong>
          <div className="flow-stage-controls">
            <button type="button" aria-label="Move stage up" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={17}/></button>
            <button type="button" aria-label="Move stage down" disabled={index === stages.length - 1} onClick={() => move(index, 1)}><ArrowDown size={17}/></button>
            <button type="button" aria-label="Remove stage" disabled={stages.length <= 2} onClick={() => setStages((current) => current.filter((candidate) => candidate.id !== stage.id))}><Trash2 size={17}/></button>
          </div>
        </div>
        <div className="cadence-fields">
          <label>State<input value={stage.label} maxLength={60} placeholder="Drying" onChange={(event) => edit(stage.id, { label: event.target.value })}/></label>
          <label>Next action<input value={stage.nextAction} maxLength={80} placeholder="Mark dry" onChange={(event) => edit(stage.id, { nextAction: event.target.value })}/></label>
        </div>
        <div className="cadence-fields">
          <label>Duration (hours)<input type="number" inputMode="decimal" min="0.0167" max="720" step="0.25" placeholder="No timer" value={toHours(stage.durationMinutes)} onChange={(event) => {
            const durationMinutes = fromHours(event.target.value);
            edit(stage.id, { durationMinutes, autoAdvance: durationMinutes ? stage.autoAdvance : false });
          }}/></label>
          <label>Remind after (hours)<input type="number" inputMode="decimal" min="0.0167" max="720" step="0.25" placeholder="No reminder" value={toHours(stage.remindAfterMinutes)} onChange={(event) => edit(stage.id, { remindAfterMinutes: fromHours(event.target.value) })}/></label>
        </div>
        <label className="flow-option"><input type="checkbox" checked={Boolean(stage.autoAdvance)} disabled={!stage.durationMinutes} onChange={(event) => edit(stage.id, { autoAdvance: event.target.checked })}/> Move automatically to the next state when the duration ends</label>
      </section>)}
      <button className="secondary-button" type="button" disabled={stages.length >= 16} onClick={() => setStages((current) => [...current, {
        id: 'stage_' + crypto.randomUUID().replace(/-/g, ''), label: '', nextAction: '',
      }])}><Plus size={18}/> Add stage</button>
      <p className="helper-copy">You can finish an activity early on the Me screen. Reminders appear on the household display, not as push notifications.</p>
      <button className="primary-button" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save cycle'}</button>
      {onDelete && <button className="text-button danger" disabled={busy} onClick={async () => {
        if (!confirm('Delete this cycle? Its existing history will be kept.')) return;
        setBusy(true);
        try { await onDelete(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not delete cycle.'); }
        finally { setBusy(false); }
      }}><Trash2 size={17}/> Delete cycle</button>}
    </div>
  </Modal>;
}
