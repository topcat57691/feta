import type { ReactNode } from 'react';
export function Pill({ children, tone = 'green' }: { children: ReactNode; tone?: 'green'|'blue'|'amber'|'grey'|'coral' }) {
  return <span className={`pill pill--${tone}`}>{children}</span>;
}
