import { create } from 'zustand';

export enum GuildRole {
  MEMBER = 'member',
  OFFICER = 'officer',
  ADMIN = 'admin',
  LEADER = 'leader',
}

export enum FishRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export interface SimplifiedPlayer {
  id: string;
  nickname: string;
  level: number;
  exp: number;
  gold: number;
  currentRodId?: string;
  currentBaitId?: string;
  currentWaterAreaId?: string;
  inventory?: Record<string, number>;
  materials?: Record<string, number>;
  cookingLevel?: number;
  cookingExp?: number;
  guildId?: string;
  guildRole?: GuildRole;
}

interface GameState {
  player: SimplifiedPlayer | null;
  currentAreaId: string;
  setPlayer: (player: SimplifiedPlayer) => void;
  setAreaId: (areaId: string) => void;
  logout: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  player: null,
  currentAreaId: '',
  setPlayer: (player) => set({ player }),
  setAreaId: (areaId) => set({ currentAreaId: areaId }),
  logout: () => set({ player: null, currentAreaId: '' }),
}));
