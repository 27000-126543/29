import { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { useGameStore } from '../store/useGameStore';

type LeaderboardType = 'total_weight' | 'collection' | 'cooking_level';

interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  value: number;
  rank: number;
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  myRank?: number;
}

const TABS: { key: LeaderboardType; label: string; icon: string; unit: string }[] = [
  { key: 'total_weight', label: '总重量榜', icon: '🏋️', unit: 'kg' },
  { key: 'collection', label: '收集度', icon: '📚', unit: '种' },
  { key: 'cooking_level', label: '烹饪等级', icon: '🍳', unit: '级' },
];

const PLAYER_AVATARS = ['🧑‍🎣', '👨‍🌾', '👩‍🍳', '🧙‍♂️', '🧝‍♀️', '🦸‍♂️', '🧛‍♀️', '🤴', '👸', '🥷'];

function getAvatarByRank(rank: number): string {
  if (rank === 1) return '👑';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return PLAYER_AVATARS[(rank - 1) % PLAYER_AVATARS.length];
}

function getRankColor(rank: number): string {
  if (rank === 1) return 'text-yellow-400';
  if (rank === 2) return 'text-gray-300';
  if (rank === 3) return 'text-orange-400';
  return 'text-white';
}

function getRankBg(rank: number): string {
  if (rank === 1) return 'bg-gradient-to-b from-yellow-500/30 to-yellow-600/10 border-yellow-500/50';
  if (rank === 2) return 'bg-gradient-to-b from-gray-400/30 to-gray-500/10 border-gray-400/50';
  if (rank === 3) return 'bg-gradient-to-b from-orange-600/30 to-orange-700/10 border-orange-600/50';
  return 'bg-white/5 border-white/10';
}

export default function LeaderboardPage() {
  const player = useGameStore((s) => s.player);
  const [activeType, setActiveType] = useState<LeaderboardType>('total_weight');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const currentTab = TABS.find((t) => t.key === activeType)!;

  useEffect(() => {
    if (!player) return;
    setLoading(true);
    apiClient
      .get<LeaderboardResponse>('/leaderboard', {
        params: { type: activeType, playerId: player.id, limit: 100 },
      })
      .then((data) => {
        setEntries(data.leaderboard || []);
        setMyRank(data.myRank);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeType, player?.id]);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  const myEntry = entries.find((e) => e.playerId === player?.id);
  const myRankEntry = myEntry
    ? myEntry
    : myRank !== undefined
      ? { playerId: player?.id || '', playerName: player?.nickname || '我', value: 0, rank: myRank }
      : undefined;

  const prevEntry = myRankEntry && myRankEntry.rank > 1
    ? entries.find((e) => e.rank === myRankEntry.rank - 1)
    : undefined;
  const gap = myRankEntry && prevEntry ? prevEntry.value - myRankEntry.value : 0;

  const formatValue = (v: number): string => {
    if (activeType === 'total_weight') return v.toFixed(2);
    return String(Math.floor(v));
  };

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto relative">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveType(tab.key)}
              className={`px-6 py-3 rounded-xl font-display font-bold transition-all duration-300 ${
                activeType === tab.key
                  ? 'bg-accent text-primary shadow-lg shadow-accent/30 scale-105'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
        {myRankEntry && (
          <div className="bg-gradient-to-br from-accent/20 to-info/20 border-2 border-accent/50 rounded-2xl p-4 shadow-lg shadow-accent/20 min-w-[220px]">
            <div className="text-xs text-gray-300 mb-1">🏆 我的排名</div>
            <div className="flex items-end gap-3">
              <div>
                <div className="text-4xl font-display font-bold text-accent tabular-nums transition-all duration-500">
                  #{myRankEntry.rank}
                </div>
                <div className="text-sm text-gray-300 mt-1">
                  {formatValue(myRankEntry.value)} <span className="text-gray-500">{currentTab.unit}</span>
                </div>
              </div>
              {prevEntry && gap > 0 && (
                <div className="text-xs text-gray-400 pb-2">
                  <div className="text-info">距上一名</div>
                  <div className="font-bold text-info">
                    {formatValue(gap)} {currentTab.unit}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      )}

      {!loading && top3.length > 0 && (
        <div className="flex items-end justify-center gap-6 flex-wrap py-4">
          {top3.length >= 2 && (
            <div
              className={`relative rounded-2xl border p-6 text-center transition-all duration-300 hover:scale-105 w-56 ${getRankBg(2)}`}
            >
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-5xl">🥈</div>
              <div className="mt-8 text-5xl mb-2">{getAvatarByRank(2)}</div>
              <div className={`text-xl font-display font-bold truncate ${getRankColor(2)}`}>
                {top3[1].playerName}
              </div>
              <div className="mt-3">
                <div className="text-3xl font-display font-bold text-white tabular-nums transition-all duration-500">
                  {formatValue(top3[1].value)}
                </div>
                <div className="text-sm text-gray-400">{currentTab.unit}</div>
              </div>
            </div>
          )}
          {top3.length >= 1 && (
            <div
              className={`relative rounded-2xl border p-8 text-center transition-all duration-300 hover:scale-105 w-64 ${getRankBg(1)}`}
              style={{ transform: 'translateY(-20px)' }}
            >
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-6xl">👑</div>
              <div className="mt-10 text-6xl mb-3">{getAvatarByRank(1)}</div>
              <div className={`text-2xl font-display font-bold truncate ${getRankColor(1)}`}>
                {top3[0].playerName}
              </div>
              <div className="mt-4">
                <div className="text-4xl font-display font-bold text-white tabular-nums transition-all duration-500">
                  {formatValue(top3[0].value)}
                </div>
                <div className="text-sm text-gray-400">{currentTab.unit}</div>
              </div>
            </div>
          )}
          {top3.length >= 3 && (
            <div
              className={`relative rounded-2xl border p-6 text-center transition-all duration-300 hover:scale-105 w-56 ${getRankBg(3)}`}
            >
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-5xl">🥉</div>
              <div className="mt-8 text-5xl mb-2">{getAvatarByRank(3)}</div>
              <div className={`text-xl font-display font-bold truncate ${getRankColor(3)}`}>
                {top3[2].playerName}
              </div>
              <div className="mt-3">
                <div className="text-3xl font-display font-bold text-white tabular-nums transition-all duration-500">
                  {formatValue(top3[2].value)}
                </div>
                <div className="text-sm text-gray-400">{currentTab.unit}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && (
        <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
            <span className="text-xl">📊</span>
            <h2 className="font-display font-bold text-white text-lg">完整榜单 Top 100</h2>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {rest.length === 0 && top3.length === 0 ? (
              <div className="text-center py-16 text-gray-500">暂无排行数据</div>
            ) : (
              <div className="divide-y divide-white/5">
                {rest.map((entry) => {
                  const isMe = entry.playerId === player?.id;
                  return (
                    <div
                      key={entry.playerId}
                      className={`flex items-center px-6 py-3 transition-all duration-300 hover:bg-white/5 ${
                        isMe ? 'bg-accent/10 ring-2 ring-inset ring-accent/60' : ''
                      }`}
                    >
                      <div className={`w-12 text-center font-display font-bold text-lg ${getRankColor(entry.rank)}`}>
                        #{entry.rank}
                      </div>
                      <div className="text-2xl mx-3">{getAvatarByRank(entry.rank)}</div>
                      <div className="flex-1 font-semibold text-white">
                        {entry.playerName}
                        {isMe && (
                          <span className="ml-2 text-xs px-2 py-0.5 rounded bg-accent/30 text-accent">我</span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-display font-bold text-accent tabular-nums transition-all duration-500">
                          {formatValue(entry.value)}
                        </div>
                        <div className="text-xs text-gray-500">{currentTab.unit}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
