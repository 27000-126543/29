import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import { useGameStore, GuildRole, ApprovalStatus } from '../store/useGameStore';

interface Guild {
  id: string;
  name: string;
  level: number;
  leaderId: string;
  admins: string[];
  members: string[];
  pondId?: string;
  pondLevel: number;
  rareFishBonus: number;
  buildingQueue: Array<{
    type: string;
    targetLevel: number;
    startTime: number;
    endTime: number;
    approvalStatus: ApprovalStatus;
  }>;
  fishStock: Array<{
    fishId: string;
    quantity: number;
    approvalStatus: ApprovalStatus;
  }>;
}

interface GuildMember {
  id: string;
  nickname: string;
  role: GuildRole;
  totalWeightCaught: number;
}

interface RecipeApproval {
  id: string;
  baitId: string;
  name: string;
  fragmentsRequired: number;
  fragmentsCollected: number;
  submittedBy: string;
  approvalStatus: ApprovalStatus;
}

type MainTab = 'members' | 'approval' | 'pond';
type ApprovalTab = 'recipe' | 'building' | 'fish';

const FISH_EMOJI: Record<string, string> = {
  common_carp: '🐟',
  grass_carp: '🐠',
  crucian: '🐟',
  roach: '🐠',
  pike: '🐡',
  catfish: '🐟',
  salmon: '🍣',
  trout: '🐟',
  rainbow_trout: '🌈',
  ghost_fish: '👻',
  tuna: '🐟',
  swordfish: '⚔️',
  marlin: '🐟',
  giant_squid: '🦑',
  leviathan: '🐉',
};

const FISH_NAMES: Record<string, string> = {
  common_carp: '普通鲤鱼',
  grass_carp: '草鱼',
  crucian: '鲫鱼',
  roach: '拟鲤',
  pike: '梭子鱼',
  catfish: '鲶鱼',
  salmon: '鲑鱼',
  trout: '鳟鱼',
  rainbow_trout: '虹鳟',
  ghost_fish: '幽灵鱼',
  tuna: '金枪鱼',
  swordfish: '剑鱼',
  marlin: '马林鱼',
  giant_squid: '巨型乌贼',
  leviathan: '利维坦',
};

const ROLE_LABEL: Record<GuildRole, string> = {
  [GuildRole.LEADER]: '👑 会长',
  [GuildRole.ADMIN]: '🛡️ 管理员',
  [GuildRole.OFFICER]: '⚔️ 干部',
  [GuildRole.MEMBER]: '👤 成员',
};

const POND_FISH: Record<number, string[]> = {
  1: ['common_carp', 'grass_carp', 'crucian'],
  2: ['common_carp', 'grass_carp', 'crucian', 'roach', 'pike'],
  3: ['common_carp', 'grass_carp', 'crucian', 'roach', 'pike', 'catfish', 'salmon', 'trout'],
  4: ['common_carp', 'grass_carp', 'crucian', 'roach', 'pike', 'catfish', 'salmon', 'trout', 'rainbow_trout', 'ghost_fish'],
  5: ['common_carp', 'grass_carp', 'crucian', 'roach', 'pike', 'catfish', 'salmon', 'trout', 'rainbow_trout', 'ghost_fish', 'tuna'],
  7: ['common_carp', 'grass_carp', 'crucian', 'roach', 'pike', 'catfish', 'salmon', 'trout', 'rainbow_trout', 'ghost_fish', 'tuna', 'swordfish', 'marlin'],
  9: ['common_carp', 'grass_carp', 'crucian', 'roach', 'pike', 'catfish', 'salmon', 'trout', 'rainbow_trout', 'ghost_fish', 'tuna', 'swordfish', 'marlin', 'giant_squid', 'leviathan'],
};

function getPondFishIds(level: number): string[] {
  if (level >= 9) return POND_FISH[9];
  if (level >= 7) return POND_FISH[7];
  if (level >= 5) return POND_FISH[5];
  if (level >= 4) return POND_FISH[4];
  if (level >= 3) return POND_FISH[3];
  if (level >= 2) return POND_FISH[2];
  return POND_FISH[1];
}

function getPondCost(level: number): { gold: number; materials: Record<string, number> } {
  const baseGold = 50000;
  const mult = Math.pow(2.5, level);
  return {
    gold: Math.floor(baseGold * mult),
    materials: {
      wood: Math.floor(100 * mult),
      stone: Math.floor(50 * mult),
      iron: Math.floor(30 * mult),
    },
  };
}

function getRoleRank(role: GuildRole): number {
  const ranks: Record<GuildRole, number> = {
    [GuildRole.MEMBER]: 0,
    [GuildRole.OFFICER]: 1,
    [GuildRole.ADMIN]: 2,
    [GuildRole.LEADER]: 3,
  };
  return ranks[role];
}

const MATERIAL_LABEL: Record<string, string> = {
  wood: '木材',
  stone: '石头',
  iron: '铁',
  silver: '银',
  gold_ore: '金矿石',
  crystal: '水晶',
  mythril: '秘银',
  dragon_scale: '龙鳞',
  ancient_rune: '远古符文',
};

export default function GuildPage() {
  const player = useGameStore((s) => s.player);
  const [guild, setGuild] = useState<Guild | null>(null);
  const [members, setMembers] = useState<GuildMember[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>('members');
  const [approvalTab, setApprovalTab] = useState<ApprovalTab>('recipe');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [joinId, setJoinId] = useState('');

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 2500);
    return () => clearTimeout(t);
  }, [message]);

  useEffect(() => {
    if (player?.guildId) {
      fetchGuild(player.guildId);
    } else {
      setGuild(null);
      setMembers([]);
    }
  }, [player?.guildId]);

  async function fetchGuild(guildId: string) {
    try {
      const data = await client.get<Guild>(`/guild/${guildId}`);
      setGuild(data);
      mockLoadMembers(data);
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || '加载公会信息失败' });
    }
  }

  function mockLoadMembers(g: Guild) {
    const list: GuildMember[] = g.members.map((mid) => {
      const isLeader = mid === g.leaderId;
      const isAdmin = g.admins.includes(mid);
      let role: GuildRole = GuildRole.MEMBER;
      if (isLeader) role = GuildRole.LEADER;
      else if (isAdmin) role = GuildRole.ADMIN;
      return {
        id: mid,
        nickname: mid === g.leaderId ? '公会会长' : `渔夫${mid.slice(0, 4)}`,
        role,
        totalWeightCaught: Math.floor(Math.random() * 5000) + 100,
      };
    });
    setMembers(list.sort((a, b) => getRoleRank(b.role) - getRoleRank(a.role)));
  }

  async function handleCreate() {
    if (!player) return;
    if (!createName.trim()) {
      setMessage({ type: 'error', text: '请输入公会名称' });
      return;
    }
    try {
      const res = await client.post('/guild/create', {
        leaderId: player.id,
        name: createName.trim(),
      });
      setMessage({ type: 'success', text: '公会创建成功！' });
      setShowCreateModal(false);
      setCreateName('');
      const newGuild = (res as any).guild as Guild;
      if (newGuild) {
        player.guildId = newGuild.id;
        player.guildRole = GuildRole.LEADER;
        player.gold -= 10000;
        useGameStore.setState({ player: { ...player } });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || '创建公会失败' });
    }
  }

  async function handleJoin() {
    if (!player) return;
    if (!joinId.trim()) {
      setMessage({ type: 'error', text: '请输入公会ID' });
      return;
    }
    try {
      await client.post(`/guild/${joinId.trim()}/join`, {
        playerId: player.id,
      });
      setMessage({ type: 'success', text: '加入公会成功！' });
      setShowJoinModal(false);
      setJoinId('');
      player.guildId = joinId.trim();
      player.guildRole = GuildRole.MEMBER;
      useGameStore.setState({ player: { ...player } });
      fetchGuild(joinId.trim());
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || '加入公会失败' });
    }
  }

  const myRole = player?.guildRole;
  const isAdmin = myRole === GuildRole.LEADER || myRole === GuildRole.ADMIN;
  const myRank = myRole ? getRoleRank(myRole) : -1;

  async function handleSetRole(targetId: string, newRole: GuildRole) {
    if (!player) return;
    setMessage({ type: 'success', text: `已${newRole === GuildRole.MEMBER ? '降职' : '提升'}成员` });
    setMembers((prev) =>
      prev.map((m) => (m.id === targetId ? { ...m, role: newRole } : m))
    );
  }

  async function handleKick(targetId: string) {
    if (!player) return;
    if (!confirm('确定要踢出该成员吗？')) return;
    setMessage({ type: 'success', text: '已踢出成员' });
    setMembers((prev) => prev.filter((m) => m.id !== targetId));
  }

  async function handleApprove(queueType: 'recipe' | 'building' | 'fish', index: number, action: 'approved' | 'rejected') {
    if (!player) return;
    try {
      const apiType = queueType === 'recipe' ? 'recipe' : queueType === 'building' ? 'building' : 'fish';
      await client.post(`/guild/approve/${apiType}/${index}`, {
        adminId: player.id,
        action,
      });
      setMessage({ type: 'success', text: action === 'approved' ? '已批准' : '已拒绝' });
      if (guild) {
        if (queueType === 'building') {
          const newQueue = [...guild.buildingQueue];
          if (newQueue[index]) newQueue[index] = { ...newQueue[index], approvalStatus: action as ApprovalStatus };
          setGuild({ ...guild, buildingQueue: newQueue });
        } else if (queueType === 'fish') {
          const newStock = [...guild.fishStock];
          if (newStock[index]) newStock[index] = { ...newStock[index], approvalStatus: action as ApprovalStatus };
          setGuild({ ...guild, fishStock: newStock });
        }
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || '操作失败' });
    }
  }

  async function handleUpgradePond() {
    if (!player || !guild) return;
    const cost = getPondCost(guild.pondLevel);
    if ((player.gold || 0) < cost.gold) {
      setMessage({ type: 'error', text: `金币不足，需要 ${cost.gold}` });
      return;
    }
    try {
      await client.post('/guild/pond/upgrade', { playerId: player.id });
      setMessage({ type: 'success', text: '鱼塘升级成功！' });
      player.gold -= cost.gold;
      useGameStore.setState({ player: { ...player } });
      if (guild) {
        const newLevel = guild.pondLevel + 1;
        setGuild({
          ...guild,
          pondLevel: newLevel,
          rareFishBonus: Math.min(0.5, newLevel * 0.05),
        });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || '升级失败' });
    }
  }

  const mockRecipes: RecipeApproval[] = useMemo(
    () => [
      { id: 'r1', baitId: 'magic_bait', name: '魔法鱼饵配方', fragmentsRequired: 20, fragmentsCollected: 15, submittedBy: '渔夫A', approvalStatus: ApprovalStatus.PENDING },
      { id: 'r2', baitId: 'ancient_lure', name: '远古诱饵配方', fragmentsRequired: 50, fragmentsCollected: 30, submittedBy: '渔夫B', approvalStatus: ApprovalStatus.PENDING },
    ],
    []
  );

  const pendingBuildings = guild?.buildingQueue.filter((b) => b.approvalStatus === ApprovalStatus.PENDING) || [];
  const pendingFish = guild?.fishStock.filter((f) => f.approvalStatus === ApprovalStatus.PENDING) || [];

  const pondFish = guild ? getPondFishIds(guild.pondLevel) : [];
  const nextPondCost = guild ? getPondCost(guild.pondLevel) : null;

  if (!guild) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="max-w-lg w-full bg-white/5 backdrop-blur rounded-3xl p-8 border border-white/10 text-center">
          <div className="text-8xl mb-6">🏰</div>
          <h1 className="text-4xl font-display text-accent font-bold mb-3">公会</h1>
          <p className="text-gray-400 mb-8">
            你还没有加入任何公会。创建自己的公会或加入朋友的公会，一起探索钓鱼的乐趣！
          </p>

          {message && (
            <div
              className={`px-4 py-2.5 rounded-lg font-medium mb-5 text-left ${
                message.type === 'success'
                  ? 'bg-accent/20 text-accent border border-accent/50'
                  : 'bg-danger/20 text-danger border border-danger/50'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => setShowCreateModal(true)}
              className="py-4 bg-gradient-to-r from-gold to-yellow-500 text-primary font-bold rounded-xl shadow-lg hover:shadow-gold/30 hover:brightness-110 transition-all"
            >
              🏗️ 创建公会
              <div className="text-xs font-normal opacity-80 mt-1">消耗 10000 金币</div>
            </button>
            <button
              onClick={() => setShowJoinModal(true)}
              className="py-4 bg-gradient-to-r from-accent to-info text-primary font-bold rounded-xl shadow-lg hover:shadow-accent/30 hover:brightness-110 transition-all"
            >
              ➕ 加入公会
              <div className="text-xs font-normal opacity-80 mt-1">输入公会ID</div>
            </button>
          </div>

          <div className="bg-primary/40 rounded-xl p-4 text-left text-sm text-gray-300">
            <div className="font-bold text-white mb-2">💡 公会福利</div>
            <ul className="space-y-1 text-gray-400">
              <li>· 专属鱼塘，独特鱼种</li>
              <li>· 稀有鱼捕获加成</li>
              <li>· 协作研究鱼饵配方</li>
              <li>· 共同升级建筑设施</li>
            </ul>
          </div>
        </div>

        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-primary border border-white/15 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-display text-accent font-bold">🏗️ 创建公会</h2>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">公会名称</label>
                  <input
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="请输入公会名称"
                    className="w-full px-3 py-2.5 bg-primary/60 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                  />
                </div>
                <div className="bg-gold/10 border border-gold/30 rounded-lg p-3 text-sm text-gold">
                  💰 创建费用：10000 金币（当前：{player?.gold || 0}）
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 bg-white/5 text-gray-300 rounded-lg font-medium hover:bg-white/10 border border-white/10"
                >
                  取消
                </button>
                <button
                  onClick={handleCreate}
                  className="flex-1 py-2.5 bg-gradient-to-r from-gold to-yellow-500 text-primary font-bold rounded-lg hover:brightness-110"
                >
                  确认创建
                </button>
              </div>
            </div>
          </div>
        )}

        {showJoinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-primary border border-white/15 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-display text-accent font-bold">➕ 加入公会</h2>
                <button onClick={() => setShowJoinModal(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">公会ID</label>
                  <input
                    type="text"
                    value={joinId}
                    onChange={(e) => setJoinId(e.target.value)}
                    placeholder="请输入公会ID"
                    className="w-full px-3 py-2.5 bg-primary/60 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 py-2.5 bg-white/5 text-gray-300 rounded-lg font-medium hover:bg-white/10 border border-white/10"
                >
                  取消
                </button>
                <button
                  onClick={handleJoin}
                  className="flex-1 py-2.5 bg-gradient-to-r from-accent to-info text-primary font-bold rounded-lg hover:brightness-110"
                >
                  确认加入
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
        <div className="flex flex-wrap items-center gap-6 justify-between">
          <div className="flex items-center gap-5">
            <div className="text-6xl">🏰</div>
            <div>
              <h1 className="text-3xl font-display text-white font-bold">{guild.name}</h1>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="text-sm px-3 py-1 bg-accent/20 text-accent rounded-full border border-accent/30">
                  Lv.{guild.level}
                </span>
                <span className="text-sm text-gray-300">
                  👑 会长: {members.find((m) => m.role === GuildRole.LEADER)?.nickname || '—'}
                </span>
                <span className="text-sm text-gray-300">👥 成员: {guild.members.length}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="text-center bg-primary/40 rounded-xl px-5 py-3 border border-white/10">
              <div className="text-xs text-gray-400">鱼塘等级</div>
              <div className="text-2xl font-bold text-info">Lv.{guild.pondLevel}</div>
            </div>
            <div className="text-center bg-primary/40 rounded-xl px-5 py-3 border border-white/10">
              <div className="text-xs text-gray-400">稀有鱼加成</div>
              <div className="text-2xl font-bold text-gold">+{Math.round(guild.rareFishBonus * 100)}%</div>
            </div>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`px-4 py-2.5 rounded-lg font-medium ${
            message.type === 'success'
              ? 'bg-accent/20 text-accent border border-accent/50'
              : 'bg-danger/20 text-danger border border-danger/50'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex gap-1.5 bg-primary/40 p-1.5 rounded-lg w-fit">
        <button
          onClick={() => setMainTab('members')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            mainTab === 'members' ? 'bg-accent text-primary shadow' : 'text-gray-300 hover:text-white hover:bg-white/5'
          }`}
        >
          👥 成员管理
        </button>
        <button
          onClick={() => setMainTab('approval')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            mainTab === 'approval' ? 'bg-accent text-primary shadow' : 'text-gray-300 hover:text-white hover:bg-white/5'
          }`}
        >
          ✅ 审批中心
        </button>
        <button
          onClick={() => setMainTab('pond')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            mainTab === 'pond' ? 'bg-accent text-primary shadow' : 'text-gray-300 hover:text-white hover:bg-white/5'
          }`}
        >
          🏰 专属鱼塘
        </button>
      </div>

      <div className="flex-1 bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 overflow-auto min-h-0">
        {mainTab === 'members' && (
          <div>
            <h2 className="text-xl font-display text-white font-bold mb-4">👥 公会成员 ({members.length})</h2>
            <div className="space-y-2">
              {members.map((m) => {
                const targetRank = getRoleRank(m.role);
                const canPromote = isAdmin && myRank > targetRank && m.role !== GuildRole.LEADER;
                const canDemote = isAdmin && myRank > targetRank && m.role !== GuildRole.LEADER && m.role !== GuildRole.MEMBER;
                const canKick = isAdmin && myRank > targetRank && m.role !== GuildRole.LEADER;
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between bg-primary/40 rounded-xl px-4 py-3 border border-white/10"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-3xl">🎣</div>
                      <div>
                        <div className="font-bold text-white flex items-center gap-2">
                          {m.nickname}
                          {m.id === player?.id && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/30 text-accent border border-accent/40">我</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-400 flex items-center gap-3 mt-0.5">
                          <span>{ROLE_LABEL[m.role]}</span>
                          <span>总重量: {m.totalWeightCaught.toFixed(1)}kg</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canPromote && m.role !== GuildRole.ADMIN && (
                        <button
                          onClick={() => {
                            const next = m.role === GuildRole.MEMBER ? GuildRole.OFFICER : m.role === GuildRole.OFFICER ? GuildRole.ADMIN : GuildRole.ADMIN;
                            handleSetRole(m.id, next);
                          }}
                          className="px-3 py-1.5 text-sm bg-accent/20 text-accent border border-accent/40 rounded-lg hover:bg-accent/30 transition-colors"
                        >
                          ⬆️ 提升
                        </button>
                      )}
                      {canDemote && (
                        <button
                          onClick={() => {
                            const prev = m.role === GuildRole.ADMIN ? GuildRole.OFFICER : GuildRole.MEMBER;
                            handleSetRole(m.id, prev);
                          }}
                          className="px-3 py-1.5 text-sm bg-info/20 text-info border border-info/40 rounded-lg hover:bg-info/30 transition-colors"
                        >
                          ⬇️ 降职
                        </button>
                      )}
                      {canKick && (
                        <button
                          onClick={() => handleKick(m.id)}
                          className="px-3 py-1.5 text-sm bg-danger/20 text-danger border border-danger/40 rounded-lg hover:bg-danger/30 transition-colors"
                        >
                          🚫 踢出
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {mainTab === 'approval' && (
          <div>
            <h2 className="text-xl font-display text-white font-bold mb-4">✅ 审批中心</h2>
            <div className="flex gap-1.5 bg-primary/40 p-1.5 rounded-lg w-fit mb-5">
              <button
                onClick={() => setApprovalTab('recipe')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  approvalTab === 'recipe' ? 'bg-accent text-primary shadow' : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                🪱 鱼饵配方
              </button>
              <button
                onClick={() => setApprovalTab('building')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  approvalTab === 'building' ? 'bg-accent text-primary shadow' : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                🏗️ 建筑升级
              </button>
              <button
                onClick={() => setApprovalTab('fish')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  approvalTab === 'fish' ? 'bg-accent text-primary shadow' : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                🐟 鱼苗投放
              </button>
            </div>

            {approvalTab === 'recipe' && (
              <div>
                {mockRecipes.length === 0 ? (
                  <div className="text-center text-gray-400 py-16">
                    <div className="text-6xl mb-3">🪱</div>
                    暂无限时审批的鱼饵配方
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mockRecipes.map((r, i) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between bg-primary/40 rounded-xl px-4 py-3 border border-white/10"
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-3xl">🪱</div>
                          <div>
                            <div className="font-bold text-white">{r.name}</div>
                            <div className="text-sm text-gray-400 flex items-center gap-3 mt-0.5">
                              <span>提交者: {r.submittedBy}</span>
                              <span>碎片: {r.fragmentsCollected}/{r.fragmentsRequired}</span>
                            </div>
                          </div>
                        </div>
                        {isAdmin && r.approvalStatus === ApprovalStatus.PENDING && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove('recipe', i, 'approved')}
                              className="px-4 py-1.5 text-sm bg-accent/20 text-accent border border-accent/40 rounded-lg hover:bg-accent/30 font-medium"
                            >
                              ✅ 批准
                            </button>
                            <button
                              onClick={() => handleApprove('recipe', i, 'rejected')}
                              className="px-4 py-1.5 text-sm bg-danger/20 text-danger border border-danger/40 rounded-lg hover:bg-danger/30 font-medium"
                            >
                              ❌ 拒绝
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {approvalTab === 'building' && (
              <div>
                {pendingBuildings.length === 0 ? (
                  <div className="text-center text-gray-400 py-16">
                    <div className="text-6xl mb-3">🏗️</div>
                    暂无待审批的建筑升级
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingBuildings.map((b, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-primary/40 rounded-xl px-4 py-3 border border-white/10"
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-3xl">🏗️</div>
                          <div>
                            <div className="font-bold text-white">{b.type} 升级至 Lv.{b.targetLevel}</div>
                            <div className="text-sm text-gray-400 mt-0.5">
                              申请时间: {new Date(b.startTime).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        {isAdmin && b.approvalStatus === ApprovalStatus.PENDING && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove('building', guild.buildingQueue.indexOf(b), 'approved')}
                              className="px-4 py-1.5 text-sm bg-accent/20 text-accent border border-accent/40 rounded-lg hover:bg-accent/30 font-medium"
                            >
                              ✅ 批准
                            </button>
                            <button
                              onClick={() => handleApprove('building', guild.buildingQueue.indexOf(b), 'rejected')}
                              className="px-4 py-1.5 text-sm bg-danger/20 text-danger border border-danger/40 rounded-lg hover:bg-danger/30 font-medium"
                            >
                              ❌ 拒绝
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {approvalTab === 'fish' && (
              <div>
                {pendingFish.length === 0 ? (
                  <div className="text-center text-gray-400 py-16">
                    <div className="text-6xl mb-3">🐟</div>
                    暂无待审批的鱼苗投放
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingFish.map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-primary/40 rounded-xl px-4 py-3 border border-white/10"
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-3xl">{FISH_EMOJI[f.fishId] || '🐟'}</div>
                          <div>
                            <div className="font-bold text-white">{FISH_NAMES[f.fishId] || f.fishId}</div>
                            <div className="text-sm text-gray-400 mt-0.5">
                              数量: x{f.quantity}
                            </div>
                          </div>
                        </div>
                        {isAdmin && f.approvalStatus === ApprovalStatus.PENDING && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove('fish', guild.fishStock.indexOf(f), 'approved')}
                              className="px-4 py-1.5 text-sm bg-accent/20 text-accent border border-accent/40 rounded-lg hover:bg-accent/30 font-medium"
                            >
                              ✅ 批准
                            </button>
                            <button
                              onClick={() => handleApprove('fish', guild.fishStock.indexOf(f), 'rejected')}
                              className="px-4 py-1.5 text-sm bg-danger/20 text-danger border border-danger/40 rounded-lg hover:bg-danger/30 font-medium"
                            >
                              ❌ 拒绝
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {mainTab === 'pond' && (
          <div>
            <div className="flex items-center justify-between mb-5 flex-wrap gap-4">
              <h2 className="text-xl font-display text-white font-bold">🏰 专属鱼塘</h2>
              <button
                onClick={handleUpgradePond}
                disabled={!isAdmin}
                className={`px-6 py-2.5 rounded-xl font-bold transition-all ${
                  isAdmin
                    ? 'bg-gradient-to-r from-gold to-yellow-500 text-primary shadow-lg hover:brightness-110'
                    : 'bg-gray-600/30 text-gray-500 cursor-not-allowed'
                }`}
              >
                ⬆️ 升级鱼塘
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-primary/40 rounded-2xl p-5 border border-white/10">
                <h3 className="text-lg font-bold text-white mb-4">📊 鱼塘信息</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">鱼塘等级</span>
                    <span className="text-2xl font-bold text-info">Lv.{guild.pondLevel}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">稀有鱼加成</span>
                    <span className="text-2xl font-bold text-gold">+{Math.round(guild.rareFishBonus * 100)}%</span>
                  </div>
                  {nextPondCost && (
                    <div className="border-t border-white/10 pt-3">
                      <div className="text-sm text-gray-300 mb-2">下一级升级消耗：</div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">💰 金币</span>
                          <span className={`font-medium ${(player?.gold || 0) >= nextPondCost.gold ? 'text-gold' : 'text-danger'}`}>
                            {nextPondCost.gold}
                          </span>
                        </div>
                        {Object.entries(nextPondCost.materials).map(([k, v]) => {
                          const owned = (player?.materials || {})[k] || 0;
                          return (
                            <div key={k} className="flex justify-between text-sm">
                              <span className="text-gray-400">📦 {MATERIAL_LABEL[k] || k}</span>
                              <span className={`font-medium ${owned >= v ? 'text-accent' : 'text-danger'}`}>
                                {owned}/{v}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-primary/40 rounded-2xl p-5 border border-white/10">
                <h3 className="text-lg font-bold text-white mb-4">🐟 当前栖息鱼种 ({pondFish.length})</h3>
                <div className="grid grid-cols-5 gap-3">
                  {pondFish.map((fid) => (
                    <div
                      key={fid}
                      className="flex flex-col items-center bg-white/5 rounded-xl p-3 border border-white/10 hover:border-accent/40 transition-colors"
                      title={FISH_NAMES[fid] || fid}
                    >
                      <div className="text-4xl mb-1">{FISH_EMOJI[fid] || '🐟'}</div>
                      <div className="text-xs text-gray-300 text-center truncate w-full">
                        {FISH_NAMES[fid] || fid}
                      </div>
                    </div>
                  ))}
                </div>
                {guild.pondLevel < 9 && (
                  <div className="mt-4 text-sm text-gray-400 text-center">
                    💡 升级鱼塘解锁更多珍稀鱼种！
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
