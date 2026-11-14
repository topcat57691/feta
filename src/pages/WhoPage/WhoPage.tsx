import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../app/store';
import { matchesPin } from '../../lib/pin';
import { Card } from '../../components/ui/Card';

export function WhoPage() {
  const { state, setCurrentPerson } = useAppStore();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  if (!state) return null;
  const selected = state.people.find((person) => person.id === selectedId);

  async function unlock() {
    if (!selected) return;
    if (await matchesPin(pin, selected.pinHash)) { setCurrentPerson(selected.id); navigate('/me'); return; }
    setError('That PIN did not match.');
  }

  return <div className="phone-page auth-page">
    <header className="phone-header"><button className="icon-button" onClick={() => navigate(-1)}><ArrowLeft/></button><div><span className="eyebrow">FETA</span><h1>Who are you?</h1></div></header>
    <div className="people-picker">{state.people.map((person) => <button className="person-pick" key={person.id} onClick={()=>{setSelectedId(person.id);setPin('');setError('');}}><span className="avatar" style={{background:person.color}}>{person.name[0]}</span><strong>{person.name}</strong></button>)}</div>
    {selected && <Card className="pin-card"><h2>Hi {selected.name}</h2><p className="muted">Enter your 4-digit PIN.</p><input autoFocus inputMode="numeric" pattern="[0-9]*" maxLength={4} value={pin} onChange={(event)=>setPin(event.target.value.replace(/\D/g,''))} className="pin-input" aria-label="PIN" />{error && <p className="form-error">{error}</p>}<button className="primary-button" disabled={pin.length!==4} onClick={unlock}>Continue</button></Card>}
  </div>;
}
