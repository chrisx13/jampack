import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppShell from './components/AppShell';
import Dashboard from './pages/Dashboard';
import Pipeline from './pages/Pipeline';
import Clients from './pages/Clients';
import Contacts from './pages/Contacts';
import Catalogue from './pages/Catalogue';
import Settings from './pages/Settings';
import Placeholder from './pages/Placeholder';

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/companies" element={<Clients />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/catalog" element={<Catalogue />} />
          <Route path="/invoices" element={<Placeholder title="Factures" />} />
          <Route path="/calendar" element={<Placeholder title="Agenda" />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
