import { useState, type ReactNode } from 'react';
import { LockKeyhole } from 'lucide-react';
import { useAppStore } from '../../../app/store';
import { Card } from '../../../components/ui/Card';

export function AdminGate({ children }: { children: ReactNode }) {
  const { state, setAdminPin, verifyAdminPin } = useAppStore();
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('feta.admin.unlocked') === 'yes');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!state) return null;
  if (unlocked) return <>{children}</>;

  async function submit() {
    setBusy(true);
    setError('');
    try {
      if (!state!.adminPinSet) {
        if (pin.length!==4 || pin!==confirm) { setError('Use matching 4-digit PINs.'); return; }
        await setAdminPin(pin);
        sessionStorage.setItem('feta.admin.unlocked','yes');
        setUnlocked(true);
        return;
      }
      if (await verifyAdminPin(pin)) {
        sessionStorage.setItem('feta.admin.unlocked','yes');
        setUnlocked(true);
        return;
      }
      setError('That PIN did not match.');
    } catch {
      setError('Could not unlock Admin right now.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="phone-page auth-page"><Card className="pin-card"><div className="gate-icon"><LockKeyhole/></div><span className="eyebrow">Admin</span><h1>{state.adminPinSet ? 'Enter admin PIN' : 'Choose an admin PIN'}</h1><p className="muted">Just enough protection to stop casual changes.</p><input className="pin-input" inputMode="numeric" maxLength={4} value={pin} onChange={(e)=>setPin(e.target.value.replace(/\D/g,''))} placeholder="••••" />{!state.adminPinSet && <input className="pin-input" inputMode="numeric" maxLength={4} value={confirm} onChange={(e)=>setConfirm(e.target.value.replace(/\D/g,''))} placeholder="Confirm" />}{error&&<p className="form-error">{error}</p>}<button className="primary-button" onClick={()=>void submit()} disabled={busy||pin.length!==4||(!state.adminPinSet&&confirm.length!==4)}>{busy?'Checking…':state.adminPinSet?'Unlock':'Set PIN'}</button></Card></div>;
}
