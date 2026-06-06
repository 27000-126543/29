import { v4 as uuidv4 } from 'uuid';
import { DataStore } from '../store/DataStore';
import { EventBus } from '../events/EventBus';
import { TradeListing } from '../types/interfaces';
import { ListingStatus } from '../types/enums';

export class TradeMarketSystem {
  private store: DataStore;
  private eventBus: EventBus;
  private listingDuration: number = 7 * 24 * 60 * 60 * 1000;
  private recentTradeWindow: number = 7 * 24 * 60 * 60 * 1000;

  constructor(store: DataStore, eventBus: EventBus) {
    this.store = store;
    this.eventBus = eventBus;
  }

  getSuggestedPrice(itemType: TradeListing['itemType'], itemId: string): {
    min: number;
    max: number;
    avg: number;
    median: number;
    sampleSize: number;
  } {
    const now = Date.now();
    const cutoff = now - this.recentTradeWindow;

    const prices: number[] = [];
    this.store.tradeHistory.forEach((trade) => {
      if (
        trade.itemType === itemType &&
        trade.itemId === itemId &&
        trade.timestamp >= cutoff
      ) {
        prices.push(trade.price);
      }
    });

    if (prices.length === 0) {
      const fallback = this.getFallbackPrice(itemType, itemId);
      return {
        min: Math.floor(fallback * 0.8),
        max: Math.ceil(fallback * 1.2),
        avg: fallback,
        median: fallback,
        sampleSize: 0,
      };
    }

    const sorted = [...prices].sort((a, b) => a - b);
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const stdDev = Math.sqrt(prices.reduce((s, p) => s + Math.pow(p - avg, 2), 0) / prices.length);

    return {
      min: Math.max(1, Math.floor(median - stdDev)),
      max: Math.ceil(median + stdDev * 2),
      avg: Math.round(avg),
      median,
      sampleSize: prices.length,
    };
  }

  private getFallbackPrice(itemType: TradeListing['itemType'], itemId: string): number {
    if (itemType === 'fish') {
      const fish = this.store.fishSpecies.get(itemId);
      return fish?.basePrice || 10;
    }
    if (itemType === 'dish') {
      const dish = this.store.dishes.get(itemId);
      return dish?.sellPrice || 50;
    }
    if (itemType === 'bait') {
      const bait = this.store.baitTemplates.get(itemId);
      const rarityMult = bait?.rarityBoost || 0;
      return Math.floor(10 * (1 + rarityMult * 10));
    }
    return 100;
  }

  createListing(
    sellerId: string,
    itemType: TradeListing['itemType'],
    itemId: string,
    quantity: number,
    unitPrice: number
  ): {
    success: boolean;
    listing?: TradeListing;
    suggestedRange?: { min: number; max: number };
    reason?: string;
  } {
    const seller = this.store.players.get(sellerId);
    if (!seller) return { success: false, reason: '卖家不存在' };

    const inventoryKey = this.getInventoryKey(itemType, itemId);
    const owned = seller.inventory[inventoryKey] || 0;
    if (owned < quantity) {
      return { success: false, reason: `物品不足，需要 ${quantity}，拥有 ${owned}` };
    }

    if (quantity <= 0 || unitPrice <= 0) {
      return { success: false, reason: '数量和价格必须大于0' };
    }

    const suggested = this.getSuggestedPrice(itemType, itemId);
    const itemName = this.getItemName(itemType, itemId);

    seller.inventory[inventoryKey] -= quantity;

    const listing: TradeListing = {
      id: uuidv4(),
      sellerId,
      sellerName: seller.nickname,
      itemType,
      itemId,
      itemName,
      quantity,
      unitPrice,
      totalPrice: unitPrice * quantity,
      status: ListingStatus.ACTIVE,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.listingDuration,
      suggestedPriceRange: { min: suggested.min, max: suggested.max },
    };

    this.store.tradeListings.set(listing.id, listing);

    return {
      success: true,
      listing,
      suggestedRange: { min: suggested.min, max: suggested.max },
    };
  }

  private getInventoryKey(itemType: TradeListing['itemType'], itemId: string): string {
    switch (itemType) {
      case 'fish':
        return `fish_${itemId}`;
      case 'dish':
        return `dish_${itemId}`;
      case 'bait':
        return `bait_${itemId}`;
      default:
        return itemId;
    }
  }

  private getItemName(itemType: TradeListing['itemType'], itemId: string): string {
    if (itemType === 'fish') {
      return this.store.fishSpecies.get(itemId)?.name || itemId;
    }
    if (itemType === 'dish') {
      return this.store.dishes.get(itemId)?.name || itemId;
    }
    if (itemType === 'bait') {
      return this.store.baitTemplates.get(itemId)?.name || itemId;
    }
    return itemId;
  }

  buyListing(buyerId: string, listingId: string, quantity?: number): {
    success: boolean;
    totalCost?: number;
    itemsReceived?: number;
    reason?: string;
  } {
    const buyer = this.store.players.get(buyerId);
    if (!buyer) return { success: false, reason: '买家不存在' };

    const listing = this.store.tradeListings.get(listingId);
    if (!listing) return { success: false, reason: '商品不存在' };
    if (listing.status !== ListingStatus.ACTIVE) return { success: false, reason: '商品已下架' };
    if (Date.now() > listing.expiresAt) {
      listing.status = ListingStatus.EXPIRED;
      this.returnListingToSeller(listing);
      return { success: false, reason: '商品已过期' };
    }

    const buyQty = Math.min(quantity || listing.quantity, listing.quantity);
    const totalCost = buyQty * listing.unitPrice;

    if (buyer.gold < totalCost) {
      return { success: false, reason: `金币不足，需要 ${totalCost}` };
    }

    if (buyerId === listing.sellerId) {
      return { success: false, reason: '不能购买自己的商品' };
    }

    buyer.gold -= totalCost;

    const inventoryKey = this.getInventoryKey(listing.itemType, listing.itemId);
    buyer.inventory[inventoryKey] = (buyer.inventory[inventoryKey] || 0) + buyQty;

    const seller = this.store.players.get(listing.sellerId);
    if (seller) {
      const fee = Math.floor(totalCost * 0.05);
      seller.gold += totalCost - fee;
    }

    listing.quantity -= buyQty;
    if (listing.quantity <= 0) {
      listing.status = ListingStatus.SOLD;
    }

    this.store.logTrade(listingId, listing.itemId, listing.itemType, listing.unitPrice, buyQty);

    this.eventBus.emit('market:sold', {
      listingId: listing.id,
      itemName: listing.itemName,
      quantity: buyQty,
      totalPrice: totalCost,
      sellerName: listing.sellerName,
      buyerName: buyer.nickname,
    });

    return {
      success: true,
      totalCost,
      itemsReceived: buyQty,
    };
  }

  cancelListing(playerId: string, listingId: string): {
    success: boolean;
    reason?: string;
  } {
    const listing = this.store.tradeListings.get(listingId);
    if (!listing) return { success: false, reason: '商品不存在' };
    if (listing.sellerId !== playerId) return { success: false, reason: '非商品所有者' };
    if (listing.status !== ListingStatus.ACTIVE) return { success: false, reason: '商品非上架状态' };

    listing.status = ListingStatus.CANCELLED;
    this.returnListingToSeller(listing);

    return { success: true };
  }

  private returnListingToSeller(listing: TradeListing) {
    const seller = this.store.players.get(listing.sellerId);
    if (seller && listing.quantity > 0) {
      const key = this.getInventoryKey(listing.itemType, listing.itemId);
      seller.inventory[key] = (seller.inventory[key] || 0) + listing.quantity;
    }
  }

  searchListings(
    filters: Partial<{
      itemType: TradeListing['itemType'];
      itemId: string;
      minPrice: number;
      maxPrice: number;
      sellerId: string;
    }> = {},
    limit: number = 50,
    sortBy: 'price_asc' | 'price_desc' | 'time_desc' | 'time_asc' = 'time_desc'
  ): TradeListing[] {
    let results = Array.from(this.store.tradeListings.values()).filter(
      (l) => l.status === ListingStatus.ACTIVE && Date.now() <= l.expiresAt
    );

    if (filters.itemType) results = results.filter((l) => l.itemType === filters.itemType);
    if (filters.itemId) results = results.filter((l) => l.itemId === filters.itemId);
    if (filters.sellerId) results = results.filter((l) => l.sellerId === filters.sellerId);
    if (filters.minPrice !== undefined) {
      results = results.filter((l) => l.unitPrice >= filters.minPrice!);
    }
    if (filters.maxPrice !== undefined) {
      results = results.filter((l) => l.unitPrice <= filters.maxPrice!);
    }

    switch (sortBy) {
      case 'price_asc':
        results.sort((a, b) => a.unitPrice - b.unitPrice);
        break;
      case 'price_desc':
        results.sort((a, b) => b.unitPrice - a.unitPrice);
        break;
      case 'time_asc':
        results.sort((a, b) => a.createdAt - b.createdAt);
        break;
      default:
        results.sort((a, b) => b.createdAt - a.createdAt);
    }

    return results.slice(0, limit);
  }

  cleanupExpired() {
    const now = Date.now();
    this.store.tradeListings.forEach((listing) => {
      if (listing.status === ListingStatus.ACTIVE && now > listing.expiresAt) {
        listing.status = ListingStatus.EXPIRED;
        this.returnListingToSeller(listing);
      }
    });
  }
}
