import { useState, useEffect, type FormEvent } from 'react';
import { Check, Plus, History, ListTodo, CalendarDays, Home, Undo2 } from 'lucide-react';
import type { HouseholdState } from '../../app/types';
import { todayKey } from '../../lib/date';
import { activeTodos, buildPreviewHistory, type CalendarMarks, type PreviewData, type PreviewTodo, type HistoryItem } from './previewTasks';

function initialData(sample: boolean): PreviewData {
  const now = new Date().toISOString();
  return { calendarMarks: {}, todos: sample ? [
    { id: 'photos', title: 'Collect photos', createdAt: now },
    { id: 'garage', title: 'Phone the garage', createdAt: now },
    { id: 'library', title: 'Return library books', createdAt: now },
    { id: 'parcel', title: 'Post parcel', createdAt: now, completedAt: now },
  ] : [] };
}

export function usePreviewData(key: string, sample: boolean) {
  const [data, setData] = useState<PreviewData>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as PreviewData;
        if (Array.isArray(parsed.todos) && parsed.calendarMarks && typeof parsed.calendarMarks === 'object') return parsed;
      }
    } catch { /* Browser storage may be unavailable. */ }
    return initialData(sample);
  });
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(data)); setStorageError(false); }
    catch { setStorageError(true); }
  }, [key, data]);
  const add = (title: string) => setData((old) => ({ ...old, todos: [...old.todos,
    { id: crypto.randomUUID(), title, createdAt: new Date().toISOString() }],
  }));
  const complete = (id: string) => setData((old) => ({ ...old, todos: old.todos.map((todo) =>
    todo.id === id ? { ...todo, completedAt: new Date().toISOString() } : todo) }));
  const markCalendar = (id: string) => setData((old) => ({ ...old, calendarMarks: { ...old.calendarMarks, [id]: new Date().toISOString() } }));
  const undo = (item: NonNullable<HistoryItem['undo']>) => setData((old) => {
    if (item.kind === 'todo') return { ...old, todos: old.todos.map((todo) =>
      todo.id === item.id ? { ...todo, completedAt: undefined } : todo) };
    const calendarMarks: CalendarMarks = { ...old.calendarMarks };
    delete calendarMarks[item.id];
    return { ...old, calendarMarks };
  });
  return { data, storageError, add, complete, markCalendar, undo };
}

export function TodoPanel({ todos, add, complete }: {
  todos: PreviewTodo[]; add: (title: string) => void; complete: (id: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const active = activeTodos(todos);
  const submitted = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = draft.trim();
    if (!title) return;
    add(title); setDraft(''); setAnnouncement(title + ' added to your to-do list.');
  };
  return <section className="preview-section preview-todos" aria-labelledby="preview-todo-title">
    <div className="preview-section__heading">
      <div><span className="preview-kicker">Flexible · no fixed time</span><h2 id="preview-todo-title">To-do</h2></div>
      <span className="preview-section__caption">{active.length ? active.length + ' to do' : 'All clear'}</span>
    </div>
    <form className="preview-todo-form" onSubmit={submitted}>
      <input aria-label="New to-do" placeholder="Something to do…" maxLength={140} value={draft} onChange={(event) => setDraft(event.target.value)}/>
      <button type="submit" disabled={!draft.trim()}><Plus size={18}/> Add</button>
    </form>
    <div className="preview-todo-list">
      {(expanded ? active : active.slice(0, 5)).map((todo) => <div className="preview-todo-row" key={todo.id}>
        <button type="button" className="preview-todo-check" aria-label={'Complete: ' + todo.title}
          onClick={() => { complete(todo.id); setAnnouncement(todo.title + ' moved to History.'); }}><Check size={18}/></button>
        <span>{todo.title}</span>
      </div>)}
      {!active.length && <div className="preview-todo-empty"><ListTodo size={21}/> Nothing on your list right now.</div>}
      {active.length > 5 && <button className="preview-text-button" type="button" onClick={() => setExpanded(!expanded)}>
        {expanded ? 'Show fewer' : 'Show ' + (active.length - 5) + ' more'}
      </button>}
    </div>
    <p className="preview-footnote">Unfinished tasks carry forward each day. No artificial deadlines.</p>
    <span className="preview-sr-only" role="status">{announcement}</span>
  </section>;
}

export function HistoryPanel({ state, data, now, undo }: {
  state: HouseholdState; data: PreviewData; now: Date; undo: (item: NonNullable<HistoryItem['undo']>) => void;
}) {
  const [filter, setFilter] = useState<'all' | HistoryItem['kind']>('all');
  const [limit, setLimit] = useState(30);
  const [announcement, setAnnouncement] = useState('');
  const historyNow = new Date(Math.max(now.getTime(), Date.now()));
  const rows = buildPreviewHistory(state, data, historyNow).filter((row) => filter === 'all' || row.kind === filter);
  const icons = { todo: ListTodo, calendar: CalendarDays, household: Home };
  const groups = new Map<string, HistoryItem[]>();
  for (const row of rows.slice(0, limit)) {
    const key = todayKey(new Date(row.at));
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  return <section className="preview-section preview-history" aria-labelledby="preview-history-title">
    <div className="preview-section__heading"><div><span className="preview-kicker">Out of the way, not lost</span>
      <h2 id="preview-history-title">History</h2></div><History size={20}/></div>
    <div className="preview-history-filters" aria-label="Filter history">
      {(['all', 'todo', 'household', 'calendar'] as const).map((kind) => <button key={kind} type="button"
        aria-pressed={filter === kind} onClick={() => { setFilter(kind); setLimit(30); }}>
        {{ all: 'All', todo: 'To-dos', household: 'Household', calendar: 'Calendar' }[kind]}
      </button>)}
    </div>
    {!rows.length && <p className="preview-empty">Nothing in this history yet.</p>}
    {[...groups.entries()].map(([day, entries]) => <div key={day} className="preview-history-group">
      <h3>{day === todayKey(now) ? 'Today' : day === todayKey(yesterday) ? 'Yesterday' : new Date(entries[0].at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</h3>
      {entries.map((row) => { const Icon = icons[row.kind]; return <article className="preview-history-row" key={row.id}>
        <span className="preview-history-icon"><Icon size={18}/></span>
        <div><strong>{row.title}</strong><small>{row.detail} · {new Date(row.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</small></div>
        {row.undo && <button type="button" className="preview-text-button" aria-label={'Restore: ' + row.title}
          onClick={() => { if (row.undo) { undo(row.undo); setAnnouncement(row.title + ' restored to the dashboard.'); } }}><Undo2 size={16}/> Restore</button>}
      </article>; })}
    </div>)}
    {rows.length > limit && <button className="preview-text-button" type="button" onClick={() => setLimit(limit + 30)}>Show more history</button>}
    <p className="preview-footnote">Calendar history covers the available recent sync window (normally seven days). An ended event is not necessarily attended.</p>
    <span className="preview-sr-only" role="status">{announcement}</span>
  </section>;
}
