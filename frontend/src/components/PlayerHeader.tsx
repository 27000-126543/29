import { useGameStore } from '../store/useGameStore';

export default function PlayerHeader() {
  const player = useGameStore((state) => state.player);

  if (!player) return null;

  return (
    <header className="bg-primary/80 backdrop-blur-sm border-b border-accent/20 px-6 py-3">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-3xl">🧑‍🎣</span>
            <div>
              <div className="font-display text-lg text-white">{player.nickname}</div>
              <div className="text-sm text-accent">Lv.{player.level}</div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-gold/20 px-3 py-1.5 rounded-lg">
            <span className="text-xl">💰</span>
            <span className="font-bold text-gold">{player.gold.toLocaleString()}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-info/20 px-3 py-1.5 rounded-lg">
            <span className="text-xl">🎣</span>
            <span className="text-info text-sm">鱼竿</span>
          </div>
          <div className="flex items-center gap-2 bg-accent/20 px-3 py-1.5 rounded-lg">
            <span className="text-xl">🪱</span>
            <span className="text-accent text-sm">鱼饵</span>
          </div>
        </div>
      </div>
    </header>
  );
}
