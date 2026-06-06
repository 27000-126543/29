import { v4 as uuidv4 } from 'uuid';
import { Player, Guild, WaterArea, FishSpecies, Bait, FishingRod, Tournament, TradeListing, BaitRecipe, Dish } from '../types/interfaces';
import { WaterAreaType, WeatherType, FishRarity, SkillType } from '../types/enums';

export class DataStore {
  private static instance: DataStore;

  players: Map<string, Player> = new Map();
  guilds: Map<string, Guild> = new Map();
  waterAreas: Map<string, WaterArea> = new Map();
  fishSpecies: Map<string, FishSpecies> = new Map();
  tournaments: Map<string, Tournament> = new Map();
  tradeListings: Map<string, TradeListing> = new Map();
  baitRecipes: Map<string, BaitRecipe> = new Map();
  dishes: Map<string, Dish> = new Map();
  rodTemplates: Map<string, Partial<FishingRod>> = new Map();
  baitTemplates: Map<string, Partial<Bait>> = new Map();

  catchHistory: Array<{
    playerId: string;
    fishId: string;
    weight: number;
    rarity: FishRarity;
    waterAreaId: string;
    timestamp: number;
  }> = [];

  tradeHistory: Array<{
    listingId: string;
    itemId: string;
    itemType: string;
    price: number;
    quantity: number;
    timestamp: number;
  }> = [];

  cookingHistory: Array<{
    playerId: string;
    dishId: string;
    timestamp: number;
  }> = [];

  private constructor() {
    this.initializeTemplates();
    this.initializeWaterAreas();
    this.initializeFishSpecies();
    this.initializeDishes();
  }

  static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  private initializeTemplates() {
    this.rodTemplates.set('basic_rod', {
      id: 'basic_rod',
      name: '基础鱼竿',
      level: 1,
      supportStrength: 10,
      sensitivity: 5,
      lineLength: 10,
      maxRarity: FishRarity.COMMON,
      upgradeCost: { gold: 100, materials: { wood: 5, iron: 2 } },
    });

    this.rodTemplates.set('iron_rod', {
      id: 'iron_rod',
      name: '铁鱼竿',
      level: 2,
      supportStrength: 25,
      sensitivity: 12,
      lineLength: 20,
      maxRarity: FishRarity.UNCOMMON,
      upgradeCost: { gold: 500, materials: { iron: 10, wood: 10, silver: 3 } },
    });

    this.rodTemplates.set('silver_rod', {
      id: 'silver_rod',
      name: '银鱼竿',
      level: 3,
      supportStrength: 50,
      sensitivity: 25,
      lineLength: 35,
      maxRarity: FishRarity.RARE,
      upgradeCost: { gold: 2000, materials: { silver: 15, gold_ore: 5, crystal: 3 } },
    });

    this.rodTemplates.set('gold_rod', {
      id: 'gold_rod',
      name: '金鱼竿',
      level: 4,
      supportStrength: 100,
      sensitivity: 50,
      lineLength: 50,
      maxRarity: FishRarity.EPIC,
      upgradeCost: { gold: 8000, materials: { gold_ore: 20, crystal: 10, mythril: 5 } },
    });

    this.rodTemplates.set('legendary_rod', {
      id: 'legendary_rod',
      name: '传说鱼竿',
      level: 5,
      supportStrength: 200,
      sensitivity: 100,
      lineLength: 80,
      maxRarity: FishRarity.LEGENDARY,
      upgradeCost: { gold: 30000, materials: { mythril: 20, dragon_scale: 5, ancient_rune: 3 } },
    });

    this.baitTemplates.set('earthworm', {
      id: 'earthworm',
      name: '蚯蚓',
      rarityBoost: 0,
      speciesAttraction: [],
      isUnlocked: true,
    });

    this.baitTemplates.set('shrimp', {
      id: 'shrimp',
      name: '鲜虾',
      rarityBoost: 0.05,
      speciesAttraction: [],
      isUnlocked: true,
    });

    this.baitTemplates.set('bread', {
      id: 'bread',
      name: '面包屑',
      rarityBoost: -0.02,
      speciesAttraction: ['common_carp', 'grass_carp'],
      isUnlocked: true,
    });

    this.baitTemplates.set('magic_bait', {
      id: 'magic_bait',
      name: '魔法鱼饵',
      rarityBoost: 0.15,
      speciesAttraction: [],
      isUnlocked: false,
    });

    this.baitTemplates.set('ancient_lure', {
      id: 'ancient_lure',
      name: '远古诱饵',
      rarityBoost: 0.3,
      speciesAttraction: [],
      isUnlocked: false,
    });
  }

  private initializeWaterAreas() {
    this.waterAreas.set('green_lake', {
      id: 'green_lake',
      name: '翠绿湖泊',
      type: WaterAreaType.LAKE,
      level: 1,
      description: '平静的新手湖泊，适合初级钓手练习',
      fishIds: ['common_carp', 'grass_carp', 'crucian', 'roach'],
      weather: WeatherType.SUNNY,
      isGuildOnly: false,
    });

    this.waterAreas.set('silver_river', {
      id: 'silver_river',
      name: '银色河流',
      type: WaterAreaType.RIVER,
      level: 2,
      description: '湍急的河流，游动着各种淡水鱼',
      fishIds: ['common_carp', 'pike', 'catfish', 'salmon', 'trout'],
      weather: WeatherType.CLOUDY,
      isGuildOnly: false,
    });

    this.waterAreas.set('deep_ocean', {
      id: 'deep_ocean',
      name: '深邃海洋',
      type: WaterAreaType.OCEAN,
      level: 5,
      description: '危险的深海，藏着传说中的巨型鱼类',
      fishIds: ['tuna', 'swordfish', 'marlin', 'giant_squid', 'leviathan'],
      weather: WeatherType.STORMY,
      isGuildOnly: false,
    });

    this.waterAreas.set('misty_river', {
      id: 'misty_river',
      name: '迷雾河',
      type: WaterAreaType.RIVER,
      level: 3,
      description: '常年笼罩迷雾的神秘河流',
      fishIds: ['ghost_fish', 'rainbow_trout', 'pike', 'catfish'],
      weather: WeatherType.FOGGY,
      isGuildOnly: false,
    });
  }

  private initializeFishSpecies() {
    const addFish = (
      id: string,
      name: string,
      rarity: FishRarity,
      minWeight: number,
      maxWeight: number,
      water: WaterAreaType[],
      weather: WeatherType[],
      basePrice: number,
      minWaterLevel: number = 1,
      description: string = ''
    ) => {
      this.fishSpecies.set(id, {
        id,
        name,
        rarity,
        baseWeight: { min: minWeight, max: maxWeight },
        preferredWater: water,
        preferredWeather: weather,
        preferredTime: [],
        preferredBaitIds: [],
        minWaterLevel,
        basePrice,
        description,
      });
    };

    addFish('common_carp', '普通鲤鱼', FishRarity.COMMON, 1, 5, [WaterAreaType.LAKE, WaterAreaType.RIVER], [WeatherType.SUNNY, WeatherType.CLOUDY], 10);
    addFish('grass_carp', '草鱼', FishRarity.COMMON, 2, 8, [WaterAreaType.LAKE, WaterAreaType.RIVER], [WeatherType.SUNNY], 15);
    addFish('crucian', '鲫鱼', FishRarity.COMMON, 0.5, 2, [WaterAreaType.LAKE], [WeatherType.SUNNY, WeatherType.CLOUDY, WeatherType.RAINY], 8);
    addFish('roach', '拟鲤', FishRarity.COMMON, 0.3, 1.5, [WaterAreaType.LAKE, WaterAreaType.RIVER], [WeatherType.SUNNY, WeatherType.FOGGY], 12);
    addFish('pike', '梭子鱼', FishRarity.UNCOMMON, 3, 15, [WaterAreaType.RIVER], [WeatherType.CLOUDY, WeatherType.FOGGY], 50, 2);
    addFish('catfish', '鲶鱼', FishRarity.UNCOMMON, 5, 25, [WaterAreaType.RIVER], [WeatherType.CLOUDY, WeatherType.FOGGY], 60, 2);
    addFish('salmon', '鲑鱼', FishRarity.RARE, 3, 12, [WaterAreaType.RIVER], [WeatherType.RAINY], 150, 3);
    addFish('trout', '鳟鱼', FishRarity.RARE, 1, 5, [WaterAreaType.RIVER], [WeatherType.SUNNY, WeatherType.RAINY], 120, 2);
    addFish('rainbow_trout', '虹鳟', FishRarity.EPIC, 2, 8, [WaterAreaType.RIVER], [WeatherType.FOGGY], 400, 3);
    addFish('ghost_fish', '幽灵鱼', FishRarity.EPIC, 1, 4, [WaterAreaType.RIVER], [WeatherType.FOGGY], 500, 3);
    addFish('tuna', '金枪鱼', FishRarity.RARE, 20, 80, [WaterAreaType.OCEAN], [WeatherType.SUNNY, WeatherType.CLOUDY], 300, 5);
    addFish('swordfish', '剑鱼', FishRarity.EPIC, 50, 150, [WaterAreaType.OCEAN], [WeatherType.CLOUDY, WeatherType.STORMY], 800, 5);
    addFish('marlin', '马林鱼', FishRarity.EPIC, 80, 300, [WaterAreaType.OCEAN], [WeatherType.STORMY], 1200, 5);
    addFish('giant_squid', '巨型乌贼', FishRarity.LEGENDARY, 100, 500, [WaterAreaType.OCEAN], [WeatherType.STORMY], 5000, 5);
    addFish('leviathan', '利维坦', FishRarity.LEGENDARY, 500, 2000, [WaterAreaType.OCEAN], [WeatherType.STORMY], 20000, 5);
  }

  private initializeDishes() {
    this.dishes.set('grilled_carp', {
      id: 'grilled_carp',
      name: '烤鲤鱼',
      requiredFish: [{ fishId: 'common_carp', quantity: 1 }],
      requiredLevel: 1,
      cookingTime: 30,
      buffs: [{ stat: 'strength', value: 5, duration: 1800 }],
      sellPrice: 30,
    });

    this.dishes.set('fish_soup', {
      id: 'fish_soup',
      name: '鲫鱼汤',
      requiredFish: [{ fishId: 'crucian', quantity: 2 }],
      requiredLevel: 1,
      cookingTime: 60,
      buffs: [
        { stat: 'health', value: 20, duration: 3600 },
        { stat: 'stamina', value: 10, duration: 3600 },
      ],
      sellPrice: 40,
    });

    this.dishes.set('sashimi_platter', {
      id: 'sashimi_platter',
      name: '刺身拼盘',
      requiredFish: [
        { fishId: 'salmon', quantity: 1 },
        { fishId: 'tuna', quantity: 1 },
      ],
      requiredLevel: 5,
      cookingTime: 120,
      buffs: [
        { stat: 'luck', value: 10, duration: 7200 },
        { stat: 'sensitivity', value: 15, duration: 7200 },
      ],
      sellPrice: 500,
    });

    this.dishes.set('legendary_feast', {
      id: 'legendary_feast',
      name: '传说盛宴',
      requiredFish: [
        { fishId: 'leviathan', quantity: 1 },
        { fishId: 'giant_squid', quantity: 2 },
      ],
      requiredLevel: 10,
      cookingTime: 600,
      buffs: [
        { stat: 'strength', value: 50, duration: 86400 },
        { stat: 'luck', value: 30, duration: 86400 },
        { stat: 'rare_boost', value: 0.1, duration: 86400 },
      ],
      sellPrice: 30000,
    });
  }

  createPlayer(nickname: string): Player {
    const playerId = uuidv4();
    const defaultSkills: Record<SkillType, number> = {
      [SkillType.LURE_FISH]: 1,
      [SkillType.FAST_REEL]: 1,
      [SkillType.INSTANT_CATCH]: 0,
      [SkillType.RARE_BOOST]: 0,
      [SkillType.WEIGHT_BOOST]: 0,
    };

    const starterRod = this.createRodInstance('basic_rod');
    const earthwormBait = this.createBaitInstance('earthworm', 100);
    const shrimpBait = this.createBaitInstance('shrimp', 50);

    const player: Player = {
      id: playerId,
      nickname,
      level: 1,
      exp: 0,
      gold: 500,
      materials: { wood: 10, iron: 5 },
      rods: [starterRod],
      baits: [earthwormBait, shrimpBait],
      inventory: {},
      collectedFish: {},
      totalWeightCaught: 0,
      cookingLevel: 1,
      cookingExp: 0,
      learnedRecipes: ['grilled_carp', 'fish_soup'],
      skills: defaultSkills,
      currentRodId: starterRod.instanceId,
      currentBaitId: earthwormBait.instanceId,
    };

    this.players.set(playerId, player);
    return player;
  }

  createRodInstance(templateId: string): FishingRod {
    const template = this.rodTemplates.get(templateId);
    if (!template) throw new Error(`Rod template ${templateId} not found`);
    return {
      ...(template as FishingRod),
      instanceId: uuidv4(),
    };
  }

  createBaitInstance(templateId: string, quantity: number = 0): Bait {
    const template = this.baitTemplates.get(templateId);
    if (!template) throw new Error(`Bait template ${templateId} not found`);
    return {
      ...(template as Bait),
      instanceId: uuidv4(),
      quantity,
    };
  }

  logCatch(
    playerId: string,
    fishId: string,
    weight: number,
    rarity: FishRarity,
    waterAreaId: string
  ) {
    this.catchHistory.push({
      playerId,
      fishId,
      weight,
      rarity,
      waterAreaId,
      timestamp: Date.now(),
    });
  }

  logTrade(
    listingId: string,
    itemId: string,
    itemType: string,
    price: number,
    quantity: number
  ) {
    this.tradeHistory.push({
      listingId,
      itemId,
      itemType,
      price,
      quantity,
      timestamp: Date.now(),
    });
  }

  logCooking(playerId: string, dishId: string) {
    this.cookingHistory.push({
      playerId,
      dishId,
      timestamp: Date.now(),
    });
  }
}
