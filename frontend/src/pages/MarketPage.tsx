import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import { useGameStore, FishRarity } from '../store/useGameStore';

type ItemType = 'fish' | 'dish' | 'bait' | 'rod' | 'material';

interface TradeListing {
  id: string;
  sellerId: string;
  sellerName: string;
  itemType: ItemType;
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: string;
  createdAt: number;
  expiresAt: number;
  suggestedPriceRange?: { min: number; max: number };
}

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

const BAIT_EMOJI: Record<string, string> = {
  earthworm: '🪱',
  shrimp: '🦐',
  bread: '🍞',
  magic_bait: '✨',
  ancient_lure: '🏺',
};

const ITEM_EMOJI: Record<ItemType, string> = {
  fish: '🐟',
  dish: '🍳',
  bait: '🪱',
  rod: '🎣',
  material: '📦',
};

const RARITY_STYLES: Record<string, string> = {
  common: 'bg-gray-500/30 text-gray-300 border-gray-500',
  uncommon: 'bg-green-500/30 text-green-300 border-green-500',
  rare: 'bg-blue-500/30 text-blue-300 border-blue-500',
  epic: 'bg-purple-500/30 text-purple-300 border-purple-500',
  legendary: 'bg-gold/30 text-gold border-gold',
};

const RARITY_LABEL: Record<string, string> = {
  common: '普通',
  uncommon: '优秀',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
};

const FISH_RARITY: Record<string, string> = {
  common_carp: FishRarity.COMMON,
  grass_carp: FishRarity.COMMON,
  crucian: FishRarity.COMMON,
  roach: FishRarity.COMMON,
  pike: FishRarity.UNCOMMON,
  catfish: FishRarity.UNCOMMON,
  salmon: FishRarity.RARE,
  trout: FishRarity.RARE,
  rainbow_trout: FishRarity.EPIC,
  ghost_fish: FishRarity.EPIC,
  tuna: FishRarity.RARE,
  swordfish: FishRarity.EPIC,
  marlin: FishRarity.EPIC,
  giant_squid: FishRarity.LEGENDARY,
  leviathan: FishRarity.LEGENDARY,
};

interface TabItem {
  key: ItemType | 'all';
  label: string;
  emoji: string;
}

const TABS: TabItem[] = [
  { key: 'all', label: '全部', emoji: '📋' },
  { key: 'fish', label: '鱼', emoji: '🐟' },
  { key: 'dish', label: '料理', emoji: '🍳' },
  { key: 'bait', label: '鱼饵', emoji: '🪱' },
  { key: 'material', label: '材料', emoji: '📦' },
];

function getItemEmoji(item: TradeListing): string {
  if (item.itemType === 'fish') return FISH_EMOJI[item.itemId] || '🐟';
  if (item.itemType === 'dish') return DISH_EMOJI[item.itemId] || '🍳';
  if (item.itemType === 'bait') return BAIT_EMOJI[item.itemId] || '🪱';
  return ITEM_EMOJI[item.itemType];
}

function getRarity(item: TradeListing): string {
  if (item.itemType === 'fish') return FISH_RARITY[item.itemId] || 'common';
  return 'common';
}

interface InventoryItem {
  key: string;
  itemType: ItemType;
  itemId: string;
  itemName: string;
  quantity: number;
}

interface InventoryData {
  fishes: Array<{ fishId: string; name: string; quantity: number }>;
  dishes: Array<{ dishId: string; name: string; quantity: number }>;
  materials: Array<{ materialId: string; quantity: number }>;
}

export default function MarketPage() {
  const player = useGameStore((s) => s.player);
  const [listings, setListings] = useState<TradeListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ItemType | 'all'>('all');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [search, setSearch] = useState('');
  const [showListModal, setShowListModal] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [selectedListing, setSelectedListing] = useState<TradeListing | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [listItemType, setListItemType] = useState<ItemType>('fish');
  const [listItemId, setListItemId] = useState<string>('');
  const [listQuantity, setListQuantity] = useState<string>('1');
  const [listUnitPrice, setListUnitPrice] = useState<string>('');
  const [suggestedPrice, setSuggestedPrice] = useState<{ min: number; max: number } | null>(null);

  const [buyQuantity, setBuyQuantity] = useState<string>('1');

  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  const refreshInventory = () => {
    if (!player?.id) return;
    client.get<InventoryData>(`/player/${player.id}/inventory`).then((data) => {
      const items: InventoryItem[] = [];
      (data.fishes || []).forEach((f) =>
        items.push({
          key: `fish_${f.fishId}`,
          itemType: 'fish',
          itemId: f.fishId,
          itemName: f.name,
          quantity: f.quantity,
        })
      );
      (data.dishes || []).forEach((d) =>
        items.push({
          key: `dish_${d.dishId}`,
          itemType: 'dish',
          itemId: d.dishId,
          itemName: d.name,
          quantity: d.quantity,
        })
      );
      (data.materials || []).forEach((m) => {
        let t: ItemType = 'material';
        if (m.materialId.startsWith('bait_')) t = 'bait';
        items.push({
          key: m.materialId,
          itemType: t,
          itemId: m.materialId,
          itemName: m.materialId,
          quantity: m.quantity,
        });
      });
      setInventory(items.filter((it) => it.quantity > 0));
    }).catch(() => {});
  };

  useEffect(() => {
    refreshInventory();
  }, [player?.id]);

  const filteredInventory = useMemo(() => {
    return inventory.filter((it) => it.itemType === listItemType);
  }, [inventory, listItemType]);

  useEffect(() => {
    fetchListings();
  }, [activeTab, minPrice, maxPrice, search]);

  async function fetchListings() {
    if (!player) return;
    setLoading(true);
    try {
      const params: Record<string, any> = {};
      if (activeTab !== 'all') params.itemType = activeTab;
      if (minPrice) params.minPrice = Number(minPrice);
      if (maxPrice) params.maxPrice = Number(maxPrice);
      const data = await client.get<TradeListing[]>('/market/listings', { params });
      let filtered = data || [];
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        filtered = filtered.filter((l) => l.itemName.toLowerCase().includes(q));
      }
      setListings(filtered);
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || '加载商品失败' });
    } finally {
      setLoading(false);
    }
  }

  async function fetchSuggestedPrice() {
    if (!listItemType || !listItemId) {
      setSuggestedPrice(null);
      return;
    }
    try {
      const data = await client.get<{ min: number; max: number }>('/market/suggested-price', {
        params: { itemType: listItemType, itemId: listItemId },
      });
      setSuggestedPrice(data);
    } catch (e) {
      setSuggestedPrice(null);
    }
  }

  useEffect(() => {
    fetchSuggestedPrice();
  }, [listItemType, listItemId]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 2500);
    return () => clearTimeout(t);
  }, [message]);

  function openBuyModal(listing: TradeListing) {
    setSelectedListing(listing);
    setBuyQuantity('1');
    setShowBuyModal(true);
  }

  async function handleBuy() {
    if (!selectedListing || !player) return;
    const qty = Number(buyQuantity);
    if (!qty || qty <= 0) {
      setMessage({ type: 'error', text: '请输入有效数量' });
      return;
    }
    try {
      await client.post(`/market/listings/${selectedListing.id}/buy`, {
        buyerId: player.id,
        quantity: qty,
      });
      setMessage({ type: 'success', text: '购买成功！' });
      setShowBuyModal(false);
      fetchListings();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || '购买失败' });
    }
  }

  function openListModal() {
    setListItemType('fish');
    setListItemId('');
    setListQuantity('1');
    setListUnitPrice('');
    setSuggestedPrice(null);
    setShowListModal(true);
  }

  async function handleList() {
    if (!player) return;
    if (!listItemId) {
      setMessage({ type: 'error', text: '请选择物品' });
      return;
    }
    const qty = Number(listQuantity);
    const price = Number(listUnitPrice);
    if (!qty || qty <= 0) {
      setMessage({ type: 'error', text: '请输入有效数量' });
      return;
    }
    if (!price || price <= 0) {
      setMessage({ type: 'error', text: '请输入有效单价' });
      return;
    }
    try {
      await client.post('/market/listings', {
        sellerId: player.id,
        itemType: listItemType,
        itemId: listItemId,
        quantity: qty,
        unitPrice: price,
      });
      setMessage({ type: 'success', text: '上架成功！' });
      setShowListModal(false);
      fetchListings();
      refreshInventory();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || '上架失败' });
    }
  }

  const buyQty = Number(buyQuantity) || 0;
  const buyTotal = selectedListing ? selectedListing.unitPrice * buyQty : 0;
  const buyFee = Math.floor(buyTotal * 0.05);
  const buyFinal = buyTotal + buyFee;

  const selectedInvItem = filteredInventory.find((it) => it.itemId === listItemId);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display text-accent font-bold">🛒 交易市场</h1>
        <button
          onClick={openListModal}
          className="px-5 py-2.5 bg-gradient-to-r from-gold to-yellow-500 text-primary font-bold rounded-lg shadow-lg hover:shadow-gold/30 hover:brightness-110 transition-all"
        >
          我要上架
        </button>
      </div>

      {message && (
        <div
          className={`px-4 py-2.5 rounded-lg font-medium ${
            message.type === 'success' ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-danger/20 text-danger border border-danger/50'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex gap-1.5 bg-primary/40 p-1.5 rounded-lg">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === t.key ? 'bg-accent text-primary shadow' : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">价格</span>
            <input
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="最小"
              className="w-20 px-3 py-1.5 bg-primary/60 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent"
            />
            <span className="text-gray-500">-</span>
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="最大"
              className="w-20 px-3 py-1.5 bg-primary/60 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex-1 min-w-[200px] max-w-sm">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索物品名称..."
                className="w-full pl-9 pr-3 py-1.5 bg-primary/60 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <button
            onClick={fetchListings}
            className="px-4 py-1.5 bg-accent/20 text-accent border border-accent/40 rounded-lg text-sm font-medium hover:bg-accent/30 transition-colors"
          >
            刷新
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">加载中...</div>
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-gray-400 gap-3">
            <div className="text-6xl">🎣</div>
            <div>暂无商品，快去上架或钓鱼吧！</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {listings.map((item) => {
              const rarity = getRarity(item);
              return (
                <div
                  key={item.id}
                  className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur rounded-xl p-4 border border-white/10 hover:border-accent/40 transition-all flex flex-col gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-4xl flex-shrink-0">{getItemEmoji(item)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white truncate">{item.itemName}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded border ${RARITY_STYLES[rarity]}`}
                        >
                          {RARITY_LABEL[rarity]}
                        </span>
                        <span className="text-xs text-gray-400">卖家: {item.sellerName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-primary/40 rounded-lg p-2.5 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">单价</span>
                      <span className="text-lg font-bold text-gold">💰 {item.unitPrice}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">数量</span>
                      <span className="text-sm text-white font-medium">x{item.quantity}</span>
                    </div>
                    {item.suggestedPriceRange && (
                      <div className="text-xs text-gray-500 pt-1 border-t border-white/5">
                        建议价 {item.suggestedPriceRange.min} ~ {item.suggestedPriceRange.max}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => openBuyModal(item)}
                    className="w-full py-2.5 bg-gradient-to-r from-gold to-yellow-500 text-primary font-bold rounded-lg shadow-lg hover:shadow-gold/30 hover:brightness-110 transition-all"
                  >
                    购买
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-primary border border-white/15 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-display text-accent font-bold">📦 上架商品</h2>
              <button
                onClick={() => setShowListModal(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1.5">物品类型</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['fish', 'dish', 'bait', 'material'] as ItemType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setListItemType(t);
                        setListItemId('');
                      }}
                      className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                        listItemType === t
                          ? 'bg-accent text-primary'
                          : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      {ITEM_EMOJI[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1.5">选择物品</label>
                <select
                  value={listItemId}
                  onChange={(e) => setListItemId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-primary/60 border border-white/10 rounded-lg text-white focus:outline-none focus:border-accent"
                >
                  <option value="">-- 请选择 --</option>
                  {filteredInventory.length === 0 ? (
                    <option value="" disabled>
                      （背包中无此类型物品）
                    </option>
                  ) : (
                    filteredInventory.map((it) => (
                      <option key={it.key} value={it.itemId}>
                        {it.itemId} (x{it.quantity})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">数量</label>
                  <input
                    type="number"
                    min={1}
                    max={selectedInvItem?.quantity || 1}
                    value={listQuantity}
                    onChange={(e) => setListQuantity(e.target.value)}
                    className="w-full px-3 py-2.5 bg-primary/60 border border-white/10 rounded-lg text-white focus:outline-none focus:border-accent"
                  />
                  {selectedInvItem && (
                    <div className="text-xs text-gray-500 mt-1">最大: {selectedInvItem.quantity}</div>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">单价</label>
                  <input
                    type="number"
                    min={1}
                    value={listUnitPrice}
                    onChange={(e) => setListUnitPrice(e.target.value)}
                    placeholder="金币"
                    className="w-full px-3 py-2.5 bg-primary/60 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              {suggestedPrice && (
                <div className="bg-accent/10 border border-accent/30 rounded-lg p-3">
                  <div className="text-sm text-gray-300 mb-1">💡 市场建议价</div>
                  <div className="text-lg font-bold text-accent">
                    💰 {suggestedPrice.min} ~ {suggestedPrice.max}
                  </div>
                </div>
              )}

              {listUnitPrice && listQuantity && (
                <div className="bg-white/5 rounded-lg p-3 flex justify-between items-center">
                  <span className="text-sm text-gray-300">预计总价</span>
                  <span className="text-xl font-bold text-gold">
                    💰 {Number(listUnitPrice) * (Number(listQuantity) || 0)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowListModal(false)}
                className="flex-1 py-2.5 bg-white/5 text-gray-300 rounded-lg font-medium hover:bg-white/10 transition-colors border border-white/10"
              >
                取消
              </button>
              <button
                onClick={handleList}
                className="flex-1 py-2.5 bg-gradient-to-r from-gold to-yellow-500 text-primary font-bold rounded-lg shadow-lg hover:brightness-110 transition-all"
              >
                确认上架
              </button>
            </div>
          </div>
        </div>
      )}

      {showBuyModal && selectedListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-primary border border-white/15 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-display text-accent font-bold">🛒 购买商品</h2>
              <button
                onClick={() => setShowBuyModal(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-4 mb-5 p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="text-5xl">{getItemEmoji(selectedListing)}</div>
              <div className="flex-1">
                <div className="text-xl font-bold text-white">{selectedListing.itemName}</div>
                <div className="text-sm text-gray-400">卖家: {selectedListing.sellerName}</div>
                <div className="text-gold font-bold mt-1">💰 {selectedListing.unitPrice} / 件</div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1.5">
                  购买数量 (库存: {selectedListing.quantity})
                </label>
                <input
                  type="number"
                  min={1}
                  max={selectedListing.quantity}
                  value={buyQuantity}
                  onChange={(e) => setBuyQuantity(e.target.value)}
                  className="w-full px-3 py-2.5 bg-primary/60 border border-white/10 rounded-lg text-white focus:outline-none focus:border-accent"
                />
              </div>

              <div className="bg-white/5 rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">商品总价</span>
                  <span className="text-white font-medium">💰 {buyTotal}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">交易手续费 (5%)</span>
                  <span className="text-danger font-medium">💰 {buyFee}</span>
                </div>
                <div className="border-t border-white/10 pt-2 flex justify-between items-center">
                  <span className="text-gray-300 font-medium">应付总计</span>
                  <span className="text-2xl font-bold text-gold">💰 {buyFinal}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowBuyModal(false)}
                className="flex-1 py-2.5 bg-white/5 text-gray-300 rounded-lg font-medium hover:bg-white/10 transition-colors border border-white/10"
              >
                取消
              </button>
              <button
                onClick={handleBuy}
                className="flex-1 py-2.5 bg-gradient-to-r from-gold to-yellow-500 text-primary font-bold rounded-lg shadow-lg hover:brightness-110 transition-all"
              >
                确认购买
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
