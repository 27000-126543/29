import {
  WaterAreaType,
  WeatherType,
  TimeOfDay,
  FishRarity,
  ApprovalStatus,
  TournamentStatus,
  SkillType,
  GuildRole,
  ListingStatus,
} from './enums';

export interface FishSpecies {
  id: string;
  name: string;
  rarity: FishRarity;
  baseWeight: { min: number; max: number };
  preferredWater: WaterAreaType[];
  preferredWeather: WeatherType[];
  preferredTime: TimeOfDay[];
  preferredBaitIds: string[];
  minWaterLevel: number;
  basePrice: number;
  cookingRecipe?: string;
  description: string;
}

export interface FishingRod {
  id: string;
  instanceId: string;
  name: string;
  level: number;
  supportStrength: number;
  sensitivity: number;
  lineLength: number;
  maxRarity: FishRarity;
  upgradeCost: {
    gold: number;
    materials: Record<string, number>;
  };
}

export interface Bait {
  id: string;
  instanceId: string;
  name: string;
  rarityBoost: number;
  speciesAttraction: string[];
  quantity: number;
  isUnlocked: boolean;
}

export interface BaitRecipe {
  id: string;
  baitId: string;
  name: string;
  fragmentsRequired: number;
  fragmentsCollected: number;
  ingredients: Record<string, number>;
  approvalStatus: ApprovalStatus;
  submittedBy: string;
  approvalHistory: Array<{
    adminId: string;
    action: ApprovalStatus;
    timestamp: number;
    comment?: string;
  }>;
}

export interface WaterArea {
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

export interface Player {
  id: string;
  nickname: string;
  level: number;
  exp: number;
  gold: number;
  materials: Record<string, number>;
  currentRodId?: string;
  currentBaitId?: string;
  currentWaterAreaId?: string;
  rods: FishingRod[];
  baits: Bait[];
  inventory: Record<string, number>;
  collectedFish: Record<string, number>;
  totalWeightCaught: number;
  cookingLevel: number;
  cookingExp: number;
  learnedRecipes: string[];
  skills: Record<SkillType, number>;
  guildId?: string;
  guildRole?: GuildRole;
}

export interface Guild {
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

export interface FishCatchResult {
  success: boolean;
  fishId?: string;
  fishName?: string;
  rarity?: FishRarity;
  weight?: number;
  expGained?: number;
  skillUsed?: SkillType;
}

export interface Tournament {
  id: string;
  name: string;
  status: TournamentStatus;
  waterAreaId: string;
  startTime: number;
  endTime: number;
  duration: number;
  maxParticipants: number;
  participants: TournamentParticipant[];
  rewards: TournamentRewards;
}

export interface TournamentParticipant {
  playerId: string;
  playerName: string;
  totalWeight: number;
  rarityScore: number;
  totalScore: number;
  caught: Array<{ fishId: string; weight: number; rarity: FishRarity; timestamp: number }>;
  skillsUsed: Record<SkillType, number>;
  rank?: number;
}

export interface TournamentRewards {
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

export interface Dish {
  id: string;
  name: string;
  requiredFish: Array<{ fishId: string; quantity: number }>;
  requiredLevel: number;
  cookingTime: number;
  buffs: Array<{
    stat: string;
    value: number;
    duration: number;
  }>;
  sellPrice: number;
}

export interface TradeListing {
  id: string;
  sellerId: string;
  sellerName: string;
  itemType: 'fish' | 'dish' | 'bait' | 'rod' | 'material';
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: ListingStatus;
  createdAt: number;
  expiresAt: number;
  suggestedPriceRange?: { min: number; max: number };
}

export interface WeeklyReport {
  weekNumber: number;
  year: number;
  startDate: number;
  endDate: number;
  waterAreaStats: Record<string, WaterAreaWeeklyStat>;
  efficiencyTrend: Array<{ date: string; avgWeight: number; totalCatches: number }>;
  cookingConsumption: Record<string, number>;
  topFishermen: Array<{ playerId: string; playerName: string; totalWeight: number }>;
}

export interface WaterAreaWeeklyStat {
  waterAreaId: string;
  waterAreaName: string;
  fishDistribution: Record<string, number>;
  totalCatches: number;
  totalWeight: number;
  avgWeight: number;
}

export interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  value: number;
  rank: number;
}

export interface Skill {
  type: SkillType;
  name: string;
  description: string;
  cooldown: number;
  lastUsed: number;
  level: number;
}
