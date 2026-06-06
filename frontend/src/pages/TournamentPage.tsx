import { useState, useEffect, useRef } from 'react';
import apiClient from '../api/client';
import { useGameStore } from '../store/useGameStore';
import dayjs from 'dayjs';

interface Tournament {
  id: string;
  name: string;
  status: 'upcoming' | 'registration' | 'in_progress' | 'finished' | 'cancelled';
  waterAreaId: string;
  startTime: number;
  endTime: number;
  duration: number;
  maxParticipants: number;
  participants: TournamentParticipant[];
  rewards: TournamentRewards;
}

interface TournamentParticipant {
  playerId: string;
  playerName: string;
  totalWeight: number;
  rarityScore: number;
  totalScore: number;
  rank?: number;
}

interface TournamentRewards {
  top3: Array<{
    blueprints: string[];
    rareBaits: Record<string, number>;
    gold: number;
    materials: Record<string, number>;
  }>;
  participants: {
    gold: number;
    materials: Record<string, number>;
  };
}

type LeaderboardEntry = TournamentParticipant & { prevValue?: number };

const STATUS_TEXT: Record<string, string> = {
  upcoming: '即将开始',
  registration: '报名中',
  in_progress: '进行中',
  finished: '已结束',
  cancelled: '已取消',
};

const STATUS_COLOR: Record<string, string> = {
  upcoming: 'bg-info/20 text-info border-info/40',
  registration: 'bg-gold/20 text-gold border-gold/40',
  in_progress: 'bg-accent/20 text-accent border-accent/40',
  finished: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
  cancelled: 'bg-danger/20 text-danger border-danger/40',
};

function formatCountdown(ms: number): { days: string; hours: string; minutes: string; seconds: string } {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return {
    days: String(days).padStart(2, '0'),
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
  };
}

function getRankBg(rank: number): string {
  if (rank === 1) return 'bg-gradient-to-r from-yellow-600/30 to-yellow-500/20';
  if (rank === 2) return 'bg-gradient-to-r from-gray-400/30 to-gray-300/20';
  if (rank === 3) return 'bg-gradient-to-r from-orange-700/30 to-orange-600/20';
  return 'bg-white/5';
}

function getRankMedal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return String(rank);
}

export default function TournamentPage() {
  const player = useGameStore((s) => s.player);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [activeTab, setActiveTab] = useState<'in_progress' | 'upcoming'>('in_progress');
  const [selectedId, setSelectedId] = useState<string>('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [now, setNow] = useState(Date.now());
  const [registering, setRegistering] = useState(false);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const prevValuesRef = useRef<Record<string, { totalWeight: number; rarityScore: number; totalScore: number }>>({});

  useEffect(() => {
    apiClient.get<Tournament[]>('/tournaments').then((data) => {
      setTournaments(data || []);
      if (data && data.length > 0) {
        const active = data.find((t) => t.status === 'in_progress') || data[0];
        setSelectedId(active.id);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const fetch = () => {
      apiClient.get<TournamentParticipant[]>(`/tournaments/${selectedId}/leaderboard`, {
        params: { limit: 50 },
      }).then((data) => {
        const entries = data || [];
        const newFlashIds = new Set<string>();
        const mapped: LeaderboardEntry[] = entries.map((e, idx) => {
          const rank = e.rank ?? idx + 1;
          const prev = prevValuesRef.current[e.playerId];
          if (prev) {
            if (prev.totalWeight !== e.totalWeight) newFlashIds.add(e.playerId + '-w');
            if (prev.rarityScore !== e.rarityScore) newFlashIds.add(e.playerId + '-r');
            if (prev.totalScore !== e.totalScore) newFlashIds.add(e.playerId + '-s');
          }
          prevValuesRef.current[e.playerId] = {
            totalWeight: e.totalWeight,
            rarityScore: e.rarityScore,
            totalScore: e.totalScore,
          };
          return { ...e, rank };
        });
        setLeaderboard(mapped);
        if (newFlashIds.size > 0) {
          setFlashIds(newFlashIds);
          setTimeout(() => setFlashIds(new Set()), 800);
        }
      }).catch(() => {});
    };
    fetch();
    const timer = setInterval(fetch, 1000);
    return () => clearInterval(timer);
  }, [selectedId]);

  const selectedTournament = tournaments.find((t) => t.id === selectedId);

  const filteredTournaments = tournaments.filter((t) => {
    if (activeTab === 'in_progress') return t.status === 'in_progress' || t.status === 'registration';
    return t.status === 'upcoming';
  });

  const countdown = selectedTournament
    ? selectedTournament.status === 'upcoming' || selectedTournament.status === 'registration'
      ? formatCountdown(selectedTournament.startTime - now)
      : selectedTournament.status === 'in_progress'
        ? formatCountdown(selectedTournament.endTime - now)
        : formatCountdown(0)
    : formatCountdown(0);

  const countdownLabel = selectedTournament
    ? selectedTournament.status === 'in_progress'
      ? '比赛剩余时间'
      : selectedTournament.status === 'upcoming' || selectedTournament.status === 'registration'
        ? '距离大赛开始'
        : '大赛已结束'
    : '加载中...';

  const isRegistered = selectedTournament?.participants.some((p) => p.playerId === player?.id) ?? false;

  const handleRegister = async () => {
    if (!selectedTournament || !player) return;
    setRegistering(true);
    try {
      await apiClient.post(`/tournaments/${selectedTournament.id}/register`, { playerId: player.id });
      alert('报名成功！');
    } catch (e: any) {
      alert(e.message || '报名失败');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto">
      {selectedTournament && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-[#0d3257] to-primary border border-accent/30 p-6">
          <div className="absolute inset-0 opacity-30 pointer-events-none">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="bubble"
                style={{
                  left: `${(i * 8) % 100}%`,
                  bottom: `-20px`,
                  width: `${6 + (i % 4) * 4}px`,
                  height: `${6 + (i % 4) * 4}px`,
                  animationDuration: `${8 + (i % 5)}s`,
                  animationDelay: `${(i % 7) * 0.8}s`,
                }}
              />
            ))}
          </div>
          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-4xl">🏆</span>
                <h1 className="text-3xl font-display font-bold text-white">{selectedTournament.name}</h1>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${STATUS_COLOR[selectedTournament.status]}`}>
                  {STATUS_TEXT[selectedTournament.status]}
                </span>
              </div>
              <p className="text-gray-400 mb-4">{countdownLabel}</p>
              <div className="flex gap-3">
                {(['days', 'hours', 'minutes', 'seconds'] as const).map((unit, idx) => (
                  <div key={unit} className="flex items-center">
                    <div className="bg-black/40 border border-accent/30 rounded-xl px-4 py-3 min-w-[72px] text-center">
                      <div className="text-3xl font-display font-bold text-accent tabular-nums transition-all duration-300">
                        {countdown[unit]}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {unit === 'days' ? '天' : unit === 'hours' ? '时' : unit === 'minutes' ? '分' : '秒'}
                      </div>
                    </div>
                    {idx < 3 && <span className="mx-1 text-2xl text-accent/50 font-bold">:</span>}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {selectedTournament.status === 'registration' && (
                <button
                  onClick={handleRegister}
                  disabled={registering || isRegistered}
                  className={`px-8 py-4 rounded-xl font-display font-bold text-lg transition-all duration-300 ${
                    isRegistered
                      ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-gold to-yellow-500 text-primary hover:shadow-lg hover:shadow-gold/30 hover:scale-105 active:scale-95'
                  }`}
                >
                  {isRegistered ? '✓ 已报名' : registering ? '报名中...' : '🎯 立即报名'}
                </button>
              )}
              {selectedTournament.status === 'in_progress' && (
                <button className="px-8 py-4 rounded-xl font-display font-bold text-lg bg-gradient-to-r from-accent to-info text-primary hover:shadow-lg hover:shadow-accent/30 hover:scale-105 active:scale-95 transition-all duration-300">
                  👁 观战模式
                </button>
              )}
              {selectedTournament.status === 'upcoming' && (
                <div className="px-8 py-4 rounded-xl font-display font-bold text-lg bg-info/20 text-info border border-info/40 text-center">
                  ⏰ 即将开始
                </div>
              )}
              {selectedTournament.status === 'finished' && (
                <div className="px-8 py-4 rounded-xl font-display font-bold text-lg bg-gray-500/20 text-gray-300 border border-gray-500/40 text-center">
                  🏁 已结束
                </div>
              )}
              <div className="text-sm text-gray-400 text-center">
                参与人数 {selectedTournament.participants.length}/{selectedTournament.maxParticipants}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {[
          { key: 'in_progress', label: '进行中 / 报名中', icon: '🎣' },
          { key: 'upcoming', label: '即将开始', icon: '⏳' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-6 py-3 rounded-xl font-display font-bold transition-all duration-300 ${
              activeTab === tab.key
                ? 'bg-accent text-primary shadow-lg shadow-accent/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {filteredTournaments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTournaments.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className={`text-left p-4 rounded-xl border transition-all duration-300 ${
                selectedId === t.id
                  ? 'bg-accent/10 border-accent/60 shadow-lg shadow-accent/20'
                  : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-display font-bold text-white">{t.name}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs border ${STATUS_COLOR[t.status]}`}>
                  {STATUS_TEXT[t.status]}
                </span>
              </div>
              <div className="text-sm text-gray-400">
                {dayjs(t.startTime).format('MM/DD HH:mm')} - {dayjs(t.endTime).format('MM/DD HH:mm')}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {t.participants.length}/{t.maxParticipants} 人参与
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedTournament && (
        <>
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🏅</span>
              <h2 className="text-2xl font-display font-bold text-white">实时排行榜</h2>
              <span className="text-sm text-gray-400 ml-2">每秒刷新</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-400 text-sm border-b border-white/10">
                    <th className="px-4 py-3 w-20">排名</th>
                    <th className="px-4 py-3">玩家昵称</th>
                    <th className="px-4 py-3 text-right">总重量 (kg)</th>
                    <th className="px-4 py-3 text-right">稀有度分</th>
                    <th className="px-4 py-3 text-right">总分</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-gray-500">
                        暂无排行数据
                      </td>
                    </tr>
                  ) : (
                    leaderboard.map((entry) => (
                      <tr
                        key={entry.playerId}
                        className={`border-b border-white/5 transition-all duration-300 ${getRankBg(entry.rank ?? 999)} ${
                          entry.playerId === player?.id ? 'ring-2 ring-accent/50' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span className="text-xl font-bold">{getRankMedal(entry.rank ?? 999)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">🧑‍🎣</span>
                            <span className="font-semibold text-white">{entry.playerName}</span>
                            {entry.playerId === player?.id && (
                              <span className="text-xs px-2 py-0.5 rounded bg-accent/20 text-accent">我</span>
                            )}
                          </div>
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-mono tabular-nums transition-all duration-500 ${
                            flashIds.has(entry.playerId + '-w')
                              ? 'text-accent scale-110 font-bold'
                              : 'text-white'
                          }`}
                        >
                          {entry.totalWeight.toFixed(2)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-mono tabular-nums transition-all duration-500 ${
                            flashIds.has(entry.playerId + '-r')
                              ? 'text-gold scale-110 font-bold'
                              : 'text-white'
                          }`}
                        >
                          {entry.rarityScore.toFixed(1)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-mono tabular-nums transition-all duration-500 ${
                            flashIds.has(entry.playerId + '-s')
                              ? 'text-info scale-110 font-bold'
                              : 'text-accent font-bold'
                          }`}
                        >
                          {entry.totalScore.toFixed(1)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <div className="flex items-center gap-2 mb-6">
              <span className="text-2xl">🎁</span>
              <h2 className="text-2xl font-display font-bold text-white">奖励预览</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {selectedTournament.rewards.top3.map((reward, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl p-5 border transition-all duration-300 hover:scale-105 ${
                    idx === 0
                      ? 'bg-gradient-to-br from-yellow-600/20 to-yellow-500/5 border-yellow-500/40'
                      : idx === 1
                        ? 'bg-gradient-to-br from-gray-400/20 to-gray-300/5 border-gray-400/40'
                        : 'bg-gradient-to-br from-orange-700/20 to-orange-600/5 border-orange-600/40'
                  }`}
                >
                  <div className="text-center mb-4">
                    <span className="text-4xl">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                    <div className="font-display font-bold text-white mt-2">
                      第 {idx + 1} 名
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    {reward.blueprints.length > 0 && (
                      <div className="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2">
                        <span className="text-gray-300">📜 图纸</span>
                        <span className="text-info font-bold">x{reward.blueprints.length}</span>
                      </div>
                    )}
                    {Object.keys(reward.rareBaits).length > 0 && (
                      <div className="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2">
                        <span className="text-gray-300">🪱 稀有鱼饵</span>
                        <span className="text-accent font-bold">
                          x{Object.values(reward.rareBaits).reduce((a, b) => a + b, 0)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2">
                      <span className="text-gray-300">💰 金币</span>
                      <span className="text-gold font-bold">{reward.gold.toLocaleString()}</span>
                    </div>
                    {Object.keys(reward.materials).length > 0 && (
                      <div className="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2">
                        <span className="text-gray-300">📦 材料</span>
                        <span className="text-white font-bold">
                          x{Object.values(reward.materials).reduce((a, b) => a + b, 0)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div className="rounded-xl p-5 border bg-gradient-to-br from-accent/20 to-accent/5 border-accent/40 transition-all duration-300 hover:scale-105">
                <div className="text-center mb-4">
                  <span className="text-4xl">🎯</span>
                  <div className="font-display font-bold text-white mt-2">参与奖励</div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2">
                    <span className="text-gray-300">💰 金币</span>
                    <span className="text-gold font-bold">
                      {selectedTournament.rewards.participants.gold.toLocaleString()}
                    </span>
                  </div>
                  {Object.keys(selectedTournament.rewards.participants.materials).length > 0 && (
                    <div className="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2">
                      <span className="text-gray-300">📦 材料</span>
                      <span className="text-white font-bold">
                        x{Object.values(selectedTournament.rewards.participants.materials).reduce((a, b) => a + b, 0)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
