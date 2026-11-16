import { useMemo, useState } from 'react';
import { CalendarClock, Check, Circle, RotateCcw } from 'lucide-react';
import { useAppStore } from '../../app/store';
import type { CalendarEvent } from '../../app/types';
import { Card } from '../../components/ui/Card';

function when(event: CalendarEvent): string {
  const start = new Date(event.startsAt);
  if (event.allDay) {
    return start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) + ' · All day';
  }
  return start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) +
    ' · ' + start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function UpcomingCalendar() {
  const { state, currentPersonId, completeCalendarEvent } = useAppStore();
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const events = useMemo(() => {
    const now = Date.now();
    return (state?.calendarEvents ?? [])
      .filter((event) => {
        const start = new Date(event.startsAt).getTime();
        return Number.isFinite(start) && start >= now - 24 * 60 * 60_000 && start <= now + 14 * 86400_000;
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .slice(0, 12);
  }, [state?.calendarEvents]);
  if (!events.length) return null;

  async function toggle(event: CalendarEvent) {
    if (!currentPersonId) return;
    setError('');
    setBusyId(event.calendarId + ':' + event.eventId);
    try {
      await completeCalendarEvent(event, currentPersonId, !event.completedAt);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update that event.');
    } finally {
      setBusyId('');
    }
  }

  return <Card className="upcoming-calendar">
    <div className="section-heading"><div><CalendarClock/><h2>Coming up</h2></div><span>From Google Calendar</span></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="upcoming-calendar__list">
      {events.map((event, index) => {
        const done = Boolean(event.completedAt);
        const id = event.calendarId + ':' + event.eventId;
        return <div key={id} className={'upcoming-calendar__item' + (index === 0 && !done ? ' upcoming-calendar__item--next' : '') + (done ? ' upcoming-calendar__item--done' : '')}>
          <span className="upcoming-calendar__dot" style={{ background: event.color || '#8ba8b3' }}/>
          <div className="upcoming-calendar__details">
            <small>{when(event)} · {event.calendarName}</small>
            <strong>{event.title}</strong>
            {done && <small>Done {new Date(event.completedAt!).toLocaleString()}</small>}
          </div>
          {currentPersonId && <button className="upcoming-calendar__action" disabled={busyId === id} onClick={() => void toggle(event)}
            aria-label={(done ? 'Undo completion for ' : 'Mark done: ') + event.title}
            title={done ? 'Undo completion' : 'Mark done'}>
            {done ? <><RotateCcw size={15}/><span>Undo</span></> : <><Check size={17}/><span>Done</span></>}
          </button>}
          {!currentPersonId && <Circle className="upcoming-calendar__no-profile" size={18} aria-label="Choose a profile to mark done"/>}
        </div>;
      })}
    </div>
    {!currentPersonId && <p className="connection-note">Choose your profile to mark events as done.</p>}
    <p className="connection-note">Completion is stored in FETA, not Google Calendar. A recurring event has its own completion for each occurrence.</p>
  </Card>;
}
