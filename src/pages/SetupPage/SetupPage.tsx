import { useState } from 'react';
import { Home, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../app/store';
import { Card } from '../../components/ui/Card';

export function SetupPage() {
  const { createHousehold, loadDemo } = useAppStore();
  const navigate = useNavigate();
  const [household, setHousehold] = useState('Home');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim() || pin.length !== 4) return;
    setBusy(true); await createHousehold(household,name,pin); navigate('/me');
  }
  async function demo() { setBusy(true); await loadDemo(); navigate('/house'); }

  return <div className="setup-page"><div className="setup-hero"><span className="brand__mark brand__mark--large"><Home/></span><span className="eyebrow">Family Everything Tracker App</span><h1>The state of home,<br/>at a glance.</h1><p>FETA stays quiet when everything is fine and gently shows what would be useful next.</p></div>
    <Card className="setup-card"><h2>Set up this household</h2><label>Household name<input value={household} onChange={(e)=>setHousehold(e.target.value)} /></label><label>Your name<input value={name} onChange={(e)=>setName(e.target.value)} placeholder="e.g. Tristan" /></label><label>Your 4-digit PIN<input inputMode="numeric" maxLength={4} value={pin} onChange={(e)=>setPin(e.target.value.replace(/\D/g,''))} placeholder="••••" /></label><button className="primary-button" disabled={busy||!name.trim()||pin.length!==4} onClick={submit}>Create household</button><div className="or"><span/>or<span/></div><button className="secondary-button" disabled={busy} onClick={demo}><Sparkles size={18}/>Load the demo household</button><small className="muted">Demo profiles all use PIN <strong>1234</strong>.</small></Card>
  </div>;
}
