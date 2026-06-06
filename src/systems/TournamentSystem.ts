import { v4 as uuidv4 } from 'uuid';
import { DataStore } from '../store/DataStore';
import { FishingEngine } from './FishingEngine';
import { EventBus } from '../events/EventBus';
import {
  Tournament,
  TournamentParticipant,
  TournamentRewards,
  FishCatchResult,
} from '../types/interfaces';
import { TournamentStatus, SkillType, FishRarity } from '../types/enums';

export class TournamentSystem {
  private store: DataStore;
  private fishingEngine: FishingEngine;
  private eventBus: EventBus;
  private dailyTournamentTime: { hour: number; minute: number }[] = [
    { hour: 10, minute: 0 },
    { hour: 15, minute: 0 },
    { hour: 20, minute: 0 },
  ];
  private tournamentDurationMs: number = 30 * 60 * 1000;
  private registrationOpenMs: number = 10 * 60 * 1000;

  constructor(store: DataStore, fishingEngine: FishingEngine, eventBus: EventBus) {
    this.store = store;
    this.fishingEngine = fishingEngine;
    this.eventBus = eventBus;
  }

  createTournament(
    name: string,
    waterAreaId: string,
    startTime: number,
    durationMs?: number
  ): Tournament {
    const tournament: Tournament = {
      id: uuidv4(),
      name,
      status: TournamentStatus.UPCOMING,
      waterAreaId,
      startTime,
      endTime: startTime + (durationMs || this.tournamentDurationMs),
      duration: durationMs || this.tournamentDurationMs,
      maxParticipants: 5000,
      participants: [],
      rewards: this.generateDefaultRewards(),
    };
    this.store.tournaments.set(tournament.id, tournament);
    return tournament;
  }

  private generateDefaultRewards(): TournamentRewards {
    return {
      top3: [
        {
          blueprints: ['gold_rod', 'ancient_lure_blueprint'],
          rareBaits: { magic_bait: 50, ancient_lure: 20 },
          gold: 100000,
          materials: { mythril: 20, dragon_scale: 10 },
        },
        {
          blueprints: ['silver_rod'],
          rareBaits: { magic_bait: 30 },
          gold: 50000,
          materials: { crystal: 30, gold_ore: 20 },
        },
        {
          blueprints: [],
          rareBaits: { magic_bait: 15 },
          gold: 25000,
          materials: { silver: 30 },
        },
      ],
      participants: {
        gold: 5000,
        materials: { iron: 10, wood: 10 },
      },
    };
  }

  checkDailyTournaments(now: number = Date.now()): Tournament[] {
    const created: Tournament[] = [];
    for (const time of this.dailyTournamentTime) {
      const today = new Date(now);
      today.setHours(time.hour, time.minute, 0, 0);
      const tournamentStart = today.getTime();

      const regOpen = tournamentStart - this.registrationOpenMs;
      if (now >= regOpen && now <= tournamentStart + this.tournamentDurationMs) {
        const existing = Array.from(this.store.tournaments.values()).find(
          (t) =>
            t.waterAreaId === 'green_lake' &&
            Math.abs(t.startTime - tournamentStart) < 60000
        );
        if (!existing) {
          const t = this.createTournament(
            `每日垂钓大赛 - ${time.hour}:${String(time.minute).padStart(2, '0')}`,
            'green_lake',
            tournamentStart
          );
          t.status = TournamentStatus.REGISTRATION;
          created.push(t);
          this.eventBus.emit('tournament:announce', { tournamentId: t.id, name: t.name });
        }
      }
    }
    return created;
  }

  updateTournamentStates(now: number = Date.now()) {
    this.store.tournaments.forEach((t) => {
      if (t.status === TournamentStatus.REGISTRATION && now >= t.startTime) {
        t.status = TournamentStatus.IN_PROGRESS;
        this.eventBus.emit('tournament:started', { tournamentId: t.id });
      }
      if (t.status === TournamentStatus.IN_PROGRESS && now >= t.endTime) {
        this.finalizeTournament(t.id);
      }
    });
  }

  registerPlayer(tournamentId: string, playerId: string): {
    success: boolean;
    reason?: string;
  } {
    const tournament = this.store.tournaments.get(tournamentId);
    if (!tournament) return { success: false, reason: '大赛不存在' };

    if (tournament.status !== TournamentStatus.REGISTRATION) {
      return { success: false, reason: '非报名时间' };
    }

    if (tournament.participants.length >= tournament.maxParticipants) {
      return { success: false, reason: '名额已满' };
    }

    const existing = tournament.participants.find((p) => p.playerId === playerId);
    if (existing) {
      return { success: false, reason: '已报名' };
    }

    const player = this.store.players.get(playerId);
    if (!player) return { success: false, reason: '玩家不存在' };

    const participant: TournamentParticipant = {
      playerId,
      playerName: player.nickname,
      totalWeight: 0,
      rarityScore: 0,
      totalScore: 0,
      caught: [],
      skillsUsed: {
        [SkillType.LURE_FISH]: 0,
        [SkillType.FAST_REEL]: 0,
        [SkillType.INSTANT_CATCH]: 0,
        [SkillType.RARE_BOOST]: 0,
        [SkillType.WEIGHT_BOOST]: 0,
      },
    };

    tournament.participants.push(participant);
    player.currentWaterAreaId = tournament.waterAreaId;

    return { success: true };
  }

  recordCatch(
    tournamentId: string,
    playerId: string,
    result: FishCatchResult
  ): TournamentParticipant | undefined {
    if (!result.success || !result.fishId || !result.rarity || !result.weight) {
      return undefined;
    }

    const tournament = this.store.tournaments.get(tournamentId);
    if (!tournament || tournament.status !== TournamentStatus.IN_PROGRESS) {
      return undefined;
    }

    const participant = tournament.participants.find((p) => p.playerId === playerId);
    if (!participant) return undefined;

    participant.caught.push({
      fishId: result.fishId,
      weight: result.weight,
      rarity: result.rarity,
      timestamp: Date.now(),
    });

    if (result.skillUsed) {
      participant.skillsUsed[result.skillUsed] += 1;
    }

    participant.totalWeight += result.weight;
    participant.rarityScore += this.fishingEngine.getRarityScore(result.rarity);
    participant.totalScore = this.calculateScore(participant);

    this.updateRanks(tournament);

    this.eventBus.emit('tournament:update', {
      tournamentId,
      playerId,
      totalWeight: participant.totalWeight,
      rarityScore: participant.rarityScore,
      totalScore: participant.totalScore,
      rank: participant.rank,
      remainingMs: tournament.endTime - Date.now(),
    });

    return participant;
  }

  private calculateScore(participant: TournamentParticipant): number {
    return participant.totalWeight * 1 + participant.rarityScore * 2;
  }

  private updateRanks(tournament: Tournament) {
    tournament.participants.sort((a, b) => b.totalScore - a.totalScore);
    tournament.participants.forEach((p, idx) => {
      p.rank = idx + 1;
    });
  }

  getLiveLeaderboard(tournamentId: string, limit: number = 10): TournamentParticipant[] {
    const tournament = this.store.tournaments.get(tournamentId);
    if (!tournament) return [];

    this.updateRanks(tournament);
    return tournament.participants.slice(0, limit);
  }

  getRemainingTime(tournamentId: string): number {
    const tournament = this.store.tournaments.get(tournamentId);
    if (!tournament) return 0;
    return Math.max(0, tournament.endTime - Date.now());
  }

  finalizeTournament(tournamentId: string): { success: boolean; winners?: TournamentParticipant[]; reason?: string } {
    const tournament = this.store.tournaments.get(tournamentId);
    if (!tournament) return { success: false, reason: '大赛不存在' };

    tournament.status = TournamentStatus.FINISHED;
    this.updateRanks(tournament);

    const winners: TournamentParticipant[] = [];
    for (let i = 0; i < Math.min(3, tournament.participants.length); i++) {
      const p = tournament.participants[i];
      const player = this.store.players.get(p.playerId);
      if (player && tournament.rewards.top3[i]) {
        const reward = tournament.rewards.top3[i];
        player.gold += reward.gold;
        for (const [mat, count] of Object.entries(reward.materials)) {
          player.materials[mat] = (player.materials[mat] || 0) + count;
        }
        for (const [bait, count] of Object.entries(reward.rareBaits)) {
          const existing = player.baits.find((b) => b.id === bait);
          if (existing) {
            existing.quantity += count;
          }
        }
        winners.push(p);
      }
    }

    for (let i = 3; i < tournament.participants.length; i++) {
      const p = tournament.participants[i];
      const player = this.store.players.get(p.playerId);
      if (player) {
        player.gold += tournament.rewards.participants.gold;
        for (const [mat, count] of Object.entries(tournament.rewards.participants.materials)) {
          player.materials[mat] = (player.materials[mat] || 0) + count;
        }
      }
    }

    this.eventBus.emit('tournament:finished', {
      tournamentId,
      name: tournament.name,
      winners: winners.map((w) => ({ playerId: w.playerId, playerName: w.playerName, rank: w.rank, score: w.totalScore })),
    });

    return { success: true, winners };
  }

  getActiveTournaments(): Tournament[] {
    return Array.from(this.store.tournaments.values()).filter(
      (t) => t.status === TournamentStatus.IN_PROGRESS || t.status === TournamentStatus.REGISTRATION
    );
  }

  isPlayerInTournament(playerId: string): Tournament | undefined {
    return Array.from(this.store.tournaments.values()).find(
      (t) =>
        (t.status === TournamentStatus.IN_PROGRESS || t.status === TournamentStatus.REGISTRATION) &&
        t.participants.some((p) => p.playerId === playerId)
    );
  }
}
