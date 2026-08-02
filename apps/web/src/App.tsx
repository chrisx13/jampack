import AppShell from './components/AppShell';

// L'IHM adopte le modèle de navigation type VS Code : la navigation (grands domaines,
// sous-domaines, onglets) est gérée par AppShell — plus de routage central react-router.
export default function App() {
  return <AppShell />;
}
