import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import { useGameStore } from '../store/useGameStore';

type WeatherType = 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'foggy' | 'snowy';
type WaterAreaType = 'lake' | 'river' | 'ocean' | 'guild';
type FishRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
type SkillType = 'lure_fish' | 'fast_reel' | 'rare_boost' | 'weight_boost' | 'none';
type InventoryTab = 'fish' | 'dish' | 'material';

interface WaterArea {
  id: string;
  name: string;
  type: WaterAreaType;
  level: number;
  description: string;
  fishIds: string[];
  weather: WeatherType;
  isGuildOnly: boolean;
  guildId?: string;
}

interface FishingRod {
  id: string;
  instanceId: string;
  name: string;
  level: number;
  supportStrength: number;
  sensitivity: number;
  lineLength: number;
  maxRarity: FishRarity;
  upgradeCost: { gold: number; materials: Record<string, number> };
}

interface BaitInfo {
  id: string;
  instanceId: string;
  name: string;
  rarityBoost: number;
  quantity: number;
  isUnlocked: boolean;
}

interface PlayerFull {
  id: string;
  nickname: string;
  level: number;
  exp: number;
  gold: number;
  rods: FishingRod[];
  baits: BaitInfo[];
  currentRodId?: string;
  currentBaitId?: string;
}

interface FishCatchResultData {
  success: boolean;
  fishId?: string;
  fishName?: string;
  rarity?: FishRarity;
  weight?: number;
  expGained?: number;
  skillUsed?: SkillType;
}

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
}

interface InventoryData {
  fishes: Array<{ fishId: string; name: string; quantity: number }>;
  dishes: Array<{ dishId: string; name: string; quantity: number }>;
  materials: Array<{ materialId: string; quantity: number }>;
}

const WATER_EMOJI: Record<WaterAreaType, string> = {
  lake: '🌊',
  river: '🏞️',
  ocean: '🌅',
  guild: '🏰',
};

const WEATHER_EMOJI: Record<WeatherType, string> = {
  sunny: '☀️',
  cloudy: '☁️',
  rainy: '🌧️',
  stormy: '⛈️',
  foggy: '🌫️',
  snowy: '❄️',
};

const RARITY_COLOR: Record<FishRarity, string> = {
  common: '#9ca3af',
  uncommon: '#10b981',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

const RARITY_LABEL: Record<FishRarity, string> = {
  common: '普通',
  uncommon: '优秀',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
};

const RARITY_GLOW: Record<FishRarity, string> = {
  common: 'glow-common',
  uncommon: 'glow-uncommon',
  rare: 'glow-rare',
  epic: 'glow-epic',
  legendary: 'glow-legendary',
};

const FISH_EMOJI_POOL = ['🐟', '🐠', '🐡', '🦈', '🐙', '🦑', '🐳', '🦐', '🦀', '🐬'];

interface SkillDef {
  type: SkillType;
  name: string;
  emoji: string;
  cooldownMs: number;
}

const SKILLS: SkillDef[] = [
  { type: 'lure_fish', name: '诱鱼', emoji: '🐟', cooldownMs: 20000 },
  { type: 'fast_reel', name: '快收', emoji: '⚡', cooldownMs: 15000 },
  { type: 'rare_boost', name: '稀有', emoji: '💎', cooldownMs: 60000 },
  { type: 'weight_boost', name: '重量', emoji: '⚖️', cooldownMs: 30000 },
  { type: 'none', name: '不使用', emoji: '🚫', cooldownMs: 0 },
];

function getFishEmoji(fishId?: string, fishName?: string): string {
  if (!fishId) return '🐟';
  let hash = 0;
  for (let i = 0; i < fishId.length; i++) {
    hash = (hash * 31 + fishId.charCodeAt(i)) >>> 0;
  }
  if (fishName) {
    for (let i = 0; i < fishName.length; i++) {
      hash = (hash * 31 + fishName.charCodeAt(i)) >>> 0;
    }
  }
  return FISH_EMOJI_POOL[hash % FISH_EMOJI_POOL.length];
}

function getMaterialEmoji(materialId: string): string {
  const low = materialId.toLowerCase();
  if (low.includes('wood') || low.includes('wood') || low.includes('木')) return '🪵';
  if (low.includes('iron') || low.includes('铁')) return '⚙️';
  if (low.includes('gold') || low.includes('金')) return '🪙';
  if (low.includes('bait') || low.includes('饵')) return '🪱';
  if (low.includes('gem') || low.includes('宝石')) return '💎';
  if (low.includes('silk') || low.includes('丝')) return '🧵';
  if (low.includes('hook') || low.includes('钩')) return '🪝';
  if (low.includes('line') || low.includes('线')) return '🧶';
  if (low.includes('reel') || low.includes('轮')) return '🎡';
  if (low.includes('scale') || low.includes('鳞')) return '✨';
  return '📦';
}

export default function FishingPage() {
  const player = useGameStore((s) => s.player);
  const setPlayer = useGameStore((s) => s.setPlayer);

  const [waterAreas, setWaterAreas] = useState<WaterArea[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [playerFull, setPlayerFull] = useState<PlayerFull | null>(null);

  const [selectedSkill, setSelectedSkill] = useState<SkillType>('none');
  const [skillCooldowns, setSkillCooldowns] = useState<Record<SkillType, number>>({
    lure_fish: 0,
    fast_reel: 0,
    rare_boost: 0,
    weight_boost: 0,
    none: 0,
  });

  const [isCasting, setIsCasting] = useState(false);
  const [ripples, setRipples] = useState<number[]>([]);
  const [catchResult, setCatchResult] = useState<FishCatchResultData | null>(null);
  const [showLoading, setShowLoading] = useState(false);

  const [inventoryTab, setInventoryTab] = useState<InventoryTab>('fish');
  const [inventory, setInventory] = useState<InventoryData | null>(null);

  const [upgradingRod, setUpgradingRod] = useState(false);

  useEffect(() => {
    client.get<WaterArea[]>('/fishing/water-areas').then((areas) => {
      setWaterAreas(areas);
      if (areas.length > 0 && !selectedAreaId) {
        setSelectedAreaId(areas[0].id);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!player?.id) return;
    client.get<PlayerFull>(`/player/${player.id}`).then((p) => {
      setPlayerFull(p);
    }).catch(() => {});
  }, [player?.id]);

  const refreshInventory = () => {
    if (!player?.id) return;
    client.get<InventoryData>(`/player/${player.id}/inventory`).then((inv) => {
      setInventory(inv);
    }).catch(() => {});
  };

  useEffect(() => {
    refreshInventory();
  }, [player?.id]);

  useEffect(() => {
    const t = setInterval(() => {
      setSkillCooldowns((prev) => {
        const next = { ...prev };
        let changed = false;
        (Object.keys(next) as SkillType[]).forEach((k) => {
          if (next[k] > 0) {
            next[k] = Math.max(0, next[k] - 500);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 500);
    return () => clearInterval(t);
  }, []);

  const currentRod = useMemo(() => {
    if (!playerFull) return null;
    return playerFull.rods.find((r) => r.id === playerFull.currentRodId) || playerFull.rods[0] || null;
  }, [playerFull]);

  const currentBait = useMemo(() => {
    if (!playerFull) return null;
    return playerFull.baits.find((b) => b.id === playerFull.currentBaitId) || playerFull.baits[0] || null;
  }, [playerFull]);

  const handleCast = () => {
    if (!player?.id || !selectedAreaId || isCasting) return;
    setIsCasting(true);
    setShowLoading(true);
    setCatchResult(null);

    const rippleId = Date.now();
    setRipples((prev) => [...prev, rippleId]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r !== rippleId));
    }, 1000);

    const body: { playerId: string; waterAreaId: string; skill?: SkillType } = {
      playerId: player.id,
      waterAreaId: selectedAreaId,
    };
    if (selectedSkill !== 'none') {
      body.skill = selectedSkill;
    }

    client.post<FishCatchResultData>('/fishing/cast', body)
      .then((result) => {
        if (selectedSkill !== 'none') {
          const skillDef = SKILLS.find((s) => s.type === selectedSkill);
          if (skillDef) {
            setSkillCooldowns((prev) => ({ ...prev, [selectedSkill]: skillDef.cooldownMs }));
          }
        }
        setTimeout(() => {
          setShowLoading(false);
          setCatchResult(result);
          setIsCasting(false);
          refreshInventory();
          if (player && result.expGained) {
            client.get<PlayerFull>(`/player/${player.id}`).then((p) => {
              setPlayerFull(p);
              setPlayer({
                id: p.id,
                nickname: p.nickname,
                level: p.level,
                exp: p.exp,
                gold: p.gold,
                currentRodId: p.currentRodId,
                currentBaitId: p.currentBaitId,
                currentWaterAreaId: selectedAreaId,
              });
            }).catch(() => {});
          }
        }, 1500);
      })
      .catch(() => {
        setShowLoading(false);
        setIsCasting(false);
      });
  };

  const handleUpgradeRod = () => {
    if (!player?.id || !currentRod || upgradingRod) return;
    setUpgradingRod(true);
    client.post('/fishing/rod/upgrade', {
      playerId: player.id,
      rodInstanceId: currentRod.instanceId,
    }).then(() => {
      client.get<PlayerFull>(`/player/${player.id}`).then((p) => {
        setPlayerFull(p);
        setPlayer({
          id: p.id,
          nickname: p.nickname,
          level: p.level,
          exp: p.exp,
          gold: p.gold,
          currentRodId: p.currentRodId,
          currentBaitId: p.currentBaitId,
          currentWaterAreaId: selectedAreaId,
        });
      }).catch(() => {});
    }).catch(() => {}).finally(() => {
      setUpgradingRod(false);
    });
  };

  const closeCatchResult = () => {
    setCatchResult(null);
  };

  const inventoryList: InventoryItem[] = useMemo(() => {
    if (!inventory) return [];
    if (inventoryTab === 'fish') {
      return inventory.fishes.map((f) => ({ id: f.fishId, name: f.name, quantity: f.quantity }));
    }
    if (inventoryTab === 'dish') {
      return inventory.dishes.map((d) => ({ id: d.dishId, name: d.name, quantity: d.quantity }));
    }
    return inventory.materials.map((m) => ({ id: m.materialId, name: m.materialId, quantity: m.quantity }));
  }, [inventory, inventoryTab]);

  return (
    <div className="h-full w-full flex flex-col bg-primary overflow-hidden">
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-primary/90 backdrop-blur-sm border-b border-accent/20 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl sm:text-3xl">🧑‍🎣</span>
            <div>
              <div className="font-display text-sm sm:text-base text-white">{player?.nickname || '游客'}</div>
              <div className="text-xs text-accent">Lv.{player?.level || 1}</div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 bg-gold/20 px-3 py-1.5 rounded-lg">
            <span className="text-lg">💰</span>
            <span className="font-bold text-gold text-sm">{(player?.gold || 0).toLocaleString()}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleUpgradeRod}
            disabled={upgradingRod || !currentRod}
            className="flex items-center gap-1.5 bg-info/20 hover:bg-info/30 disabled:opacity-50 px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors border border-info/30"
            title={currentRod ? `升级 ${currentRod.name}（Lv.${currentRod.level}）` : '无鱼竿'}
          >
            <span className="text-lg sm:text-xl">🎣</span>
            <div className="hidden sm:block text-left">
              <div className="text-xs text-info font-semibold">{currentRod?.name || '鱼竿'}</div>
              <div className="text-[10px] text-info/70">Lv.{currentRod?.level || 1} · 点击升级</div>
            </div>
            <span className="sm:hidden text-[10px] text-info/80">Lv.{currentRod?.level || 1}</span>
          </button>
          <div className="flex items-center gap-1.5 bg-accent/20 px-2.5 sm:px-3 py-1.5 rounded-lg border border-accent/30">
            <span className="text-lg sm:text-xl">🪱</span>
            <div className="hidden sm:block text-left">
              <div className="text-xs text-accent font-semibold">{currentBait?.name || '鱼饵'}</div>
              <div className="text-[10px] text-accent/70">数量: {currentBait?.quantity ?? 0}</div>
            </div>
            <span className="sm:hidden text-[10px] text-accent/80">x{currentBait?.quantity ?? 0}</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="px-4 sm:px-6 py-3 flex-shrink-0 border-b border-white/5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm sm:text-base font-display text-white flex items-center gap-2">
                <span>🗺️</span>
                <span>选择水域</span>
              </h2>
              <span className="text-xs text-gray-400">横向滑动查看更多</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              {waterAreas.map((area) => {
                const isSelected = area.id === selectedAreaId;
                return (
                  <button
                    key={area.id}
                    onClick={() => setSelectedAreaId(area.id)}
                    className={`flex-shrink-0 w-40 sm:w-44 rounded-xl p-3 sm:p-4 text-left transition-all duration-300 border-2 ${
                      isSelected
                        ? 'border-accent bg-accent/15 shadow-lg'
                        : 'border-white/10 bg-white/5 hover:border-accent/40 hover:bg-white/10'
                    }`}
                    style={isSelected ? { boxShadow: '0 0 20px rgba(26, 188, 156, 0.3)' } : undefined}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-3xl sm:text-4xl">{WATER_EMOJI[area.type] || '�'}</span>
                      <div className="text-right">
                        <div className="text-lg">{WEATHER_EMOJI[area.weather]}</div>
                        <div className="text-[10px] text-gray-400 capitalize">{area.weather}</div>
                      </div>
                    </div>
                    <div className="font-display text-white text-sm sm:text-base mb-1 truncate">{area.name}</div>
                    <div className="flex items-center gap-2 text-[10px] sm:text-xs">
                      <span className="bg-info/30 text-info px-2 py-0.5 rounded-full">Lv.{area.level}</span>
                      {area.isGuildOnly && (
                        <span className="bg-danger/30 text-danger px-2 py-0.5 rounded-full">公会</span>
                      )}
                    </div>
                  </button>
                );
              })}
              {waterAreas.length === 0 && (
                <div className="text-gray-400 text-sm py-4 px-2">加载水域中...</div>
              )}
            </div>
          </div>

          <div className="flex-1 relative flex items-center justify-center overflow-hidden min-h-0">
            <div className="absolute inset-0 pointer-events-none">
              <svg className="w-full h-full" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
                <defs>
                  <radialGradient id="waterGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(26, 188, 156, 0.25)" />
                    <stop offset="100%" stopColor="rgba(26, 188, 156, 0)" />
                  </radialGradient>
                </defs>
                <circle cx="200" cy="200" r="200" fill="url(#waterGlow)" />
                <g className="ring-spin-slow" style={{ transformOrigin: '200px 200px' }}>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <circle
                      key={i}
                      cx="200"
                      cy="200"
                      r={60 + i * 25}
                      fill="none"
                      stroke="rgba(26, 188, 156, 0.15)"
                      strokeWidth="1.5"
                      strokeDasharray={`${8 + i * 2} ${12 + i * 3}`}
                    />
                  ))}
                </g>
              </svg>
            </div>

            <div className="relative w-[320px] h-[320px] sm:w-[420px] sm:h-[420px]">
              {SKILLS.map((skill, idx) => {
                const angle = (idx / SKILLS.length) * 2 * Math.PI - Math.PI / 2;
                const radius = typeof window !== 'undefined' && window.innerWidth < 640 ? 125 : 165;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                const isSelected = selectedSkill === skill.type;
                const cooldownLeft = skillCooldowns[skill.type] || 0;
                const onCooldown = cooldownLeft > 0;
                const cooldownPct = skill.cooldownMs > 0 ? (cooldownLeft / skill.cooldownMs) * 100 : 0;
                return (
                  <button
                    key={skill.type}
                    onClick={() => !onCooldown && setSelectedSkill(skill.type)}
                    disabled={onCooldown}
                    className={`absolute w-14 h-14 sm:w-16 sm:h-16 rounded-full flex flex-col items-center justify-center transition-all duration-300 border-2 ${
                      isSelected
                        ? 'skill-selected border-accent bg-accent/30 scale-110'
                        : onCooldown
                        ? 'border-gray-600 bg-gray-800/60 opacity-60 cursor-not-allowed'
                        : 'border-white/20 bg-white/10 hover:border-accent/60 hover:bg-accent/15 hover:scale-105'
                    }`}
                    style={{
                      left: `calc(50% + ${x}px)`,
                      top: `calc(50% + ${y}px)`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <span className="text-xl sm:text-2xl leading-none">{skill.emoji}</span>
                    <span className="text-[9px] sm:text-[10px] text-white/80 mt-0.5">{skill.name}</span>
                    {onCooldown && (
                      <svg
                        className="absolute inset-0 -rotate-90 pointer-events-none"
                        viewBox="0 0 100 100"
                      >
                        <circle
                          cx="50"
                          cy="50"
                          r="46"
                          fill="none"
                          stroke="#1abc9c"
                          strokeWidth="4"
                          strokeDasharray={`${(1 - cooldownPct / 100) * 289} 289`}
                          opacity="0.7"
                        />
                      </svg>
                    )}
                    {onCooldown && (
                      <span className="absolute text-[10px] text-white font-bold bg-black/50 rounded px-1">
                        {Math.ceil(cooldownLeft / 1000)}s
                      </span>
                    )}
                  </button>
                );
              })}

              <button
                onClick={handleCast}
                disabled={isCasting || !player || !selectedAreaId}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 sm:w-48 sm:h-48 rounded-full font-display text-white text-xl sm:text-2xl font-bold transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed pulse-glow active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 50%, #0d7377 100%)',
                  boxShadow: '0 0 40px rgba(26, 188, 156, 0.5), inset 0 -4px 12px rgba(0,0,0,0.2), inset 0 4px 12px rgba(255,255,255,0.1)',
                }}
              >
                <div className="flex flex-col items-center justify-center">
                  <span className="text-4xl sm:text-5xl mb-1">🎣</span>
                  <span>{isCasting ? '抛竿中...' : '抛竿'}</span>
                </div>
                {ripples.map((rid) => (
                  <span
                    key={rid}
                    className="absolute inset-0 rounded-full border-4 border-accent/60 ripple pointer-events-none"
                  />
                ))}
              </button>
            </div>

            {showLoading && !catchResult && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20">
                <div className="flex flex-col items-center">
                  <div className="text-7xl bobber-dip mb-4">🎣</div>
                  <div className="text-accent font-display text-xl sm:text-2xl mb-2">浮漂下沉...</div>
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2.5 h-2.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2.5 h-2.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {catchResult && (
              <div
                onClick={closeCatchResult}
                className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-30 cursor-pointer p-4"
              >
                <div
                  className={`relative max-w-sm w-full rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-primary to-primary/95 border-4 fade-in-up ${
                    catchResult.success && catchResult.rarity ? RARITY_GLOW[catchResult.rarity] : ''
                  }`}
                  style={{
                    borderColor: catchResult.success && catchResult.rarity
                      ? RARITY_COLOR[catchResult.rarity]
                      : '#666',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {catchResult.success && catchResult.fishName ? (
                    <>
                      <div className="text-center mb-4">
                        <div className="text-[11px] uppercase tracking-widest text-gray-400 mb-1">🐟 钓获成功</div>
                        <div className="flex items-center justify-center gap-2 mb-3">
                          <span
                            className="text-xs sm:text-sm font-bold px-3 py-1 rounded-full"
                            style={{
                              backgroundColor: catchResult.rarity ? `${RARITY_COLOR[catchResult.rarity]}22` : '#333',
                              color: catchResult.rarity ? RARITY_COLOR[catchResult.rarity] : '#999',
                              border: `1px solid ${catchResult.rarity ? RARITY_COLOR[catchResult.rarity] : '#555'}`,
                            }}
                          >
                            {catchResult.rarity ? RARITY_LABEL[catchResult.rarity] : '未知'}
                          </span>
                        </div>
                        <div className="text-7xl sm:text-8xl mb-3 float-slow inline-block">
                          {getFishEmoji(catchResult.fishId, catchResult.fishName)}
                        </div>
                        <h3
                          className="font-display text-2xl sm:text-3xl mb-1"
                          style={{ color: catchResult.rarity ? RARITY_COLOR[catchResult.rarity] : '#fff' }}
                        >
                          {catchResult.fishName}
                        </h3>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-5">
                        <div className="bg-white/5 rounded-xl p-3 text-center border border-white/10">
                          <div className="text-xs text-gray-400 mb-1">重量</div>
                          <div className="text-xl sm:text-2xl font-bold text-white">
                            {catchResult.weight?.toFixed(2)}
                            <span className="text-xs ml-1 text-gray-400">kg</span>
                          </div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-3 text-center border border-white/10">
                          <div className="text-xs text-gray-400 mb-1">获得 EXP</div>
                          <div className="text-xl sm:text-2xl font-bold text-accent">
                            +{catchResult.expGained}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-6">
                      <div className="text-6xl mb-3">💨</div>
                      <h3 className="font-display text-2xl text-gray-300 mb-2">什么也没钓到...</h3>
                      <p className="text-sm text-gray-500">再试一次吧！</p>
                    </div>
                  )}
                  <button
                    onClick={closeCatchResult}
                    className="w-full py-3 rounded-xl bg-accent hover:bg-accent/80 text-white font-display text-lg transition-colors"
                  >
                    继续钓鱼
                  </button>
                  <div className="text-center text-[11px] text-gray-500 mt-3">点击任意位置关闭</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-white/10 bg-primary/60 backdrop-blur-sm flex flex-col flex-shrink-0 max-h-[50vh] lg:max-h-none">
          <div className="flex border-b border-white/10 flex-shrink-0">
            {([
              { key: 'fish', label: '鱼获', emoji: '🐟' },
              { key: 'dish', label: '料理', emoji: '🍳' },
              { key: 'material', label: '材料', emoji: '📦' },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setInventoryTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-display transition-colors ${
                  inventoryTab === tab.key
                    ? 'text-accent border-b-2 border-accent bg-accent/10'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="text-lg">{tab.emoji}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {inventoryList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 py-12">
                <div className="text-5xl mb-3 opacity-50">
                  {inventoryTab === 'fish' ? '🐟' : inventoryTab === 'dish' ? '🍽️' : '📦'}
                </div>
                <div className="text-sm">暂无{itemLabel(inventoryTab)}</div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2">
                {inventoryList.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-2.5 sm:p-3 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-2xl sm:text-3xl">
                        {inventoryTab === 'fish'
                          ? getFishEmoji(item.id, item.name)
                          : inventoryTab === 'dish'
                          ? '🍲'
                          : getMaterialEmoji(item.name)}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-accent bg-accent/15 px-1.5 py-0.5 rounded-full">
                        x{item.quantity}
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm text-white/90 truncate" title={item.name}>
                      {item.name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function itemLabel(tab: InventoryTab): string {
  if (tab === 'fish') return '鱼获';
  if (tab === 'dish') return '料理';
  return '材料';
}
