import type { Person } from '../../../app/types';
import { availabilityLabels } from '../../../app/store';
import { Pill } from '../../../components/ui/Pill';
import { ProgressBar } from '../../../components/ui/ProgressBar';

function initials(name: string) { return name.split(/\s+/).map((part) => part[0]).slice(0,2).join('').toUpperCase(); }

export function PersonCard({ person, compact = false }: { person: Person; compact?: boolean }) {
  const displayAvailability = person.presence === 'out' ? 'out' : person.availability;
  const tone = displayAvailability === 'drained' ? 'amber' : displayAvailability === 'out' ? 'grey' : displayAvailability === 'in-zone' ? 'blue' : 'green';
  return <article className={`person-card ${compact ? 'person-card--compact' : ''}`}>
    <div className="avatar" style={{ background: person.color }}>{initials(person.name)}</div>
    <div className="person-card__body">
      <div className="person-card__headline"><strong>{person.name}</strong><Pill tone={tone}>{availabilityLabels[displayAvailability]}</Pill></div>
      {person.presence === 'home' && <div className="person-card__capacity"><ProgressBar value={person.capacity * 20} tone={person.capacity <= 2 ? 'amber' : 'green'} /><span>{person.capacity}/5</span></div>}
      {!compact && <div className="micro-checks">
        <span className={person.daily.sleptOkay ? 'done' : ''}>Sleep</span>
        <span className={person.daily.feelingOkay ? 'done' : ''}>Okay</span>
        <span className={person.daily.vitamins ? 'done' : ''}>Basics</span>
      </div>}
    </div>
  </article>;
}
