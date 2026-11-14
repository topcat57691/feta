export function ProgressBar({ value, tone = 'green' }: { value: number; tone?: 'green'|'blue'|'amber' }) {
  const width = `${Math.max(0, Math.min(100, value))}%`;
  return <div className={`progress progress--${tone}`} aria-label={`${Math.round(value)} percent`}><span style={{ width }} /></div>;
}
