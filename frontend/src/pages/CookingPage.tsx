import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import { useGameStore } from '../store/useGameStore';

interface Dish {
  id: string;
  name: string;
  requiredFish: Array<{ fishId: string; quantity: number }>;
  requiredLevel: number;
  cookingTime: number;
  buffs: Array<{ stat: string; value: number; duration: number }>;
  sellPrice: number;
}

interface InventoryDish {
  id: string;
  name: string;
  quantity: number;
  buffs: Array<{ stat: string; value: number; duration: number }>;
}

interface InventoryData {
  fishes: Array<{ fishId: string; name: string; quantity: number }>;
  dishes: Array<{ dishId: string; name: string; quantity: number }>;
  materials: Array<{ materialId: string; quantity: number }>;
}

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

const DISH_EMOJI: Record<string, string> = {
  grilled_carp: '🍢',
  fish_soup: '🍜',
  sashimi_platter: '🍱',
  legendary_feast: '🎂',
};

const BUFF_LABEL: Record<string, string> = {
  strength: '力量',
  health: '生命',
  stamina: '体力',
  luck: '幸运',
  sensitivity: '灵敏度',
  rare_boost: '稀有加成',
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时`;
  return `${Math.floor(seconds / 86400)}天`;
}

function formatBuffText(buffs: Dish['buffs']): string {
  return buffs
    .map((b) => {
      const label = BUFF_LABEL[b.stat] || b.stat;
      const isPercent = b.value < 1 && b.value > 0;
      const val = isPercent ? `+${Math.round(b.value * 100)}%` : `+${b.value}`;
      return `${label}${val} ${formatDuration(b.duration)}`;
    })
    .join(' ');
}

function getExpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

export default function CookingPage() {
  const player = useGameStore((s) => s.player);
  const setPlayer = useGameStore((s) => s.setPlayer);
  const [recipes, setRecipes] = useState<Dish[]>([]);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [myDishesTab, setMyDishesTab] = useState(false);
  const [myDishes, setMyDishes] = useState<InventoryDish[]>([]);
  const [inventory, setInventory] = useState<InventoryData | null>(null);

  const refreshInventory = () => {
    if (!player?.id) return;
    client.get<InventoryData>(`/player/${player.id}/inventory`).then((data) => {
      setInventory(data);
      const dishes: InventoryDish[] = (data.dishes || []).map((d) => {
        const found = recipes.find((r) => r.id === d.dishId);
        return {
          id: d.dishId,
          name: found?.name || d.name,
          quantity: d.quantity,
          buffs: found?.buffs || [],
        };
      });
      setMyDishes(dishes);
    }).catch(() => {});
  };

  const refreshPlayerBasic = () => {
    if (!player?.id) return;
    client.get<any>(`/player/${player.id}`).then((p) => {
      setPlayer({
        id: p.id,
        nickname: p.nickname,
        level: p.level,
        exp: p.exp,
        gold: p.gold,
        cookingLevel: p.cookingLevel,
        cookingExp: p.cookingExp,
      });
    }).catch(() => {});
  };

  useEffect(() => {
    fetchRecipes();
  }, [player]);

  useEffect(() => {
    if (recipes.length > 0 && !selectedDish) {
      setSelectedDish(recipes[0]);
    }
  }, [recipes]);

  useEffect(() => {
    refreshInventory();
  }, [player?.id, recipes]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 2500);
    return () => clearTimeout(t);
  }, [message]);

  async function fetchRecipes() {
    if (!player) return;
    setLoading(true);
    try {
      const data = await client.get<Dish[]>('/cooking/recipes', {
        params: { playerId: player.id },
      });
      setRecipes(data || []);
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || '加载配方失败' });
    } finally {
      setLoading(false);
    }
  }

  const fishInventory = useMemo(() => {
    const inv: Record<string, number> = {};
    if (!inventory) return inv;
    (inventory.fishes || []).forEach((f) => {
      inv[f.fishId] = f.quantity;
    });
    return inv;
  }, [inventory]);

  const cookingLevel = player?.cookingLevel || 1;
  const cookingExp = player?.cookingExp || 0;
  const expNeeded = getExpForLevel(cookingLevel);
  const expProgress = Math.min(100, (cookingExp / expNeeded) * 100);

  function canCookDish(dish: Dish): { ok: boolean; reasons: string[] } {
    const reasons: string[] = [];
    if (!player) return { ok: false, reasons: ['未登录'] };
    if (cookingLevel < dish.requiredLevel) {
      reasons.push(`需要烹饪等级 ${dish.requiredLevel}`);
    }
    for (const req of dish.requiredFish) {
      const owned = fishInventory[req.fishId] || 0;
      if (owned < req.quantity) {
        reasons.push(`${FISH_NAMES[req.fishId] || req.fishId} 不足 (${owned}/${req.quantity})`);
      }
    }
    return { ok: reasons.length === 0, reasons };
  }

  async function handleCook(dish: Dish) {
    if (!player) return;
    const check = canCookDish(dish);
    if (!check.ok) {
      setMessage({ type: 'error', text: check.reasons.join('; ') });
      return;
    }
    try {
      const res = await client.post('/cooking/cook', {
        playerId: player.id,
        dishId: dish.id,
      });
      setMessage({ type: 'success', text: `烹饪成功！获得 ${dish.name}，经验 +${(res as any).expGained || 0}` });
      fetchRecipes();
      refreshInventory();
      refreshPlayerBasic();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || '烹饪失败' });
    }
  }

  function handleUseDish(dish: InventoryDish) {
    if (!player) return;
    const owned = myDishes.find((d) => d.id === dish.id);
    if (!owned || owned.quantity <= 0) {
      setMessage({ type: 'error', text: '料理数量不足' });
      return;
    }
    refreshInventory();
    setMessage({ type: 'success', text: `使用了 ${dish.name}！Buff 生效` });
  }

  const selectedCheck = selectedDish ? canCookDish(selectedDish) : { ok: false, reasons: [] };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display text-accent font-bold">🍳 烹饪中心</h1>
        <div className="flex items-center gap-3">
          <div className="bg-white/5 backdrop-blur rounded-xl px-4 py-2 border border-white/10 flex items-center gap-3">
            <span className="text-2xl">👨‍🍳</span>
            <div>
              <div className="text-sm text-gray-400">烹饪等级</div>
              <div className="text-lg font-bold text-accent">Lv.{cookingLevel}</div>
            </div>
            <div className="w-32">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>EXP</span>
                <span>{cookingExp}/{expNeeded}</span>
              </div>
              <div className="h-2 bg-primary rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent to-info transition-all"
                  style={{ width: `${expProgress}%` }}
                />
              </div>
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
          onClick={() => setMyDishesTab(false)}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            !myDishesTab ? 'bg-accent text-primary shadow' : 'text-gray-300 hover:text-white hover:bg-white/5'
          }`}
        >
          📖 配方制作
        </button>
        <button
          onClick={() => setMyDishesTab(true)}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            myDishesTab ? 'bg-accent text-primary shadow' : 'text-gray-300 hover:text-white hover:bg-white/5'
          }`}
        >
          🍽️ 我的料理 ({myDishes.length})
        </button>
      </div>

      {!myDishesTab ? (
        <div className="flex-1 flex gap-4 min-h-0">
          <div className="w-72 flex-shrink-0 overflow-auto pr-1 space-y-3">
            {loading ? (
              <div className="text-center text-gray-400 py-10">加载中...</div>
            ) : recipes.length === 0 ? (
              <div className="text-center text-gray-400 py-10">
                <div className="text-5xl mb-3">📖</div>
                暂无可学配方
              </div>
            ) : (
              recipes.map((dish) => {
                const check = canCookDish(dish);
                const isSelected = selectedDish?.id === dish.id;
                return (
                  <div
                    key={dish.id}
                    onClick={() => setSelectedDish(dish)}
                    className={`cursor-pointer rounded-xl p-3 border transition-all ${
                      isSelected
                        ? 'bg-accent/15 border-accent shadow-lg shadow-accent/10'
                        : 'bg-white/5 border-white/10 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-3xl flex-shrink-0">{DISH_EMOJI[dish.id] || '🍽️'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white truncate">{dish.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">所需等级: Lv.{dish.requiredLevel}</div>
                        <div className="text-[11px] text-gray-500 mt-1 line-clamp-2">
                          {formatBuffText(dish.buffs)}
                        </div>
                        <div className="mt-2">
                          {check.ok ? (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-accent/30 text-accent border border-accent/50">
                              ✓ 可制作
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-danger/20 text-danger border border-danger/40">
                              ✗ 材料不足
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex-1 bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 flex flex-col min-h-0 overflow-auto">
            {selectedDish ? (
              <div className="flex flex-col h-full">
                <div className="text-center mb-6">
                  <div className="text-8xl mb-3">{DISH_EMOJI[selectedDish.id] || '🍽️'}</div>
                  <h2 className="text-3xl font-display text-white font-bold">{selectedDish.name}</h2>
                  <div className="text-sm text-gray-400 mt-1">
                    所需烹饪等级 <span className="text-accent font-medium">Lv.{selectedDish.requiredLevel}</span>
                    <span className="mx-2">·</span>
                    烹饪时间 <span className="text-accent font-medium">{formatDuration(selectedDish.cookingTime)}</span>
                  </div>
                  <div className="mt-3 inline-block bg-accent/10 border border-accent/30 rounded-lg px-4 py-2 text-sm text-accent">
                    ✨ {formatBuffText(selectedDish.buffs)}
                  </div>
                </div>

                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-3">🐟 所需材料</h3>
                  <div className="space-y-2">
                    {selectedDish.requiredFish.map((req) => {
                      const owned = fishInventory[req.fishId] || 0;
                      const enough = owned >= req.quantity;
                      return (
                        <div
                          key={req.fishId}
                          className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                            enough
                              ? 'bg-accent/5 border-accent/30'
                              : 'bg-danger/5 border-danger/30'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{FISH_EMOJI[req.fishId] || '🐟'}</span>
                            <div>
                              <div className="font-medium text-white">
                                {FISH_NAMES[req.fishId] || req.fishId}
                              </div>
                              <div className="text-xs text-gray-400">需要 x{req.quantity}</div>
                            </div>
                          </div>
                          <div
                            className={`text-lg font-bold ${
                              enough ? 'text-accent' : 'text-danger'
                            }`}
                          >
                            {owned}/{req.quantity} {enough ? '✓' : '✗'}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {!selectedCheck.ok && selectedCheck.reasons.length > 0 && (
                    <div className="mt-4 bg-danger/10 border border-danger/30 rounded-xl p-3">
                      <div className="text-sm text-danger font-medium mb-1">无法制作原因：</div>
                      <ul className="text-xs text-danger/80 space-y-0.5 list-disc list-inside">
                        {selectedCheck.reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between gap-4">
                  <div className="text-sm text-gray-400">
                    出售价格: <span className="text-gold font-bold text-lg">💰 {selectedDish.sellPrice}</span>
                  </div>
                  <button
                    onClick={() => handleCook(selectedDish)}
                    disabled={!selectedCheck.ok}
                    className={`px-8 py-3 rounded-xl font-bold text-lg transition-all ${
                      selectedCheck.ok
                        ? 'bg-gradient-to-r from-accent to-info text-primary shadow-lg hover:shadow-accent/30 hover:brightness-110'
                        : 'bg-gray-600/30 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    🔥 开始烹饪
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <div className="text-7xl mb-4">📖</div>
                <div>请从左侧选择一个配方</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 overflow-auto">
          {myDishes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <div className="text-7xl mb-4">🍽️</div>
              <div>还没有任何料理，快去烹饪吧！</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {myDishes.map((dish) => (
                <div
                  key={dish.id}
                  className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur rounded-xl p-4 border border-white/10 hover:border-accent/40 transition-all"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="text-4xl">{DISH_EMOJI[dish.id] || '🍽️'}</div>
                    <div className="flex-1">
                      <div className="font-bold text-white">{dish.name}</div>
                      <div className="text-2xl font-bold text-gold mt-1">x{dish.quantity}</div>
                    </div>
                  </div>
                  {dish.buffs.length > 0 && (
                    <div className="text-xs text-gray-400 mb-3 bg-primary/40 rounded-lg p-2">
                      ✨ {formatBuffText(dish.buffs)}
                    </div>
                  )}
                  <button
                    onClick={() => handleUseDish(dish)}
                    className="w-full py-2 bg-gradient-to-r from-accent to-info text-primary font-bold rounded-lg hover:brightness-110 transition-all"
                  >
                    使用
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
