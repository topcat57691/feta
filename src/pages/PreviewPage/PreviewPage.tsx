import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, FlaskConical, Home, Star } from 'lucide-react';
import { useAppStore } from '../../app/store';
import type { CalendarEvent, HouseholdState, Person } from '../../app/types';
import { flowDefinitions } from '../../features/flows/flowDefinitions';
import { buildDiaryWindow, buildRhythmMoments, buildRhythmTiles, diaryDayLabel } from '../../features/preview/previewModel';
import { PersonCard } from '../../features/people/components/PersonCard';
import './preview.css';

type LayoutMode = 'auto' | 'phone' | 'wall';
type DataMode = 'live' | 'sample';

function makeSampleEvent(dayOffset: number, hour: number, minute: number, title: string, id: string, now: Date): CalendarEvent {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hour, minute);
  const end = new Date(start.getTime() + 45 * 60_000);
  return {
    calendarId: 'sample-family', eventId: id, calendarName: 'Family',
    color: '#6b9ac4', title, startsAt: start.toISOString(), endsAt: end.toISOString(), allDay: false,
  };
}

function makeSampleState(state: HouseholdState, now: Date): HouseholdState {
  const earlier = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
  const people: Person[] = [
    { id: 'sample-alex', name: 'Alex', color: '#bcd9ee', availability: 'free', capacity: 4,
      presence: 'home', daily: { date: '', sleptOkay: true, feelingOkay: true, vitamins: true }, updatedAt: earlier(15) },
    { id: 'sample-sam', name: 'Sam', color: '#dbe6bc', availability: 'in-zone', capacity: 3,
      presence: 'home', daily: { date: '', sleptOkay: true, feelingOkay: true, vitamins: false }, updatedAt: earlier(45) },
  ];
  const load = (id: string, name: string, stateId: string, elapsed: number) => ({
    id, name, stateId, flowId: 'laundry', createdAt: earlier(elapsed + 15), updatedAt: earlier(elapsed),
  });
  return {
    ...state,
    householdName: 'Example home',
    people,
    jobs: [],
    events: [],
    flows: flowDefinitions,
    flowStates: [{ flowId: 'dishwasher', stateId: 'clean', updatedAt: earlier(85) }],
    flowEvents: [{ id: 'sample-dishwasher', flowId: 'dishwasher', fromStateId: 'running',
      toStateId: 'clean', occurredAt: earlier(85) }],
    flowInstances: [
      load('sample-wash', 'Everyday clothes', 'washing', 48),
      load('sample-dry', 'Towels', 'drying', 28),
      load('sample-wet', 'Bedding', 'wet', 65),
      load('sample-ready', 'School uniform', 'ready-to-put-away', 130),
    ],
    flowInstanceEvents: [{
      id: 'sample-move', instanceId: 'sample-wet', flowId: 'laundry', instanceName: 'Bedding',
      fromStateId: 'wash-complete', toStateId: 'wet', occurredAt: earlier(65), automatic: false,
    }],
    calendarEvents: [
      makeSampleEvent(1, 8, 0, 'Morning medication', 'med-1', now),
      makeSampleEvent(1, 16, 30, 'Swimming lesson', 'swim-1', now),
      makeSampleEvent(2, 10, 30, 'Dentist appointment', 'dentist', now),
      makeSampleEvent(2, 18, 0, 'Evening medication', 'med-2', now),
      makeSampleEvent(3, 9, 0, 'School event', 'school', now),
      makeSampleEvent(3, 17, 30, 'Family appointment', 'family', now),
      makeSampleEvent(5, 14, 0, 'Birthday party', 'party', now),
      makeSampleEvent(6, 12, 30, 'Sunday lunch', 'lunch', now),
      makeSampleEvent(9, 9, 30, 'Check-up', 'checkup', now),
    ],
  };
}

function timeLabel(event: CalendarEvent): string {
  if (event.allDay) return 'All day';
  return new Date(event.startsAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function eventKey(event: CalendarEvent): string {
  return event.calendarId + '::' + event.eventId;
}

function Snapshot({ state, now }: { state: HouseholdState; now: Date }) {
  const tiles = useMemo(() => buildRhythmTiles(state, now), [state, now]);
  const moments = useMemo(() => buildRhythmMoments(state, now), [state, now]);
  const tileLimit = 6;
  return <section className="preview-section preview-household" aria-labelledby="preview-household-title">
    <div className="preview-section__heading">
      <div><span className="preview-kicker">Short horizon · today / overnight</span><h2 id="preview-household-title">Household rhythm</h2></div>
      <span className="preview-section__caption">What's happening now?</span>
    </div>
    <div className="preview-snapshot" aria-label="Current household states">
      {tiles.slice(0, tileLimit).map((tile) => <article className={'preview-snapshot__tile' + (tile.attention ? ' preview-snapshot__tile--attention' : '')} key={tile.id}>
        <span className="preview-snapshot__emoji" aria-hidden="true">{tile.icon}</span>
        <div className="preview-snapshot__title"><strong>{tile.title}</strong><span>{tile.state}</span></div>
        <small>{tile.detail}</small>
      </article>)}
      {tiles.length > tileLimit && <div className="preview-snapshot__extra">+{tiles.length - tileLimit} more states</div>}
      {!tiles.length && <p className="preview-empty">Nothing on the go. The house is calm.</p>}
    </div>
    <div className="preview-rhythm" aria-label="Recent and upcoming household activity">
      <div className="preview-rhythm__column">
        <h3>Recently</h3>
        {moments.recent.map((item) => <div className="preview-rhythm__moment" key={item.id}>
          <span aria-hidden="true">{item.icon}</span><div><strong>{item.label}</strong><small>{item.detail} · {new Date(item.at).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'})}</small></div>
        </div>)}
        {!moments.recent.length && <small className="preview-muted">No changes in the last 3 hours</small>}
      </div>
      <div className="preview-rhythm__now"><span>NOW</span><Clock3 size={21}/></div>
      <div className="preview-rhythm__column">
        <h3>Next 12 hours</h3>
        {moments.next.map((item) => <div className="preview-rhythm__moment" key={item.id}>
          <span aria-hidden="true">{item.icon}</span><div><strong>{item.label}</strong><small>{new Date(item.at).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'})} · {item.detail}</small></div>
        </div>)}
        {!moments.next.length && <small className="preview-muted">Nothing timed is due soon</small>}
      </div>
    </div>
  </section>;
}

function Diary({
  state, now, slots, dataMode,
}: {
  state: HouseholdState; now: Date; slots: number; dataMode: DataMode;
}) {
  const [offset, setOffset] = useState(0);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [important, setImportant] = useState<Record<string, boolean>>({});
  const rail = useRef<HTMLDivElement>(null);
  const view = useMemo(
    () => buildDiaryWindow(state.calendarEvents ?? [], now, offset, slots),
    [state.calendarEvents, now, offset, slots],
  );
  useEffect(() => { rail.current?.scrollTo({ left: 0, behavior: 'auto' }); }, [offset, slots, dataMode]);
  useEffect(() => { setOffset(0); setCompleted({}); setImportant({}); }, [dataMode]);
  const later = () => setOffset((current) => Math.min(current + slots, Math.max(0, view.total - 1)));
  const earlier = () => setOffset((current) => Math.max(0, current - slots));
  const dateText = (key: string) => {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', timeZone: 'UTC',
    });
  };
  return <section className="preview-section preview-diary" aria-labelledby="preview-diary-title">
    <div className="preview-section__heading">
      <div><span className="preview-kicker">Long horizon · coming weeks</span><h2 id="preview-diary-title">Coming up</h2></div>
      <span className="preview-section__caption">What's next?</span>
    </div>
    <div className="preview-diary__top">
      <span>{view.total ? `Showing ${view.start + 1}–${view.start + view.shown} of ${view.total} upcoming` : 'Nothing upcoming in the next 3 weeks'}</span>
      <span className="preview-diary__tip">Swipe sideways to explore the visible dates</span>
    </div>
    <div className="preview-diary__rail" ref={rail} tabIndex={0} aria-label="Chronological date columns; scroll horizontally">
      {view.groups.map((group) => <div className={'preview-diary__day preview-diary__day--' + group.tier} key={group.key}>
        <header className="preview-diary__day-header">
          <strong>{group.label}</strong>
          <span>{dateText(group.key)}</span>
        </header>
        <div className="preview-diary__cards">
          {group.events.map((event) => {
            const id = eventKey(event);
            const done = completed[id] ?? Boolean(event.completedAt);
            const flagged = important[id] ?? false;
            return <article className={'preview-diary__event' + (done ? ' preview-diary__event--done' : '')} key={id}
              style={{ borderLeftColor: event.color || '#91b8c9' }}>
              <div className="preview-diary__event-time">{timeLabel(event)} <span>· {event.calendarName}</span></div>
              <strong>{event.title}</strong>
              <div className="preview-diary__actions">
                <button type="button" className={flagged ? 'is-active' : ''} aria-pressed={flagged}
                  aria-label={(flagged ? 'Unflag' : 'Flag') + ' important: ' + event.title}
                  title="Preview priority only — not saved" onClick={() => setImportant((old) => ({...old, [id]: !flagged}))}>
                  <Star size={14} fill={flagged ? 'currentColor' : 'none'}/><span>{flagged ? 'Important' : 'Priority'}</span>
                </button>
                <button type="button" className={done ? 'is-active' : ''} aria-pressed={done}
                  aria-label={(done ? 'Undo preview completion: ' : 'Preview complete: ') + event.title}
                  title="Preview completion only — not saved" onClick={() => setCompleted((old) => ({ ...old, [id]: !done }))}>
                  <Check size={14}/><span>{done ? 'Done' : 'Mark done'}</span>
                </button>
              </div>
            </article>;
          })}
        </div>
      </div>)}
      {view.remaining > 0 && <button className="preview-diary__fringe" onClick={later} type="button">
        <ChevronRight size={22}/><strong>+{view.remaining} more</strong>
        {view.nextDay && <small>{view.hiddenOnNextDay} on {diaryDayLabel(view.nextDay, now)}</small>}
      </button>}
      {!view.groups.length && <div className="preview-diary__empty">
        <CalendarDays size={24}/><strong>Nothing coming up yet</strong>
        <span>{dataMode === 'live' ? 'Choose calendars in Admin, or switch to sample data to preview the design.' : 'No sample events found.'}</span>
      </div>}
    </div>
    <div className="preview-diary__footer">
      <button type="button" onClick={earlier} disabled={view.start === 0}><ChevronLeft size={17}/> Earlier</button>
      <span>{view.shown} fixed event slots · same-day cards match</span>
      <button type="button" onClick={later} disabled={view.remaining === 0}>Later <ChevronRight size={17}/></button>
    </div>
    <p className="preview-footnote">Priority and Done are local visual experiments here. They do not change your real calendar or FETA completion history.</p>
  </section>;
}

export function PreviewPage() {
  const { state } = useAppStore();
  const [mode, setMode] = useState<LayoutMode>('auto');
  const [dataMode, setDataMode] = useState<DataMode>('live');
  const [width, setWidth] = useState(() => window.innerWidth);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const resize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', resize);
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => { window.removeEventListener('resize', resize); window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    const previous = document.title;
    document.title = 'FETA · Dashboard preview';
    const existing = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const robots = existing ?? document.createElement('meta');
    if (!existing) { robots.name = 'robots'; document.head.appendChild(robots); }
    const original = robots.content;
    robots.content = 'noindex,nofollow';
    return () => {
      document.title = previous;
      if (!existing) robots.remove(); else robots.content = original;
    };
  }, []);

  const view = useMemo(() => state ? (dataMode === 'sample' ? makeSampleState(state, now) : state) : null, [state, now, dataMode]);
  const slots = mode === 'wall' || (mode === 'auto' && width >= 1150) ? 9 : 5;

  if (!view) return null;
  return <div className="preview-shell">
    <div className="preview-lab-header">
      <div><span className="preview-lab-header__icon"><FlaskConical size={19}/></span>
        <div><strong>FETA Preview</strong><small>Experimental dashboard · unlinked route, not a separate environment</small></div>
      </div>
      <div className="preview-lab-controls">
        <label>Data <select aria-label="Preview data" value={dataMode} onChange={(event) => setDataMode(event.target.value as DataMode)}>
          <option value="live">Real data</option><option value="sample">Sample data</option>
        </select></label>
        <label>Layout <select aria-label="Preview layout" value={mode} onChange={(event) => setMode(event.target.value as LayoutMode)}>
          <option value="auto">Auto</option><option value="phone">Phone</option><option value="wall">Wall display</option>
        </select></label>
      </div>
    </div>
    <div className="preview-viewport">
      <main className={'preview-stage preview-stage--' + mode}>
        <header className="preview-dashboard-header">
          <div><span className="preview-brand"><Home size={23}/></span>
            <div><span className="preview-dashboard-eyebrow">{dataMode === 'sample' ? 'Example · not your real data' : 'Household · live read-only data'}</span>
              <h1>{view.householdName}</h1></div>
          </div>
          <div className="preview-clock"><Clock3 size={17}/><span>{now.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})} · {now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</span></div>
        </header>
        <div className="preview-people" aria-label="Household members">
          {view.people.map((person) => <PersonCard key={person.id} person={person} compact />)}
        </div>
        <div className="preview-dashboard-grid">
          <Snapshot state={view} now={now}/>
          <Diary state={view} now={now} slots={slots} dataMode={dataMode}/>
        </div>
        <p className="preview-disclaimer">Prototype only. Nothing on this page saves changes. Your existing /house and /display screens are unchanged.</p>
      </main>
    </div>
  </div>;
}
