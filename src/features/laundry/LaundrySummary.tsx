import { Link } from 'react-router-dom';
import type { FlowDefinition, FlowInstance } from '../../app/types';
import { laundryStats, laundryTiming } from './laundry';

export function LaundrySummary({
  loads, flow, now, interactive = true,
}: {
  loads: FlowInstance[];
  flow: FlowDefinition | undefined;
  now: Date;
  interactive?: boolean;
}) {
  const stats = laundryStats(loads);
  const applianceDetail = (load?: FlowInstance): string => {
    if (!load) return 'Available';
    if (load.stateId === 'wash-complete' || load.stateId === 'dryer-complete') return 'Finished · unload';
    const timing = laundryTiming(load, flow, now);
    return timing.remainingMinutes === null ? 'In progress'
      : timing.remainingMinutes === 0 ? 'Time elapsed' : timing.remainingMinutes + 'm left';
  };
  return <div className="laundry-summary">
    <div className="laundry-summary__heading">
      <span aria-hidden>🧺</span>
      <div><strong>Laundry</strong><small>{stats.total === 0 ? 'Nothing on the go' : stats.total + ' active load' + (stats.total === 1 ? '' : 's')}</small></div>
      {interactive && <Link to="/laundry" className="laundry-summary__link">View loads</Link>}
    </div>
    {stats.total > 0 && <div className="laundry-summary__grid">
      <div><span>🫧 Washer</span><strong>{applianceDetail(stats.washing)}</strong></div>
      <div><span>🌬️ Dryer</span><strong>{applianceDetail(stats.drying)}</strong></div>
      <div><span>💧 Wet</span><strong>{stats.wet}</strong></div>
      <div><span>👕 To put away</span><strong>{stats.ready}</strong></div>
    </div>}
    {(stats.waiting > 0 || stats.airDrying > 0) && <small className="laundry-summary__other">
      {stats.waiting > 0 && stats.waiting + ' waiting to wash'}
      {stats.waiting > 0 && stats.airDrying > 0 && ' · '}
      {stats.airDrying > 0 && stats.airDrying + ' air drying'}
    </small>}
  </div>;
}
