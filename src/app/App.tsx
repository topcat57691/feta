import { Navigate, Route, Routes } from 'react-router-dom';
import { useAppStore } from './store';
import { AppShell } from '../components/layout/AppShell';
import { SetupPage } from '../pages/SetupPage/SetupPage';
import { WhoPage } from '../pages/WhoPage/WhoPage';
import { MePage } from '../pages/MePage/MePage';
import { HousePage } from '../pages/HousePage/HousePage';
import { AdminPage } from '../pages/AdminPage/AdminPage';

export function App() {
  const { state } = useAppStore();
  if (!state) return <Routes><Route path="*" element={<SetupPage/>}/></Routes>;
  return <Routes>
    <Route path="/display" element={<HousePage/>}/>
    <Route path="/who" element={<WhoPage/>}/>
    <Route element={<AppShell/>}>
      <Route path="/me" element={<MePage/>}/>
      <Route path="/house" element={<HousePage/>}/>
      <Route path="/admin" element={<AdminPage/>}/>
    </Route>
    <Route path="/" element={<Navigate to="/house" replace/>}/>
    <Route path="*" element={<Navigate to="/house" replace/>}/>
  </Routes>;
}
