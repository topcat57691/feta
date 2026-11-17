import { useState } from 'react';
import type { FlowDefinition, FlowStage } from '../../app/types';
import { Modal } from '../../components/ui/Modal';
import { flowDefinitions, validateFlow } from './flowDefinitions';

const defaults = flowDefinitions.find((flow) => flow.id === 'laundry')!;
const stageById = (flow: FlowDefinition, id: string): FlowStage =>
  flow.states.find((stage) => stage.id === id) ?? defaults.states.find((stage) => stage.id === id)!;
const hours = (minutes?: number): string => String((minutes ?? 60) / 60);
const minutes = (value: string): number => Math.round(Number(value) * 60);

export function LaundrySettings({
  flow, onSave, onClose,
}: {
  flow: FlowDefinition;
  onSave(value: Omit<FlowDefinition, 'id'>): Promise<void>;
  onClose(): void;
}) {
  const [washing, setWashing] = useState(hours(stageById(flow, 'washing').durationMinutes));
  const [drying, setDrying] = useState(hours(stageById(flow, 'drying').durationMinutes));
  const [wetReminder, setWetReminder] = useState(hours(stageById(flow, 'ready-to-dry').remindAfterMinutes));
  const [putAwayReminder, setPutAwayReminder] = useState(hours(stageById(flow, 'ready-to-put-away').remindAfterMinutes));
  const [autoWash, setAutoWash] = useState(Boolean(stageById(flow, 'washing').autoAdvance));
  const [autoDry, setAutoDry] = useState(Boolean(stageById(flow, 'drying').autoAdvance));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    const values = [washing, drying, wetReminder, putAwayReminder].map(minutes);
    if (values.some((value) => !Number.isInteger(value) || value < 1 || value > 43200)) {
      setError('Use a duration between 1 minute and 30 days.');
      return;
    }
    const [wash, dry, wet, putAway] = values;
    const targetIds = new Set(['washing', 'drying', 'ready-to-dry', 'ready-to-put-away']);
    const states = [
      ...flow.states.filter((stage) => !targetIds.has(stage.id)),
      ...['washing', 'ready-to-dry', 'drying', 'ready-to-put-away'].map((id) => stageById(flow, id)),
    ].map((stage) => {
      if (stage.id === 'washing') return { ...stage, durationMinutes: wash, autoAdvance: autoWash };
      if (stage.id === 'drying') return { ...stage, durationMinutes: dry, autoAdvance: autoDry };
      if (stage.id === 'ready-to-dry') return { ...stage, remindAfterMinutes: wet };
      if (stage.id === 'ready-to-put-away') return { ...stage, remindAfterMinutes: putAway };
      return stage;
    });
    setBusy(true);
    setError('');
    try {
      const result = validateFlow({ name: flow.name, icon: flow.icon, states });
      await onSave(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save laundry timings.');
    } finally { setBusy(false); }
  }

  return <Modal title="Laundry timings" onClose={onClose}>
    <div className="form-stack">
      <p className="flow-editor-intro">Each laundry load has its own state and timer. These estimates and gentle reminders apply to all loads. Finishing a timer never means the load has been physically unloaded.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="cadence-fields">
        <label>Washing (hours)<input type="number" min="0.0167" max="720" step="0.25" value={washing} onChange={(e) => setWashing(e.target.value)}/></label>
        <label>Tumble drying (hours)<input type="number" min="0.0167" max="720" step="0.25" value={drying} onChange={(e) => setDrying(e.target.value)}/></label>
        <label>Wet load reminder (hours)<input type="number" min="0.0167" max="720" step="0.25" value={wetReminder} onChange={(e) => setWetReminder(e.target.value)}/></label>
        <label>Put away reminder (hours)<input type="number" min="0.0167" max="720" step="0.25" value={putAwayReminder} onChange={(e) => setPutAwayReminder(e.target.value)}/></label>
      </div>
      <label className="flow-option"><input type="checkbox" checked={autoWash} onChange={(e) => setAutoWash(e.target.checked)}/> Mark wash finished when the estimated time passes</label>
      <label className="flow-option"><input type="checkbox" checked={autoDry} onChange={(e) => setAutoDry(e.target.checked)}/> Mark tumble drying finished when the estimated time passes</label>
      <p className="helper-copy">Loads stay in their appliance until someone records moving or unloading them. Air drying has no automatic countdown.</p>
      <button className="primary-button" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save timings'}</button>
    </div>
  </Modal>;
}
