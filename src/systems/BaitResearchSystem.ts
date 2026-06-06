import { v4 as uuidv4 } from 'uuid';
import { DataStore } from '../store/DataStore';
import { BaitRecipe, Bait, Player, Guild } from '../types/interfaces';
import { ApprovalStatus, GuildRole } from '../types/enums';

export class BaitResearchSystem {
  private store: DataStore;

  constructor(store: DataStore) {
    this.store = store;
  }

  collectFragment(playerId: string, baitRecipeId: string, count: number = 1): {
    success: boolean;
    recipe?: BaitRecipe;
    reason?: string;
  } {
    const player = this.store.players.get(playerId);
    if (!player) return { success: false, reason: '玩家不存在' };

    let recipe = this.store.baitRecipes.get(baitRecipeId);
    if (!recipe) {
      const baitTemplate = this.store.baitTemplates.get(baitRecipeId);
      if (!baitTemplate) {
        return { success: false, reason: '鱼饵配方不存在' };
      }

      recipe = {
        id: baitRecipeId,
        baitId: baitRecipeId,
        name: baitTemplate.name || baitRecipeId,
        fragmentsRequired: 10,
        fragmentsCollected: 0,
        ingredients: this.getRecipeIngredients(baitRecipeId),
        approvalStatus: ApprovalStatus.PENDING,
        submittedBy: playerId,
        approvalHistory: [],
      };
      this.store.baitRecipes.set(baitRecipeId, recipe);
    }

    recipe.fragmentsCollected = Math.min(recipe.fragmentsRequired, recipe.fragmentsCollected + count);

    return { success: true, recipe };
  }

  private getRecipeIngredients(baitId: string): Record<string, number> {
    const recipes: Record<string, Record<string, number>> = {
      magic_bait: { magic_dust: 5, earthworm: 10, crystal: 2 },
      ancient_lure: { ancient_rune: 3, magic_dust: 10, mythril: 2, golden_fish_scale: 5 },
    };
    return recipes[baitId] || { earthworm: 5 };
  }

  canSubmitForApproval(playerId: string, baitRecipeId: string): { can: boolean; reason?: string } {
    const player = this.store.players.get(playerId);
    if (!player) return { can: false, reason: '玩家不存在' };

    const recipe = this.store.baitRecipes.get(baitRecipeId);
    if (!recipe) return { can: false, reason: '配方不存在' };

    if (recipe.fragmentsCollected < recipe.fragmentsRequired) {
      return { can: false, reason: `碎片不足，需要 ${recipe.fragmentsRequired}，已收集 ${recipe.fragmentsCollected}` };
    }

    if (recipe.approvalStatus === ApprovalStatus.APPROVED) {
      return { can: false, reason: '配方已批准' };
    }

    for (const [ingredient, count] of Object.entries(recipe.ingredients)) {
      const owned = player.materials[ingredient] || 0;
      if (owned < count) {
        return { can: false, reason: `材料 ${ingredient} 不足，需要 ${count}，拥有 ${owned}` };
      }
    }

    return { can: true };
  }

  submitForApproval(playerId: string, baitRecipeId: string): {
    success: boolean;
    recipe?: BaitRecipe;
    reason?: string;
  } {
    const player = this.store.players.get(playerId);
    if (!player) return { success: false, reason: '玩家不存在' };

    const check = this.canSubmitForApproval(playerId, baitRecipeId);
    if (!check.can) {
      return { success: false, reason: check.reason };
    }

    const recipe = this.store.baitRecipes.get(baitRecipeId)!;

    for (const [ingredient, count] of Object.entries(recipe.ingredients)) {
      player.materials[ingredient] -= count;
    }

    recipe.submittedBy = playerId;
    recipe.approvalStatus = ApprovalStatus.PENDING;
    recipe.approvalHistory.push({
      adminId: '',
      action: ApprovalStatus.PENDING,
      timestamp: Date.now(),
      comment: `玩家 ${player.nickname} 提交审核`,
    });

    return { success: true, recipe };
  }

  reviewRecipe(
    adminPlayerId: string,
    baitRecipeId: string,
    action: ApprovalStatus.APPROVED | ApprovalStatus.REJECTED,
    comment?: string
  ): { success: boolean; reason?: string } {
    const admin = this.store.players.get(adminPlayerId);
    if (!admin) return { success: false, reason: '管理员不存在' };

    if (!admin.guildId) return { success: false, reason: '未加入公会' };

    const guild = this.store.guilds.get(admin.guildId);
    if (!guild) return { success: false, reason: '公会不存在' };

    if (admin.guildRole !== GuildRole.LEADER && admin.guildRole !== GuildRole.ADMIN) {
      return { success: false, reason: '无审批权限，需要公会会长或管理员' };
    }

    const recipe = this.store.baitRecipes.get(baitRecipeId);
    if (!recipe) return { success: false, reason: '配方不存在' };

    recipe.approvalStatus = action;
    recipe.approvalHistory.push({
      adminId: adminPlayerId,
      action,
      timestamp: Date.now(),
      comment,
    });

    if (action === ApprovalStatus.APPROVED) {
      const submitter = this.store.players.get(recipe.submittedBy);
      if (submitter) {
        const existing = submitter.baits.find((b) => b.id === recipe.baitId);
        if (existing) {
          existing.quantity += 10;
          existing.isUnlocked = true;
        } else {
          const newBait: Bait = {
            ...(this.store.baitTemplates.get(recipe.baitId) as Bait),
            instanceId: uuidv4(),
            quantity: 10,
            isUnlocked: true,
          };
          submitter.baits.push(newBait);
        }
      }
    }

    return { success: true };
  }

  getPendingRecipes(guildId: string): BaitRecipe[] {
    const results: BaitRecipe[] = [];
    this.store.baitRecipes.forEach((recipe) => {
      if (recipe.approvalStatus === ApprovalStatus.PENDING) {
        results.push(recipe);
      }
    });
    return results;
  }

  craftBait(playerId: string, baitId: string, quantity: number = 1): {
    success: boolean;
    crafted?: number;
    reason?: string;
  } {
    const player = this.store.players.get(playerId);
    if (!player) return { success: false, reason: '玩家不存在' };

    const recipe = this.store.baitRecipes.get(baitId);
    const template = this.store.baitTemplates.get(baitId);

    if (!template) return { success: false, reason: '鱼饵不存在' };

    if (baitId === 'earthworm' || baitId === 'shrimp' || baitId === 'bread') {
      const simpleCost: Record<string, Record<string, number>> = {
        earthworm: { dirt: 1 },
        shrimp: { small_fish: 1 },
        bread: { wheat: 1 },
      };
      const cost = simpleCost[baitId] || {};
      let canCraft = true;
      let maxCraftable = quantity;

      for (const [mat, needed] of Object.entries(cost)) {
        const owned = player.materials[mat] || 0;
        if (owned < needed * quantity) {
          maxCraftable = Math.min(maxCraftable, Math.floor(owned / needed));
        }
      }

      if (maxCraftable <= 0) {
        return { success: false, reason: '材料不足' };
      }

      for (const [mat, needed] of Object.entries(cost)) {
        player.materials[mat] -= needed * maxCraftable;
      }

      let bait = player.baits.find((b) => b.id === baitId);
      if (!bait) {
        bait = {
          ...(template as Bait),
          instanceId: uuidv4(),
          quantity: 0,
          isUnlocked: true,
        };
        player.baits.push(bait);
      }
      bait.quantity += maxCraftable;

      return { success: true, crafted: maxCraftable };
    }

    if (!recipe || recipe.approvalStatus !== ApprovalStatus.APPROVED) {
      return { success: false, reason: '鱼饵未解锁或未通过审批' };
    }

    let canCraftAll = true;
    let maxCraftable = quantity;
    for (const [ingredient, count] of Object.entries(recipe.ingredients)) {
      const owned = player.materials[ingredient] || 0;
      if (owned < count * quantity) {
        maxCraftable = Math.min(maxCraftable, Math.floor(owned / count));
      }
    }

    if (maxCraftable <= 0) {
      return { success: false, reason: '材料不足' };
    }

    for (const [ingredient, count] of Object.entries(recipe.ingredients)) {
      player.materials[ingredient] -= count * maxCraftable;
    }

    let bait = player.baits.find((b) => b.id === baitId);
    if (!bait) {
      bait = {
        ...(template as Bait),
        instanceId: uuidv4(),
        quantity: 0,
        isUnlocked: true,
      };
      player.baits.push(bait);
    }
    bait.quantity += maxCraftable;

    return { success: true, crafted: maxCraftable };
  }
}
