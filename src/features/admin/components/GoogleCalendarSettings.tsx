import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Link2, RefreshCw, Unplug } from 'lucide-react';
import { Card } from '../../../components/ui/Card';

interface CalendarSource {
  id: string;
  name: string;
  color: string | null;
  selected: boolean;
  lastSync: string | null;
  error: string | null;
}
interface CalendarStatus {
  configured: boolean;
  missingSecrets: string[];
  connected: boolean;
  account: string | null;
  calendars: CalendarSource[];
}

async function api<T>(path: string, method = 'GET', payload?: unknown): Promise<T> {
  const pin = sessionStorage.getItem('feta.admin.pin');
  if (!pin) throw new Error('Lock and unlock Admin again to manage calendars.');
  const result = await fetch('/api/integrations/google-calendar/' + path, {
    method,
    headers: {
      'x-admin-pin': pin,
      ...(payload !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
  });
  if (!result.ok) {
    const error = await result.json().catch(() => ({})) as { message?: string };
    throw new Error(error.message ?? 'Calendar request failed (' + result.status + ')');
  }
  return await result.json() as T;
}

export function GoogleCalendarSettings() {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const outcome = new URLSearchParams(window.location.search).get('calendar');

  const load = useCallback(async () => {
    const next = await api<CalendarStatus>('status');
    setStatus(next);
    setChosen(next.calendars.filter((c) => c.selected).map((c) => c.id));
  }, []);

  useEffect(() => {
    let active = true;
    void api<CalendarStatus>('status').then((next) => {
      if (!active) return;
      setStatus(next);
      setChosen(next.calendars.filter((c) => c.selected).map((c) => c.id));
    }).catch((caught: unknown) => {
      if (active) setError(caught instanceof Error ? caught.message : 'Could not load calendars.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function act(task: () => Promise<void>, success: string) {
    setBusy(true); setError(''); setMessage('');
    try {
      await task();
      await load();
      setMessage(success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update calendars.');
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    setBusy(true); setError('');
    try {
      const result = await api<{ url: string }>('connect', 'POST');
      if (!result.url.startsWith('https://accounts.google.com/')) throw new Error('Unexpected Google login URL.');
      window.location.assign(result.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start Google connection.');
      setBusy(false);
    }
  }

  const original = (status?.calendars ?? []).filter((calendar) => calendar.selected).map((calendar) => calendar.id);
  const changed = chosen.length !== original.length || chosen.some((id) => !original.includes(id));

  return <Card>
    <div className="section-heading"><div><CalendarDays/><h2>Google Calendar</h2></div></div>
    <p className="helper-copy">Choose exactly which calendars can appear on the shared household timeline. Google events stay read-only; completion is tracked only in FETA.</p>
    {outcome === 'connected' && <p className="connection-note">Google connected. Choose calendars below to start showing events.</p>}
    {outcome === 'error' && <p className="form-error">Google did not connect. Check the OAuth redirect and Google Cloud settings, then try again.</p>}
    {outcome === 'cancelled' && <p className="connection-note">Google connection was cancelled.</p>}
    {error && <p className="form-error">{error}</p>}
    {!loading && status && !status.configured && <p className="form-error" role="alert">
      FETA is missing these runtime Worker secrets: <strong>{status.missingSecrets.join(', ')}</strong>.
      Check Cloudflare Workers &amp; Pages → feta → Settings → Variables and Secrets (not Build variables),
      then select Deploy. Only the variable names are shown here, never their values.
    </p>}
    {message && <p className="connection-note" role="status">{message}</p>}
    {loading && <p className="connection-note">Checking Google connection…</p>}

    {!loading && status && !status.connected && <div className="calendar-settings-actions">
      <button className="primary-button" disabled={busy || !status.configured} onClick={() => void connect()}><Link2 size={18}/>Connect Google Calendar</button>
      <small className="muted">FETA asks only to view your calendar list and events. No Google event is changed.</small>
    </div>}

    {!loading && status?.connected && <>
      <div className="calendar-account">
        <div><strong>{status.account || 'Google account'}</strong><small>Connected · {status.calendars.length} calendars available</small></div>
        <button className="small-button" disabled={busy} onClick={() => void act(() => api('refresh', 'POST'), 'Calendar list refreshed.')}><RefreshCw size={16}/>Refresh list</button>
      </div>
      <div className="calendar-settings-list">
        {status.calendars.map((calendar) => <label className="calendar-settings-row" key={calendar.id}>
          <span className="calendar-settings-color" style={{ background: calendar.color || '#9aafab' }}/>
          <span className="calendar-settings-name"><strong>{calendar.name}</strong><small>{calendar.error ? 'Sync issue: ' + calendar.error : calendar.lastSync ? 'Last synced ' + new Date(calendar.lastSync).toLocaleString() : 'Not yet synced'}</small></span>
          <input type="checkbox" checked={chosen.includes(calendar.id)} disabled={busy} onChange={(event) => setChosen((previous) =>
            event.target.checked ? [...previous, calendar.id] : previous.filter((id) => id !== calendar.id)
          )} aria-label={'Show ' + calendar.name + ' on the household timeline'}/>
        </label>)}
        {!status.calendars.length && <p className="connection-note">No calendars returned by Google. Try refreshing the list.</p>}
      </div>
      <div className="calendar-settings-actions">
        <button className="primary-button" disabled={!changed || busy} onClick={() => void act(
          () => api('selection', 'PUT', { calendarIds: chosen }),
          'Calendar selection saved and synchronised.',
        )}>{busy ? 'Working…' : 'Save calendar selection'}</button>
        <div className="calendar-settings-secondary">
          <button className="small-button" disabled={busy} onClick={() => void act(() => api('sync', 'POST'), 'Calendar sync requested.')}>
            <RefreshCw size={16}/>Sync now
          </button>
          <button className="small-button" disabled={busy} onClick={() => {
            if (!window.confirm('Disconnect Google Calendar and remove its events and FETA completion history?')) return;
            void act(() => api('disconnect', 'DELETE'), 'Google Calendar disconnected.');
          }}><Unplug size={16}/>Disconnect</button>
        </div>
        <small className="muted">Other FETA household members can see selected calendar events. Leave personal calendars unchecked if you do not want them shared.</small>
      </div>
    </>}
  </Card>;
}
