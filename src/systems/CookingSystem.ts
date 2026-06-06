import { v4 as uuidv4 } from 'uuid';
import { DataStore } from '../store/DataStore';
import { Dish, Player } from '../types/interfaces';

export class CookingSystem {
  private store: DataStore;

  constructor(store: DataStore) {
    this.store = store;
  }

  canCook(player: Player, dishId: string): { can: boolean; reason?: string } {
    const dish = this.store.dishes.get(dishId);
    if (!dish) return { can: false, reason: '配方不存在' };

    if (!player.learnedRecipes.includes(dishId)) {
      return { can: false, reason: '未学习该配方' };
    }

    if (player.cookingLevel < dish.requiredLevel) {
      return { can: false, reason: `烹饪等级不足，需要 ${dish.requiredLevel} 级，当前 ${player.cookingLevel} 级` };
    }

    for (const req of dish.requiredFish) {
      const owned = player.inventory[`fish_${req.fishId}`] || 0;
      if (owned < req.quantity) {
        const fishName = this.store.fishSpecies.get(req.fishId)?.name || req.fishId;
        return { can: false, reason: `${fishName} 不足，需要 ${req.quantity}，拥有 ${owned}` };
      }
    }

    return { can: true };
  }

  cook(playerId: string, dishId: string): {
    success: boolean;
    dish?: Dish;
    buffs?: Array<{ stat: string; value: number; duration: number; timestamp: number }>;
    expGained?: number;
    reason?: string;
  } {
    const player = this.store.players.get(playerId);
    if (!player) return { success: false, reason: '玩家不存在' };

    const check = this.canCook(player, dishId);
    if (!check.can) {
      return { success: false, reason: check.reason };
    }

    const dish = this.store.dishes.get(dishId)!;

    for (const req of dish.requiredFish) {
      player.inventory[`fish_${req.fishId}`] -= req.quantity;
    }

    const expGained = this.calculateExp(dish);
    player.cookingExp += expGained;
    this.checkLevelUp(player);

    player.inventory[`dish_${dishId}`] = (player.inventory[`dish_${dishId}`] || 0) + 1;

    const buffTimestamp = Date.now();
    const appliedBuffs = dish.buffs.map((b) => ({
      ...b,
      timestamp: buffTimestamp,
    }));

    this.store.logCooking(playerId, dishId);

    return {
      success: true,
      dish,
      buffs: appliedBuffs,
      expGained,
    };
  }

  private calculateExp(dish: Dish): number {
    const baseExp = dish.sellPrice * 0.5;
    const levelMult = 1 + (dish.requiredLevel - 1) * 0.2;
    return Math.floor(baseExp * levelMult);
  }

  private checkLevelUp(player: Player) {
    const requiredExp = this.getExpForLevel(player.cookingLevel);
    if (player.cookingExp >= requiredExp) {
      player.cookingLevel += 1;
      player.cookingExp -= requiredExp;
      this.checkLevelUp(player);
    }
  }

  getExpForLevel(level: number): number {
    return Math.floor(100 * Math.pow(1.5, level - 1));
  }

  learnRecipe(playerId: string, dishId: string): {
    success: boolean;
    reason?: string;
  } {
    const player = this.store.players.get(playerId);
    if (!player) return { success: false, reason: '玩家不存在' };

    if (player.learnedRecipes.includes(dishId)) {
      return { success: false, reason: '已学习该配方' };
    }

    const dish = this.store.dishes.get(dishId);
    if (!dish) return { success: false, reason: '配方不存在' };

    player.learnedRecipes.push(dishId);
    return { success: true };
  }

  getAvailableRecipes(player: Player): Dish[] {
    return Array.from(this.store.dishes.values()).filter(
      (d) => player.learnedRecipes.includes(d.id) && player.cookingLevel >= d.requiredLevel
    );
  }

  useDish(playerId: string, dishId: string): {
    success: boolean;
    buffs?: Array<{ stat: string; value: number; duration: number }>;
    reason?: string;
  } {
    const player = this.store.players.get(playerId);
    if (!player) return { success: false, reason: '玩家不存在' };

    const count = player.inventory[`dish_${dishId}`] || 0;
    if (count <= 0) return { success: false, reason: '无此料理' };

    const dish = this.store.dishes.get(dishId);
    if (!dish) return { success: false, reason: '配方不存在' };

    player.inventory[`dish_${dishId}`] -= 1;

    return { success: true, buffs: dish.buffs };
  }
}
