import { v4 as uuidv4 } from 'uuid';
import { DataStore } from '../store/DataStore';
import { TimeSystem } from './TimeSystem';
import { WeatherSystem } from './WeatherSystem';
import { FishCatchResult, FishSpecies, Player } from '../types/interfaces';
import { FishRarity, SkillType } from '../types/enums';

export class FishingEngine {
  private store: DataStore;
  private timeSystem: TimeSystem;
  private weatherSystem: WeatherSystem;
  private skillCooldowns: Map<string, Map<SkillType, number>> = new Map();

  constructor(store: DataStore, timeSystem: TimeSystem, weatherSystem: WeatherSystem) {
    this.store = store;
    this.timeSystem = timeSystem;
    this.weatherSystem = weatherSystem;
  }

  castLine(playerId: string, skillUsed?: SkillType): FishCatchResult {
    const player = this.store.players.get(playerId);
    if (!player) return { success: false };

    if (player.currentWaterAreaId) {
      this.store.waterAreas.get(player.currentWaterAreaId);
    }

    const waterArea = this.store.waterAreas.get(player.currentWaterAreaId || '');
    if (!waterArea) return { success: false };

    const rod = player.rods.find((r) => r.instanceId === player.currentRodId);
    if (!rod) return { success: false };

    const bait = player.baits.find((b) => b.instanceId === player.currentBaitId);
    if (!bait || bait.quantity <= 0) return { success: false };

    bait.quantity -= 1;

    const catchModifier = this.weatherSystem.getWeatherModifier(waterArea.weather);
    const baseCatchChance = 0.6 * catchModifier;
    const catchChance = Math.min(0.95, baseCatchChance + this.applySkillEffect(playerId, skillUsed, 'catch'));

    if (Math.random() > catchChance) {
      return { success: false, skillUsed };
    }

    const availableFish = this.filterAvailableFish(waterArea.fishIds, player, waterArea, skillUsed);
    if (availableFish.length === 0) {
      return { success: false, skillUsed };
    }

    const selectedFish = this.selectFishByProbability(availableFish, player, waterArea, skillUsed);
    if (!selectedFish) {
      return { success: false, skillUsed };
    }

    const weight = this.calculateWeight(selectedFish, player, skillUsed);
    const expGained = this.calculateExp(selectedFish.rarity, weight);

    player.collectedFish[selectedFish.id] = (player.collectedFish[selectedFish.id] || 0) + 1;
    player.totalWeightCaught += weight;
    player.exp += expGained;
    player.inventory[uuidv4()] = 1;
    player.inventory[`fish_${selectedFish.id}`] = (player.inventory[`fish_${selectedFish.id}`] || 0) + 1;

    this.store.logCatch(playerId, selectedFish.id, weight, selectedFish.rarity, waterArea.id);

    if (skillUsed) {
      this.setSkillCooldown(playerId, skillUsed);
    }

    return {
      success: true,
      fishId: selectedFish.id,
      fishName: selectedFish.name,
      rarity: selectedFish.rarity,
      weight,
      expGained,
      skillUsed,
    };
  }

  private filterAvailableFish(
    fishIds: string[],
    player: Player,
    waterArea: { id: string; level: number; type: any },
    skillUsed?: SkillType
  ): FishSpecies[] {
    const result: FishSpecies[] = [];
    const timeOfDay = this.timeSystem.getTimeOfDay();
    const weather = this.weatherSystem.getWeather(waterArea.id);
    const rod = player.rods.find((r) => r.instanceId === player.currentRodId)!;

    const guild = player.guildId ? this.store.guilds.get(player.guildId) : undefined;
    const rareFishBonus = guild?.rareFishBonus || 0;

    for (const fishId of fishIds) {
      const fish = this.store.fishSpecies.get(fishId);
      if (!fish) continue;
      if (waterArea.level < fish.minWaterLevel) continue;

      const rarityRank = this.getRarityRank(fish.rarity);
      const maxRarityRank = this.getRarityRank(rod.maxRarity);

      if (rarityRank > maxRarityRank && skillUsed !== SkillType.RARE_BOOST) {
        if (Math.random() > rareFishBonus * 0.5) continue;
      }

      if (fish.preferredWater.length > 0 && !fish.preferredWater.includes(waterArea.type)) {
        if (Math.random() > 0.3) continue;
      }
      if (fish.preferredWeather.length > 0 && !fish.preferredWeather.includes(weather)) {
        if (Math.random() > 0.4) continue;
      }
      if (fish.preferredTime.length > 0 && !fish.preferredTime.includes(timeOfDay)) {
        if (Math.random() > 0.5) continue;
      }

      result.push(fish);
    }

    return result;
  }

  private selectFishByProbability(
    fishes: FishSpecies[],
    player: Player,
    waterArea: { id: string; level: number },
    skillUsed?: SkillType
  ): FishSpecies | undefined {
    const bait = player.baits.find((b) => b.instanceId === player.currentBaitId);
    const weather = this.weatherSystem.getWeather(waterArea.id);
    const rarityMod = this.weatherSystem.getRarityModifier(weather);

    const weights: number[] = fishes.map((fish) => {
      let weight = this.getBaseRarityWeight(fish.rarity);

      if (skillUsed === SkillType.LURE_FISH) weight *= 1.5;
      if (skillUsed === SkillType.RARE_BOOST) weight *= (1 + rarityMod + 0.3) / this.getBaseRarityWeight(fish.rarity) * weight + rarityMod * 100;

      if (bait && fish.preferredBaitIds.includes(bait.id)) {
        weight *= (1 + 0.5 + bait.rarityBoost);
      } else if (bait) {
        weight *= (1 + bait.rarityBoost * 0.5);
      }

      weight *= (1 + rarityMod);

      const guild = player.guildId ? this.store.guilds.get(player.guildId) : undefined;
      if (guild && waterArea.id.startsWith('guild_')) {
        weight *= (1 + (guild.rareFishBonus || 0));
      }

      weight *= (1 + (waterArea.level - 1) * 0.1);

      return Math.max(0.01, weight);
    });

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < fishes.length; i++) {
      random -= weights[i];
      if (random <= 0) return fishes[i];
    }

    return fishes[fishes.length - 1];
  }

  private getBaseRarityWeight(rarity: FishRarity): number {
    const weights: Record<FishRarity, number> = {
      [FishRarity.COMMON]: 100,
      [FishRarity.UNCOMMON]: 25,
      [FishRarity.RARE]: 8,
      [FishRarity.EPIC]: 2,
      [FishRarity.LEGENDARY]: 0.3,
    };
    return weights[rarity];
  }

  private getRarityRank(rarity: FishRarity): number {
    const ranks: Record<FishRarity, number> = {
      [FishRarity.COMMON]: 0,
      [FishRarity.UNCOMMON]: 1,
      [FishRarity.RARE]: 2,
      [FishRarity.EPIC]: 3,
      [FishRarity.LEGENDARY]: 4,
    };
    return ranks[rarity];
  }

  private calculateWeight(
    fish: { baseWeight: { min: number; max: number }; rarity: FishRarity },
    player: Player,
    skillUsed?: SkillType
  ): number {
    const { min, max } = fish.baseWeight;
    const rod = player.rods.find((r) => r.instanceId === player.currentRodId)!;

    let base = min + Math.random() * (max - min);

    const sensitivityBonus = (rod.sensitivity / 100) * 0.1;
    base *= (1 + sensitivityBonus);

    if (skillUsed === SkillType.WEIGHT_BOOST) {
      base *= 1.5;
    }

    if (skillUsed === SkillType.FAST_REEL) {
      base *= 0.9;
    }

    return parseFloat(base.toFixed(2));
  }

  private calculateExp(rarity: FishRarity, weight: number): number {
    const rarityMult: Record<FishRarity, number> = {
      [FishRarity.COMMON]: 1,
      [FishRarity.UNCOMMON]: 3,
      [FishRarity.RARE]: 8,
      [FishRarity.EPIC]: 25,
      [FishRarity.LEGENDARY]: 100,
    };
    return Math.floor(weight * 5 * rarityMult[rarity]);
  }

  private applySkillEffect(playerId: string, skillUsed: SkillType | undefined, effectType: string): number {
    if (!skillUsed) return 0;

    if (this.isSkillOnCooldown(playerId, skillUsed)) return 0;

    const player = this.store.players.get(playerId);
    if (!player) return 0;

    const skillLevel = player.skills[skillUsed] || 0;
    if (skillLevel <= 0) return 0;

    if (effectType === 'catch') {
      if (skillUsed === SkillType.INSTANT_CATCH) return 1.0;
      if (skillUsed === SkillType.LURE_FISH) return 0.1 + skillLevel * 0.02;
    }

    return 0;
  }

  isSkillOnCooldown(playerId: string, skillType: SkillType): boolean {
    const playerCooldowns = this.skillCooldowns.get(playerId);
    if (!playerCooldowns) return false;

    const lastUsed = playerCooldowns.get(skillType) || 0;
    const cooldown = this.getSkillCooldown(skillType);

    return Date.now() - lastUsed < cooldown;
  }

  getSkillCooldown(skillType: SkillType): number {
    const cooldowns: Record<SkillType, number> = {
      [SkillType.LURE_FISH]: 60 * 1000,
      [SkillType.FAST_REEL]: 30 * 1000,
      [SkillType.INSTANT_CATCH]: 5 * 60 * 1000,
      [SkillType.RARE_BOOST]: 10 * 60 * 1000,
      [SkillType.WEIGHT_BOOST]: 2 * 60 * 1000,
    };
    return cooldowns[skillType];
  }

  private setSkillCooldown(playerId: string, skillType: SkillType) {
    if (!this.skillCooldowns.has(playerId)) {
      this.skillCooldowns.set(playerId, new Map());
    }
    this.skillCooldowns.get(playerId)!.set(skillType, Date.now());
  }

  getRarityScore(rarity: FishRarity): number {
    const scores: Record<FishRarity, number> = {
      [FishRarity.COMMON]: 1,
      [FishRarity.UNCOMMON]: 5,
      [FishRarity.RARE]: 20,
      [FishRarity.EPIC]: 100,
      [FishRarity.LEGENDARY]: 500,
    };
    return scores[rarity];
  }

  getRarityLabel(rarity: FishRarity): string {
    const labels: Record<FishRarity, string> = {
      [FishRarity.COMMON]: '普通',
      [FishRarity.UNCOMMON]: '优秀',
      [FishRarity.RARE]: '稀有',
      [FishRarity.EPIC]: '史诗',
      [FishRarity.LEGENDARY]: '传说',
    };
    return labels[rarity];
  }
}
