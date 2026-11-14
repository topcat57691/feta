export const DAY_MS = 86_400_000;

export function todayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function daysBetween(a: string | Date, b: string | Date): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / DAY_MS;
}

export function relativeTime(iso?: string, now = new Date()): string {
  if (!iso) return 'Not yet';
  const delta = now.getTime() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.round(delta / 60_000));
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days}d ago`;
  return `${Math.round(days / 7)}w ago`;
}

export function cadencePeriodDays(period: 'day' | 'week' | 'month'): number {
  return period === 'day' ? 1 : period === 'week' ? 7 : 30.4375;
}

export function formatCadence(rate: number, period: 'day' | 'week' | 'month', kind: 'session' | 'counted' | 'calendar'): string {
  if (kind === 'calendar') return 'Fixed schedule';
  if (kind === 'session') {
    const interval = cadencePeriodDays(period) / Math.max(rate, 0.01);
    if (interval < 1.5) return 'About daily';
    if (interval < 6) return `About every ${Math.round(interval)} days`;
    if (interval < 10) return 'About weekly';
    if (interval < 25) return `About every ${Math.round(interval / 7)} weeks`;
    return `About every ${Math.round(interval)} days`;
  }
  const rounded = Math.round(rate * 10) / 10;
  return `About ${rounded}/${period}`;
}

export function nextWeekday(day: number, now = new Date()): Date {
  const candidate = startOfDay(now);
  const delta = (day - candidate.getDay() + 7) % 7;
  candidate.setDate(candidate.getDate() + delta);
  if (delta === 0 && now.getHours() >= 20) candidate.setDate(candidate.getDate() + 7);
  candidate.setHours(19, 0, 0, 0);
  return candidate;
}
