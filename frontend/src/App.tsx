import { Routes, Route } from 'react-router-dom';
import { useGameStore } from './store/useGameStore';
import Sidebar from './components/Sidebar';
import PlayerHeader from './components/PlayerHeader';
import LoginModal from './components/LoginModal';
import FishingPage from './pages/FishingPage';
import MarketPage from './pages/MarketPage';
import CookingPage from './pages/CookingPage';
import GuildPage from './pages/GuildPage';
import TournamentPage from './pages/TournamentPage';
import LeaderboardPage from './pages/LeaderboardPage';
import ReportPage from './pages/ReportPage';

function WaterBackground() {
  const bubbles = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    size: Math.random() * 20 + 10,
    delay: Math.random() * 10,
    duration: Math.random() * 10 + 10,
  }));

  return (
    <div className="water-bg">
      {bubbles.map((b) => (
        <div
          key={b.id}
          className="bubble"
          style={{
            left: `${b.left}%`,
            width: `${b.size}px`,
            height: `${b.size}px`,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function App() {
  const player = useGameStore((state) => state.player);
  const isLoggedIn = !!player;

  return (
    <div className="min-h-screen relative">
      <WaterBackground />
      <LoginModal open={!isLoggedIn} />
      {isLoggedIn && (
        <div className="flex h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <PlayerHeader />
            <main className="flex-1 overflow-auto p-6">
              <Routes>
                <Route path="/" element={<FishingPage />} />
                <Route path="/market" element={<MarketPage />} />
                <Route path="/cooking" element={<CookingPage />} />
                <Route path="/guild" element={<GuildPage />} />
                <Route path="/tournament" element={<TournamentPage />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route path="/report" element={<ReportPage />} />
              </Routes>
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
