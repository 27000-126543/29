import { useState } from 'react';
import { useGameStore, SimplifiedPlayer } from '../store/useGameStore';
import client from '../api/client';
import { ws } from '../api/ws';

interface Props {
  open: boolean;
}

export default function LoginModal({ open }: Props) {
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const setPlayer = useGameStore((state) => state.setPlayer);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    setLoading(true);
    try {
      const { player, token } = await client.post<{ player: SimplifiedPlayer; token: string }>('/player/login', { nickname: nickname.trim() });
      localStorage.setItem('fishing_token', token);
      setPlayer(player);
      ws.connect(player.id);
    } catch (error) {
      console.error('Login failed:', error);
      const mockPlayer = {
        id: 'local-' + Date.now(),
        nickname: nickname.trim(),
        level: 1,
        exp: 0,
        gold: 1000,
        currentWaterAreaId: 'default',
      };
      setPlayer(mockPlayer);
      ws.connect(mockPlayer.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-primary border border-accent/30 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎣</div>
          <h2 className="text-3xl font-display text-accent font-bold">欢迎来到钓鱼帝国</h2>
          <p className="text-gray-400 mt-2">请输入你的昵称开始冒险</p>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="输入你的昵称"
            className="w-full bg-primary/50 border border-accent/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition mb-6"
            maxLength={20}
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || !nickname.trim()}
            className="w-full bg-accent hover:bg-accent/90 disabled:bg-accent/50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-all duration-200 text-lg"
          >
            {loading ? '登录中...' : '开始钓鱼 🚀'}
          </button>
        </form>
      </div>
    </div>
  );
}
