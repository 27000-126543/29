import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import http from 'http';
import { GameServer } from '../server/GameServer';
import { RealtimeServer } from '../realtime/RealtimeServer';
import { createPlayerRouter } from './routes/player';
import { createFishingRouter } from './routes/fishing';
import { createMarketRouter } from './routes/market';
import { createCookingRouter } from './routes/cooking';
import { createGuildRouter } from './routes/guild';
import { createTournamentRouter } from './routes/tournament';
import { createStatsRouter } from './routes/stats';
import { ok } from './response';

export class ApiServer {
  private app: Express;
  private gameServer: GameServer;
  private realtime?: RealtimeServer;
  private httpServer?: http.Server;

  constructor(gameServer: GameServer) {
    this.gameServer = gameServer;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandler();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes(): void {
    this.app.get('/health', (_req: Request, res: Response) => {
      return ok(res, {
        status: 'ok',
        timestamp: Date.now(),
        players: this.gameServer.store.players.size,
        tournaments: this.gameServer.store.tournaments.size,
        listings: this.gameServer.store.tradeListings.size,
        websocketConnections: this.realtime?.getConnectionCount() || 0,
      });
    });

    this.app.use('/api/player', createPlayerRouter(this.gameServer));
    this.app.use('/api/fishing', createFishingRouter(this.gameServer));
    this.app.use('/api/market', createMarketRouter(this.gameServer));
    this.app.use('/api/cooking', createCookingRouter(this.gameServer));
    this.app.use('/api/guild', createGuildRouter(this.gameServer));
    this.app.use('/api/tournaments', createTournamentRouter(this.gameServer));
    this.app.use('/api', createStatsRouter(this.gameServer));
  }

  private setupErrorHandler(): void {
    this.app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      console.error('[ApiServer] Unhandled error:', err);
      res.status(500).json({
        success: false,
        reason: err.message || 'Internal Server Error',
      });
    });
  }

  start(port: number = 3000): void {
    this.gameServer.aggregator.start(100);

    this.realtime = new RealtimeServer(port + 1);
    this.realtime.start();

    (this.gameServer as any).realtime = this.realtime;

    this.setupGameEventHandlers();
    this.startGameLoops();

    this.httpServer = this.app.listen(port, () => {
      console.log(`[ApiServer] REST API listening on port ${port}`);
      console.log(`[ApiServer] WebSocket listening on port ${port + 1}`);
      console.log('[ApiServer] Ready');
    });
  }

  private setupGameEventHandlers(): void {
    const eventBus = this.gameServer.eventBus;

    eventBus.on('fishing:cast', (ctx: any) => {
      if (!ctx.playerId) return;
      const result = this.gameServer.fishingEngine.castLine(ctx.playerId, ctx.skill);

      if (result.success) {
        this.gameServer.aggregator.queueCatch({
          playerId: ctx.playerId,
          fishId: result.fishId!,
          fishName: result.fishName!,
          rarity: result.rarity!,
          weight: result.weight!,
          expGained: result.expGained!,
          timestamp: Date.now(),
        });

        const tournament = this.gameServer.tournamentSystem.isPlayerInTournament(ctx.playerId);
        if (tournament && tournament.status === 'in_progress') {
          this.gameServer.tournamentSystem.recordCatch(tournament.id, ctx.playerId, result);
        }
      }

      if (this.realtime && ctx.clientId) {
        this.realtime.sendToClient(ctx.clientId, {
          type: 'fishing:result',
          data: result,
          requestId: ctx.requestId,
        });
      }
    });

    eventBus.on('tournament:register', (ctx: any) => {
      const result = this.gameServer.tournamentSystem.registerPlayer(ctx.tournamentId, ctx.playerId);
      if (this.realtime && ctx.clientId) {
        this.realtime.sendToClient(ctx.clientId, {
          type: 'tournament:register_result',
          data: result,
          requestId: ctx.requestId,
        });
      }
    });
  }

  private startGameLoops(): void {
    setInterval(() => {
      this.gameServer.tournamentSystem.checkDailyTournaments();
      this.gameServer.tournamentSystem.updateTournamentStates();
      this.gameServer.marketSystem.cleanupExpired();
    }, 5000);

    setInterval(() => {
      const stats = this.gameServer.aggregator.getStats();
      if (stats.pendingCatches > 0 || stats.pendingTournamentUpdates > 0) {
        console.log(
          `[Metrics] catches=${stats.totalCatchesProcessed} tournUpdates=${stats.totalTournamentUpdates} broadcasts=${stats.totalBroadcasts} peakBuf=${stats.peakBufferSize}`
        );
      }
    }, 60000);
  }

  stop(): void {
    if (this.httpServer) {
      this.httpServer.close();
    }
  }
}
