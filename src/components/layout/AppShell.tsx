import { Home, Settings, UserRound } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAppStore } from '../../app/store';

export function AppShell() {
  const { currentPerson } = useAppStore();
  return <div className="app-shell">
    <main className="app-main"><Outlet /></main>
    <nav className="phone-nav" aria-label="Primary">
      <NavLink to="/me" className={({ isActive }) => isActive ? 'active' : ''}><UserRound /><span>Me</span></NavLink>
      <NavLink to="/house" className={({ isActive }) => isActive ? 'active' : ''}><Home /><span>House</span></NavLink>
      <NavLink to="/admin" className={({ isActive }) => isActive ? 'active' : ''}><Settings /><span>Admin</span></NavLink>
    </nav>
    {!currentPerson && <div className="identity-nudge">Choose who you are to record changes.</div>}
  </div>;
}
