import { DataStore } from '../store/DataStore';
import { FishingRod, Player } from '../types/interfaces';
import { FishRarity } from '../types/enums';

export class RodUpgradeSystem {
  private store: DataStore;
  private levelStatsMap: Record<number, { supportStrength: number; sensitivity: number; lineLength: number; maxRarity: FishRarity }> = {
    1: { supportStrength: 10, sensitivity: 5, lineLength: 10, maxRarity: FishRarity.COMMON },
    2: { supportStrength: 25, sensitivity: 12, lineLength: 20, maxRarity: FishRarity.UNCOMMON },
    3: { supportStrength: 50, sensitivity: 25, lineLength: 35, maxRarity: FishRarity.RARE },
    4: { supportStrength: 100, sensitivity: 50, lineLength: 50, maxRarity: FishRarity.EPIC },
    5: { supportStrength: 200, sensitivity: 100, lineLength: 80, maxRarity: FishRarity.LEGENDARY },
    6: { supportStrength: 350, sensitivity: 180, lineLength: 120, maxRarity: FishRarity.LEGENDARY },
    7: { supportStrength: 500, sensitivity: 280, lineLength: 160, maxRarity: FishRarity.LEGENDARY },
    8: { supportStrength: 700, sensitivity: 400, lineLength: 200, maxRarity: FishRarity.LEGENDARY },
    9: { supportStrength: 1000, sensitivity: 600, lineLength: 280, maxRarity: FishRarity.LEGENDARY },
    10: { supportStrength: 1500, sensitivity: 900, lineLength: 400, maxRarity: FishRarity.LEGENDARY },
  };

  constructor(store: DataStore) {
    this.store = store;
  }

  getMaxLevel(): number {
    return 10;
  }

  getUpgradeCost(currentLevel: number): { gold: number; materials: Record<string, number> } {
    const levelMultiplier = Math.pow(1.8, currentLevel - 1);
    const baseGold = 100;
    const gold = Math.floor(baseGold * levelMultiplier);

    const materials: Record<string, number> = {
      wood: Math.floor(5 * levelMultiplier),
    };

    if (currentLevel >= 1) materials.iron = Math.floor(3 * levelMultiplier);
    if (currentLevel >= 2) materials.silver = Math.floor(2 * levelMultiplier);
    if (currentLevel >= 3) materials.gold_ore = Math.floor(2 * levelMultiplier);
    if (currentLevel >= 4) materials.crystal = Math.floor(1.5 * levelMultiplier);
    if (currentLevel >= 5) materials.mythril = Math.floor(1 * levelMultiplier);
    if (currentLevel >= 7) materials.dragon_scale = Math.max(1, Math.floor(0.5 * levelMultiplier));
    if (currentLevel >= 8) materials.ancient_rune = Math.max(1, Math.floor(0.3 * levelMultiplier));

    return { gold, materials };
  }

  canUpgrade(player: Player, rod: FishingRod): { can: boolean; reason?: string } {
    if (rod.level >= this.getMaxLevel()) {
      return { can: false, reason: '已达最高等级' };
    }

    const cost = this.getUpgradeCost(rod.level);

    if (player.gold < cost.gold) {
      return { can: false, reason: `金币不足，需要 ${cost.gold} 金币` };
    }

    for (const [material, required] of Object.entries(cost.materials)) {
      const owned = player.materials[material] || 0;
      if (owned < required) {
        return { can: false, reason: `材料不足：${material} 需要 ${required}，拥有 ${owned}` };
      }
    }

    return { can: true };
  }

  upgradeRod(playerId: string, rodInstanceId: string): {
    success: boolean;
    rod?: FishingRod;
    reason?: string;
  } {
    const player = this.store.players.get(playerId);
    if (!player) return { success: false, reason: '玩家不存在' };

    const rodIndex = player.rods.findIndex((r) => r.instanceId === rodInstanceId);
    if (rodIndex === -1) return { success: false, reason: '鱼竿不存在' };

    const rod = player.rods[rodIndex];
    const check = this.canUpgrade(player, rod);
    if (!check.can) {
      return { success: false, reason: check.reason };
    }

    const cost = this.getUpgradeCost(rod.level);
    player.gold -= cost.gold;

    for (const [material, required] of Object.entries(cost.materials)) {
      player.materials[material] = (player.materials[material] || 0) - required;
    }

    rod.level += 1;
    const newStats = this.levelStatsMap[rod.level] || this.levelStatsMap[this.getMaxLevel()];
    rod.supportStrength = newStats.supportStrength;
    rod.sensitivity = newStats.sensitivity;
    rod.lineLength = newStats.lineLength;
    rod.maxRarity = newStats.maxRarity;
    rod.upgradeCost = this.getUpgradeCost(rod.level);

    player.rods[rodIndex] = rod;

    return { success: true, rod };
  }

  craftNewRod(playerId: string, rodTemplateId: string): {
    success: boolean;
    rod?: FishingRod;
    reason?: string;
  } {
    const player = this.store.players.get(playerId);
    if (!player) return { success: false, reason: '玩家不存在' };

    const template = this.store.rodTemplates.get(rodTemplateId);
    if (!template) return { success: false, reason: '鱼竿蓝图不存在' };

    if (template.level && template.level > 1) {
      const existing = player.rods.find((r) => r.id === rodTemplateId);
      if (existing) {
        return { success: false, reason: '已拥有该类型鱼竿' };
      }
    }

    const cost = template.upgradeCost;
    if (cost) {
      if (player.gold < cost.gold) {
        return { success: false, reason: `金币不足，需要 ${cost.gold}` };
      }
      for (const [material, required] of Object.entries(cost.materials)) {
        const owned = player.materials[material] || 0;
        if (owned < required) {
          return { success: false, reason: `材料 ${material} 不足，需要 ${required}` };
        }
      }

      player.gold -= cost.gold;
      for (const [material, required] of Object.entries(cost.materials)) {
        player.materials[material] -= required;
      }
    }

    const newRod = this.store.createRodInstance(rodTemplateId);
    player.rods.push(newRod);

    return { success: true, rod: newRod };
  }
}
