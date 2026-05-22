
import { useStore } from './store';
import { Lobby } from './components/Lobby';
import { Game } from './components/Game';
import { AdminPanel } from './components/admin/AdminPanel';

function App() {
  const room = useStore(state => state.room);
  const isAdminRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

  if (isAdminRoute) {
    return <AdminPanel />;
  }

  return (
    <div className="min-h-screen text-slate-100 selection:bg-cyan-500/30">
      {room?.status === 'playing' || room?.status === 'ended' ? (
        <Game />
      ) : (
        <Lobby />
      )}
    </div>
  );
}

export default App;
