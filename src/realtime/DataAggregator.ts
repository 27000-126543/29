import { EventBus } from '../events/EventBus';

export class DataAggregator {
  private static instance: DataAggregator;
  private eventBus: EventBus;

  private catchBuffer: Array<any> = [];
  private tournamentUpdateBuffer: Map<string, Map<string, any>> = new Map();
  private flushIntervalMs: number = 100;
  private lastFlush: number = 0;

  private stats = {
    totalCatchesProcessed: 0,
    totalTournamentUpdates: 0,
    totalBroadcasts: 0,
    peakBufferSize: 0,
  };

  private constructor() {
    this.eventBus = EventBus.getInstance();
  }

  static getInstance(): DataAggregator {
    if (!DataAggregator.instance) {
      DataAggregator.instance = new DataAggregator();
    }
    return DataAggregator.instance;
  }

  start(flushIntervalMs: number = 100) {
    this.flushIntervalMs = flushIntervalMs;
    this.lastFlush = Date.now();
    this.loop();
  }

  private loop() {
    setInterval(() => this.flush(), this.flushIntervalMs);
  }

  queueCatch(catchData: any) {
    this.catchBuffer.push(catchData);
    if (this.catchBuffer.length > this.stats.peakBufferSize) {
      this.stats.peakBufferSize = this.catchBuffer.length;
    }
    if (this.catchBuffer.length >= 500) {
      this.flushCatches();
    }
  }

  queueTournamentUpdate(tournamentId: string, playerId: string, update: any) {
    if (!this.tournamentUpdateBuffer.has(tournamentId)) {
      this.tournamentUpdateBuffer.set(tournamentId, new Map());
    }
    this.tournamentUpdateBuffer.get(tournamentId)!.set(playerId, update);
    if (this.tournamentUpdateBuffer.get(tournamentId)!.size >= 200) {
      this.flushTournament(tournamentId);
    }
  }

  private flush() {
    this.flushCatches();
    this.tournamentUpdateBuffer.forEach((_, tournamentId) => {
      this.flushTournament(tournamentId);
    });
    this.lastFlush = Date.now();
  }

  private flushCatches() {
    if (this.catchBuffer.length === 0) return;

    const batch = this.catchBuffer.splice(0, this.catchBuffer.length);
    this.stats.totalCatchesProcessed += batch.length;

    const byPlayer: Record<string, any[]> = {};
    batch.forEach((c) => {
      if (!byPlayer[c.playerId]) byPlayer[c.playerId] = [];
      byPlayer[c.playerId].push(c);
    });

    Object.entries(byPlayer).forEach(([playerId, catches]) => {
      this.eventBus.emit('player:catches_batch', { playerId, catches });
    });

    this.stats.totalBroadcasts += Object.keys(byPlayer).length;
  }

  private flushTournament(tournamentId: string) {
    const playerUpdates = this.tournamentUpdateBuffer.get(tournamentId);
    if (!playerUpdates || playerUpdates.size === 0) return;

    const updates: any[] = [];
    playerUpdates.forEach((update, playerId) => {
      updates.push({ playerId, ...update });
    });

    this.stats.totalTournamentUpdates += updates.length;
    this.eventBus.emit('tournament:batch_update', { tournamentId, updates });
    this.stats.totalBroadcasts += 1;

    this.tournamentUpdateBuffer.delete(tournamentId);
  }

  getStats() {
    return {
      ...this.stats,
      pendingCatches: this.catchBuffer.length,
      pendingTournamentUpdates: Array.from(this.tournamentUpdateBuffer.values()).reduce(
        (sum, m) => sum + m.size,
        0
      ),
    };
  }
}
