import { WebSocketServer, WebSocket } from 'ws';
import { EventBus } from '../events/EventBus';
import { DataAggregator } from './DataAggregator';
import { SkillType } from '../types/enums';

interface WsMessage {
  type: string;
  data?: any;
  requestId?: string;
}

export class RealtimeServer {
  private wss: WebSocketServer;
  private eventBus: EventBus;
  private aggregator: DataAggregator;
  private clients: Map<string, WebSocket> = new Map();
  private playerToClient: Map<string, string> = new Map();
  private tournamentViewers: Map<string, Set<string>> = new Map();

  constructor(private port: number) {
    this.eventBus = EventBus.getInstance();
    this.aggregator = DataAggregator.getInstance();
    this.wss = new WebSocketServer({ port });

    this.setupEventListeners();
    this.setupAggregatorListeners();
  }

  private setupEventListeners() {
    this.eventBus.on('tournament:update', (data: any) => {
      this.aggregator.queueTournamentUpdate(data.tournamentId, data.playerId, data);
    });

    this.eventBus.on('tournament:batch_update', (data: any) => {
      this.broadcastToTournament(data.tournamentId, {
        type: 'tournament:leaderboard',
        data: data.updates,
      });
    });

    this.eventBus.on('tournament:announce', (data: any) => {
      this.broadcastAll({
        type: 'announcement:tournament',
        data,
      });
    });

    this.eventBus.on('tournament:started', (data: any) => {
      this.broadcastAll({
        type: 'announcement:tournament_started',
        data,
      });
    });

    this.eventBus.on('tournament:finished', (data: any) => {
      this.broadcastAll({
        type: 'announcement:tournament_finished',
        data,
      });
    });

    this.eventBus.on('market:sold', (data: any) => {
      this.broadcastAll({
        type: 'announcement:trade',
        data,
      });
    });

    this.eventBus.on('guild:pond_upgraded', (data: any) => {
      this.broadcastAll({
        type: 'announcement:guild',
        data,
      });
    });
  }

  private setupAggregatorListeners() {
    this.eventBus.on('player:catches_batch', (data: any) => {
      const clientId = this.playerToClient.get(data.playerId);
      if (clientId) {
        this.sendToClient(clientId, {
          type: 'fishing:batch_result',
          data: data.catches,
        });
      }
    });
  }

  start() {
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      this.clients.set(clientId, ws);

      ws.on('message', (raw) => {
        try {
          const msg: WsMessage = JSON.parse(raw.toString());
          this.handleMessage(clientId, ws, msg);
        } catch (e) {
          this.sendToClient(clientId, { type: 'error', data: { message: 'Invalid JSON' } });
        }
      });

      ws.on('close', () => {
        this.playerToClient.forEach((cid, pid) => {
          if (cid === clientId) this.playerToClient.delete(pid);
        });
        this.tournamentViewers.forEach((viewers) => viewers.delete(clientId));
        this.clients.delete(clientId);
      });

      this.sendToClient(clientId, { type: 'connected', data: { clientId } });
    });

    console.log(`[Realtime] WebSocket server listening on port ${this.port}`);
  }

  private handleMessage(clientId: string, ws: WebSocket, msg: WsMessage) {
    switch (msg.type) {
      case 'auth':
        this.handleAuth(clientId, msg.data);
        break;
      case 'fishing:cast':
        this.emitGameEvent('fishing:cast', {
          playerId: msg.data?.playerId,
          skill: msg.data?.skill as SkillType,
          clientId,
          requestId: msg.requestId,
        });
        break;
      case 'tournament:register':
        this.emitGameEvent('tournament:register', {
          playerId: msg.data?.playerId,
          tournamentId: msg.data?.tournamentId,
          clientId,
          requestId: msg.requestId,
        });
        break;
      case 'tournament:watch':
        this.watchTournament(clientId, msg.data?.tournamentId);
        break;
      case 'tournament:unwatch':
        this.unwatchTournament(clientId, msg.data?.tournamentId);
        break;
      case 'ping':
        this.sendToClient(clientId, { type: 'pong', data: { ts: Date.now() } });
        break;
      default:
        this.emitGameEvent(msg.type, { ...msg.data, clientId, requestId: msg.requestId });
    }
  }

  private handleAuth(clientId: string, data: any) {
    const playerId = data?.playerId;
    if (playerId) {
      this.playerToClient.set(playerId, clientId);
      this.sendToClient(clientId, { type: 'auth:success', data: { playerId } });
    } else {
      this.sendToClient(clientId, { type: 'auth:failed', data: { message: 'Missing playerId' } });
    }
  }

  private watchTournament(clientId: string, tournamentId: string) {
    if (!this.tournamentViewers.has(tournamentId)) {
      this.tournamentViewers.set(tournamentId, new Set());
    }
    this.tournamentViewers.get(tournamentId)!.add(clientId);
    this.sendToClient(clientId, { type: 'tournament:watch_started', data: { tournamentId } });
  }

  private unwatchTournament(clientId: string, tournamentId: string) {
    this.tournamentViewers.get(tournamentId)?.delete(clientId);
    this.sendToClient(clientId, { type: 'tournament:watch_stopped', data: { tournamentId } });
  }

  private emitGameEvent(event: string, data: any) {
    this.eventBus.emit(event, data);
  }

  sendResponse(playerId: string, type: string, data: any, requestId?: string) {
    const clientId = this.playerToClient.get(playerId);
    if (clientId) {
      this.sendToClient(clientId, { type, data, requestId });
    }
  }

  sendToClient(clientId: string, msg: WsMessage) {
    const ws = this.clients.get(clientId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(msg));
      } catch (e) {}
    }
  }

  broadcastAll(msg: WsMessage) {
    const payload = JSON.stringify(msg);
    this.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(payload); } catch (e) {}
      }
    });
  }

  broadcastToTournament(tournamentId: string, msg: WsMessage) {
    const viewers = this.tournamentViewers.get(tournamentId);
    if (!viewers) return;
    const payload = JSON.stringify(msg);
    viewers.forEach((clientId) => {
      const ws = this.clients.get(clientId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(payload); } catch (e) {}
      }
    });
  }

  getConnectionCount(): number {
    return this.clients.size;
  }

  private generateClientId(): string {
    return `cli_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
