import { v4 as uuidv4 } from 'uuid';
import { DataStore } from '../store/DataStore';
import { EventBus } from '../events/EventBus';
import { Guild, WaterArea, Player } from '../types/interfaces';
import { GuildRole, ApprovalStatus, WaterAreaType, WeatherType } from '../types/enums';

export class GuildSystem {
  private store: DataStore;
  private eventBus: EventBus;

  constructor(store: DataStore, eventBus: EventBus) {
    this.store = store;
    this.eventBus = eventBus;
  }

  createGuild(leaderId: string, name: string): {
    success: boolean;
    guild?: Guild;
    reason?: string;
  } {
    const leader = this.store.players.get(leaderId);
    if (!leader) return { success: false, reason: '玩家不存在' };
    if (leader.guildId) return { success: false, reason: '已加入公会' };
    if (leader.gold < 10000) return { success: false, reason: '金币不足，创建公会需要 10000 金币' };

    const existing = Array.from(this.store.guilds.values()).find((g) => g.name === name);
    if (existing) return { success: false, reason: '公会名称已存在' };

    leader.gold -= 10000;

    const guild: Guild = {
      id: uuidv4(),
      name,
      level: 1,
      leaderId,
      admins: [],
      members: [leaderId],
      pondLevel: 0,
      rareFishBonus: 0,
      buildingQueue: [],
      fishStock: [],
    };

    this.store.guilds.set(guild.id, guild);
    leader.guildId = guild.id;
    leader.guildRole = GuildRole.LEADER;

    return { success: true, guild };
  }

  joinGuild(playerId: string, guildId: string): {
    success: boolean;
    reason?: string;
  } {
    const player = this.store.players.get(playerId);
    if (!player) return { success: false, reason: '玩家不存在' };
    if (player.guildId) return { success: false, reason: '已加入公会' };

    const guild = this.store.guilds.get(guildId);
    if (!guild) return { success: false, reason: '公会不存在' };

    guild.members.push(playerId);
    player.guildId = guildId;
    player.guildRole = GuildRole.MEMBER;

    return { success: true };
  }

  leaveGuild(playerId: string): {
    success: boolean;
    reason?: string;
  } {
    const player = this.store.players.get(playerId);
    if (!player || !player.guildId) return { success: false, reason: '未加入公会' };

    const guild = this.store.guilds.get(player.guildId);
    if (!guild) return { success: false };

    if (player.guildRole === GuildRole.LEADER) {
      return { success: false, reason: '公会会长不能直接退出，请先转让会长' };
    }

    guild.members = guild.members.filter((m) => m !== playerId);
    guild.admins = guild.admins.filter((a) => a !== playerId);
    player.guildId = undefined;
    player.guildRole = undefined;

    return { success: true };
  }

  setRole(adminId: string, targetId: string, role: GuildRole): {
    success: boolean;
    reason?: string;
  } {
    const admin = this.store.players.get(adminId);
    const target = this.store.players.get(targetId);
    if (!admin || !target) return { success: false, reason: '玩家不存在' };
    if (!admin.guildId || admin.guildId !== target.guildId) {
      return { success: false, reason: '不在同一公会' };
    }

    const adminRank = this.getRoleRank(admin.guildRole!);
    const targetRank = this.getRoleRank(target.guildRole!);
    const newRank = this.getRoleRank(role);

    if (adminRank < 2) return { success: false, reason: '无权限' };
    if (newRank >= adminRank) return { success: false, reason: '无法授予同等或更高职位' };
    if (targetRank >= adminRank) return { success: false, reason: '无法操作同级或更高职位成员' };

    const guild = this.store.guilds.get(admin.guildId)!;
    if (role === GuildRole.ADMIN) {
      if (!guild.admins.includes(targetId)) guild.admins.push(targetId);
    } else if (role === GuildRole.MEMBER) {
      guild.admins = guild.admins.filter((a) => a !== targetId);
    }

    target.guildRole = role;
    return { success: true };
  }

  private getRoleRank(role: GuildRole): number {
    const ranks: Record<GuildRole, number> = {
      [GuildRole.MEMBER]: 0,
      [GuildRole.OFFICER]: 1,
      [GuildRole.ADMIN]: 2,
      [GuildRole.LEADER]: 3,
    };
    return ranks[role];
  }

  hasApprovalPermission(player: Player): boolean {
    if (!player.guildRole) return false;
    return player.guildRole === GuildRole.LEADER || player.guildRole === GuildRole.ADMIN;
  }

  buildGuildPond(playerId: string): {
    success: boolean;
    waterArea?: WaterArea;
    reason?: string;
  } {
    const player = this.store.players.get(playerId);
    if (!player || !player.guildId) return { success: false, reason: '未加入公会' };
    if (!this.hasApprovalPermission(player)) return { success: false, reason: '无操作权限' };

    const guild = this.store.guilds.get(player.guildId);
    if (!guild) return { success: false, reason: '公会不存在' };

    const cost = this.getPondBuildCost(guild.pondLevel);
    if (player.gold < cost.gold) return { success: false, reason: `金币不足，需要 ${cost.gold}` };
    for (const [mat, qty] of Object.entries(cost.materials)) {
      if ((player.materials[mat] || 0) < qty) {
        return { success: false, reason: `材料 ${mat} 不足，需要 ${qty}` };
      }
    }

    player.gold -= cost.gold;
    for (const [mat, qty] of Object.entries(cost.materials)) {
      player.materials[mat] -= qty;
    }

    guild.pondLevel += 1;
    guild.rareFishBonus = Math.min(0.5, guild.pondLevel * 0.05);

    const pondId = `guild_${guild.id}`;
    let pond = this.store.waterAreas.get(pondId);
    if (!pond) {
      pond = {
        id: pondId,
        name: `${guild.name} 专属鱼塘`,
        type: WaterAreaType.GUILD,
        level: guild.pondLevel,
        description: `${guild.name} 公会专属钓鱼场，等级 ${guild.pondLevel}`,
        fishIds: this.getPondFishIds(guild.pondLevel),
        weather: WeatherType.SUNNY,
        isGuildOnly: true,
        guildId: guild.id,
      };
      this.store.waterAreas.set(pondId, pond);
    } else {
      pond.level = guild.pondLevel;
      pond.fishIds = this.getPondFishIds(guild.pondLevel);
    }
    guild.pondId = pondId;

    this.eventBus.emit('guild:pond_upgraded', {
      guildId: guild.id,
      pondLevel: guild.pondLevel,
      rareFishBonus: guild.rareFishBonus,
    });

    return { success: true, waterArea: pond };
  }

  private getPondBuildCost(level: number): { gold: number; materials: Record<string, number> } {
    const baseGold = 50000;
    const mult = Math.pow(2.5, level);
    return {
      gold: Math.floor(baseGold * mult),
      materials: {
        wood: Math.floor(100 * mult),
        stone: Math.floor(50 * mult),
        iron: Math.floor(30 * mult),
      },
    };
  }

  private getPondFishIds(level: number): string[] {
    const base = ['common_carp', 'grass_carp', 'crucian'];
    if (level >= 2) base.push('roach', 'pike');
    if (level >= 3) base.push('catfish', 'salmon', 'trout');
    if (level >= 4) base.push('rainbow_trout', 'ghost_fish');
    if (level >= 5) base.push('tuna');
    if (level >= 7) base.push('swordfish', 'marlin');
    if (level >= 9) base.push('giant_squid', 'leviathan');
    return base;
  }

  submitBuildingUpgrade(
    playerId: string,
    buildingType: string,
    targetLevel: number
  ): {
    success: boolean;
    reason?: string;
  } {
    const player = this.store.players.get(playerId);
    if (!player || !player.guildId) return { success: false, reason: '未加入公会' };

    const guild = this.store.guilds.get(player.guildId);
    if (!guild) return { success: false, reason: '公会不存在' };

    guild.buildingQueue.push({
      type: buildingType,
      targetLevel,
      startTime: Date.now(),
      endTime: Date.now() + this.getBuildDuration(targetLevel),
      approvalStatus: ApprovalStatus.PENDING,
    });

    return { success: true };
  }

  private getBuildDuration(level: number): number {
    return level * 60 * 60 * 1000;
  }

  approveBuildingUpgrade(
    adminId: string,
    queueIndex: number,
    action: ApprovalStatus.APPROVED | ApprovalStatus.REJECTED
  ): {
    success: boolean;
    reason?: string;
  } {
    const admin = this.store.players.get(adminId);
    if (!admin || !admin.guildId) return { success: false, reason: '未加入公会' };
    if (!this.hasApprovalPermission(admin)) return { success: false, reason: '无审批权限' };

    const guild = this.store.guilds.get(admin.guildId);
    if (!guild) return { success: false, reason: '公会不存在' };

    if (queueIndex < 0 || queueIndex >= guild.buildingQueue.length) {
      return { success: false, reason: '队列索引无效' };
    }

    guild.buildingQueue[queueIndex].approvalStatus = action;
    return { success: true };
  }

  stockFish(
    playerId: string,
    fishId: string,
    quantity: number
  ): {
    success: boolean;
    reason?: string;
  } {
    const player = this.store.players.get(playerId);
    if (!player || !player.guildId) return { success: false, reason: '未加入公会' };
    if (!this.hasApprovalPermission(player)) return { success: false, reason: '无操作权限' };

    const guild = this.store.guilds.get(player.guildId);
    if (!guild) return { success: false, reason: '公会不存在' };

    const owned = player.inventory[`fish_${fishId}`] || 0;
    if (owned < quantity) return { success: false, reason: '鱼数量不足' };

    player.inventory[`fish_${fishId}`] -= quantity;

    const existing = guild.fishStock.find((s) => s.fishId === fishId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      guild.fishStock.push({
        fishId,
        quantity,
        approvalStatus: ApprovalStatus.APPROVED,
      });
    }

    return { success: true };
  }

  approveFishStock(
    adminId: string,
    stockIndex: number,
    action: ApprovalStatus.APPROVED | ApprovalStatus.REJECTED
  ): {
    success: boolean;
    reason?: string;
  } {
    const admin = this.store.players.get(adminId);
    if (!admin || !admin.guildId) return { success: false, reason: '未加入公会' };
    if (!this.hasApprovalPermission(admin)) return { success: false, reason: '无审批权限' };

    const guild = this.store.guilds.get(admin.guildId);
    if (!guild) return { success: false, reason: '公会不存在' };

    if (stockIndex < 0 || stockIndex >= guild.fishStock.length) {
      return { success: false, reason: '库存索引无效' };
    }

    guild.fishStock[stockIndex].approvalStatus = action;
    return { success: true };
  }

  getGuild(guildId: string): Guild | undefined {
    return this.store.guilds.get(guildId);
  }

  canAccessGuildPond(playerId: string, pondId: string): boolean {
    const player = this.store.players.get(playerId);
    const waterArea = this.store.waterAreas.get(pondId);
    if (!player || !waterArea) return false;
    if (!waterArea.isGuildOnly) return true;
    return player.guildId === waterArea.guildId;
  }
}
