import { useSession } from './contexts/AuthContext.jsx';
import { useHousehold } from './contexts/HouseholdContext.jsx';
import { ShoppingProvider } from './contexts/ShoppingContext.jsx';
import Auth from './components/Auth/Auth.jsx';
import Dashboard from './components/Dashboard/Dashboard.jsx';

function App() {
  const session = useSession();
  const household = useHousehold();

  if (session === undefined) return null;
  if (!session) return <Auth />;
  if (!household) return null;
  if (!household.id) return <div style={{ color: 'var(--text)', padding: 24 }}>Setting up your household…</div>;

  return <ShoppingProvider><Dashboard /></ShoppingProvider>;
}

export default App;
