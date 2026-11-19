export type SuggestionKind = 'event' | 'task';
export type SuggestionStatus = 'pending' | 'approved' | 'dismissed';
export interface Suggestion {
  id: string; kind: SuggestionKind; title: string; date: string | null;
  time: string | null; endTime: string | null; detail: string; status: SuggestionStatus;
}
export interface EmailReview {
  id: string; sender: string; subject: string; receivedAt: string;
  sourceUrl: string | null; summary: string; suggestions: Suggestion[];
  status: 'pending' | 'reviewed';
}
export function allowedSender(address: string, subject: string, preview = ''): boolean {
  const normalized = address.toLowerCase().trim();
  if (normalized === 'password-reset@arbor-education.com') return false;
  const domain = normalized.split('@').pop();
  if (/password|passcode|verification code|security code|one.time code|account activat|activate your|create your .*login|sign.in code|reset your|magic link/i.test(subject + ' ' + preview)) return false;
  return domain === 'abbeyfarmet.org.uk' || domain === 'tapestryjournal.com' ||
    domain === 'arbor-education.com' ||
    (address.toLowerCase() === 'noreply@swindon.gov.uk' && /school|admissions|abbey farm/i.test(subject));
}
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validTime(value: unknown): value is string {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}
export function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/https?:\/\/\S+/gi, '[link removed]').trim().slice(0,max) : '';
}
export function parseExtraction(raw: unknown): Pick<EmailReview,'summary'|'suggestions'> {
  const value = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>;
  if (!value || typeof value !== 'object' || !clean(value.summary, 1000) || !Array.isArray(value.suggestions)) throw new Error('Invalid AI extraction');
  const suggestions: Suggestion[] = [];
  for (const source of value.suggestions.slice(0, 8)) {
    if (!source || typeof source !== 'object') continue;
    const item = source as Record<string, unknown>;
    if (item.kind !== 'event' && item.kind !== 'task') continue;
    const title = clean(item.title, 150);
    if (!title) continue;
    const date = validDate(item.date) ? item.date : null;
    // An undated event cannot be added to a diary; keep it as a task to confirm.
    const kind = item.kind === 'event' && !date ? 'task' : item.kind;
    const time = validTime(item.time) && date ? item.time : null;
    const endTime = validTime(item.endTime) && time && item.endTime > time ? item.endTime : null;
    suggestions.push({ id: crypto.randomUUID(), kind, title, date, time, endTime,
      detail: clean(item.detail, 500), status: 'pending' });
  }
  return { summary: clean(value.summary, 1000), suggestions };
}
