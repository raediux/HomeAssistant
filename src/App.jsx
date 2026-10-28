import { useSession } from './contexts/AuthContext.jsx';
import { useHousehold } from './contexts/HouseholdContext.jsx';
import { ShoppingProvider } from './contexts/ShoppingContext.jsx';
import { TasksProvider } from './contexts/TasksContext.jsx';
import { MealsProvider } from './contexts/MealsContext.jsx';
import { CalendarProvider } from './contexts/CalendarContext.jsx';
import { PricesProvider } from './contexts/PricesContext.jsx';
import { UndoProvider } from './contexts/UndoContext.jsx';
import Auth from './components/Auth/Auth.jsx';
import Dashboard from './components/Dashboard/Dashboard.jsx';

function App() {
  const session = useSession();
  const household = useHousehold();

  if (session === undefined) return null;
  if (!session) return <Auth />;
  if (!household) return null;
  if (!household.id) return <div style={{ color: 'var(--text)', padding: 24 }}>Setting up your household…</div>;

  // UndoProvider must wrap the data providers: useShoppingData calls useUndo(),
  // and outside the provider it gets the no-op default, so deletes never ran.
  return (
    <UndoProvider>
      <ShoppingProvider>
        <TasksProvider>
          <MealsProvider>
            <CalendarProvider>
              <PricesProvider>
                <Dashboard />
              </PricesProvider>
            </CalendarProvider>
          </MealsProvider>
        </TasksProvider>
      </ShoppingProvider>
    </UndoProvider>
  );
}

export default App;
