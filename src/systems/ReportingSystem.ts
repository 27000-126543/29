import { DataStore } from '../store/DataStore';
import { WeeklyReport, WaterAreaWeeklyStat, LeaderboardEntry } from '../types/interfaces';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

export class ReportingSystem {
  private store: DataStore;

  constructor(store: DataStore) {
    this.store = store;
  }

  generateWeeklyReport(asOf: number = Date.now()): WeeklyReport {
    const now = dayjs(asOf);
    const weekStart = now.startOf('isoWeek').valueOf();
    const weekEnd = now.endOf('isoWeek').valueOf();

    const waterAreaStats: Record<string, WaterAreaWeeklyStat> = {};
    this.store.waterAreas.forEach((area) => {
      waterAreaStats[area.id] = {
        waterAreaId: area.id,
        waterAreaName: area.name,
        fishDistribution: {},
        totalCatches: 0,
        totalWeight: 0,
        avgWeight: 0,
      };
    });

    const dateBuckets: Record<string, { weights: number[]; count: number }> = {};
    const cookingConsumption: Record<string, number> = {};
    const playerCatchWeights: Record<string, { name: string; weight: number }> = {};

    this.store.catchHistory.forEach((rec) => {
      if (rec.timestamp >= weekStart && rec.timestamp <= weekEnd) {
        const stat = waterAreaStats[rec.waterAreaId];
        if (stat) {
          stat.totalCatches += 1;
          stat.totalWeight += rec.weight;
          stat.fishDistribution[rec.fishId] = (stat.fishDistribution[rec.fishId] || 0) + 1;
        }

        const dateKey = dayjs(rec.timestamp).format('YYYY-MM-DD');
        if (!dateBuckets[dateKey]) dateBuckets[dateKey] = { weights: [], count: 0 };
        dateBuckets[dateKey].weights.push(rec.weight);
        dateBuckets[dateKey].count += 1;

        if (!playerCatchWeights[rec.playerId]) {
          const p = this.store.players.get(rec.playerId);
          playerCatchWeights[rec.playerId] = { name: p?.nickname || 'Unknown', weight: 0 };
        }
        playerCatchWeights[rec.playerId].weight += rec.weight;
      }
    });

    Object.values(waterAreaStats).forEach((s) => {
      s.avgWeight = s.totalCatches > 0 ? s.totalWeight / s.totalCatches : 0;
    });

    const efficiencyTrend = Object.entries(dateBuckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        avgWeight: data.weights.length > 0
          ? data.weights.reduce((s, w) => s + w, 0) / data.weights.length
          : 0,
        totalCatches: data.count,
      }));

    this.store.cookingHistory.forEach((rec) => {
      if (rec.timestamp >= weekStart && rec.timestamp <= weekEnd) {
        cookingConsumption[rec.dishId] = (cookingConsumption[rec.dishId] || 0) + 1;
      }
    });

    const topFishermen = Object.entries(playerCatchWeights)
      .sort(([, a], [, b]) => b.weight - a.weight)
      .slice(0, 10)
      .map(([playerId, data]) => ({
        playerId,
        playerName: data.name,
        totalWeight: parseFloat(data.weight.toFixed(2)),
      }));

    return {
      weekNumber: now.isoWeek(),
      year: now.isoWeekYear(),
      startDate: weekStart,
      endDate: weekEnd,
      waterAreaStats,
      efficiencyTrend,
      cookingConsumption,
      topFishermen,
    };
  }

  getLeaderboard(
    type: 'total_weight' | 'collection' | 'cooking_level',
    limit: number = 100
  ): LeaderboardEntry[] {
    const entries: LeaderboardEntry[] = [];

    this.store.players.forEach((player) => {
      let value = 0;
      switch (type) {
        case 'total_weight':
          value = player.totalWeightCaught;
          break;
        case 'collection':
          value = Object.keys(player.collectedFish).length;
          break;
        case 'cooking_level':
          value = player.cookingLevel * 1000 + player.cookingExp;
          break;
      }

      entries.push({
        playerId: player.id,
        playerName: player.nickname,
        value,
        rank: 0,
      });
    });

    entries.sort((a, b) => b.value - a.value);
    entries.forEach((e, i) => (e.rank = i + 1));

    return entries.slice(0, limit);
  }

  getPlayerRank(playerId: string, type: 'total_weight' | 'collection' | 'cooking_level'): number {
    const board = this.getLeaderboard(type, 1000000);
    const entry = board.find((e) => e.playerId === playerId);
    return entry?.rank || -1;
  }
}
