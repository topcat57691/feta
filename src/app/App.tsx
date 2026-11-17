import { lazy, Suspense } from 'react';
import { Database, RefreshCw } from 'lucide-react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAppStore } from './store';
import { AppShell } from '../components/layout/AppShell';
import { SetupPage } from '../pages/SetupPage/SetupPage';
import { WhoPage } from '../pages/WhoPage/WhoPage';
import { MePage } from '../pages/MePage/MePage';
import { HousePage } from '../pages/HousePage/HousePage';
import { AdminPage } from '../pages/AdminPage/AdminPage';
import { LaundryPage } from '../pages/LaundryPage/LaundryPage';
import { Card } from '../components/ui/Card';

// Loaded only on a direct /preview visit; no entry in app navigation.
const PreviewPage = lazy(() => import('../pages/PreviewPage/PreviewPage').then((module) => ({ default: module.PreviewPage })));

export function App() {
  const { state, ready, error, refresh } = useAppStore();

  if (!ready) {
    return <div className="loading-page"><span className="brand__mark"><Database/></span><strong>Opening FETA…</strong></div>;
  }

  if (!state && error) {
    return <div className="setup-page infrastructure-page">
      <div className="setup-hero"><span className="brand__mark brand__mark--large"><Database/></span><span className="eyebrow">Shared database</span><h1>Almost there.</h1><p>The app is ready, but this deployment cannot reach its Cloudflare D1 binding yet.</p></div>
      <Card className="setup-card"><h2>Database connection needed</h2><p className="muted">{error}</p><p>Once the <strong>DB</strong> binding and migration are applied, this screen will disappear automatically.</p><button className="primary-button" onClick={() => void refresh()}><RefreshCw size={18}/>Try again</button></Card>
    </div>;
  }

  if (!state) return <Routes><Route path="*" element={<SetupPage/>}/></Routes>;

  return <Routes>
    <Route path="/display" element={<HousePage/>}/>
    <Route path="/preview" element={<Suspense fallback={<div className="loading-page">Opening preview…</div>}><PreviewPage/></Suspense>}/>
    <Route path="/who" element={<WhoPage/>}/>
    <Route element={<AppShell/>}>
      <Route path="/me" element={<MePage/>}/>
      <Route path="/house" element={<HousePage/>}/>
      <Route path="/laundry" element={<LaundryPage/>}/>
      <Route path="/admin" element={<AdminPage/>}/>
    </Route>
    <Route path="/" element={<Navigate to="/house" replace/>}/>
    <Route path="*" element={<Navigate to="/house" replace/>}/>
  </Routes>;
}
