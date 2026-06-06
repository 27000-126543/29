import { DataStore } from '../store/DataStore';
import { TimeSystem } from '../systems/TimeSystem';
import { WeatherSystem } from '../systems/WeatherSystem';
import { FishingEngine } from '../systems/FishingEngine';
import { RodUpgradeSystem } from '../systems/RodUpgradeSystem';
import { BaitResearchSystem } from '../systems/BaitResearchSystem';
import { TournamentSystem } from '../systems/TournamentSystem';
import { CookingSystem } from '../systems/CookingSystem';
import { TradeMarketSystem } from '../systems/TradeMarketSystem';
import { GuildSystem } from '../systems/GuildSystem';
import { ReportingSystem } from '../systems/ReportingSystem';
import { PDFExporter } from '../systems/PDFExporter';
import { EventBus } from '../events/EventBus';
import { DataAggregator } from '../realtime/DataAggregator';
import { RealtimeServer } from '../realtime/RealtimeServer';
import { SkillType } from '../types/enums';

export class GameServer {
  public store: DataStore;
  public timeSystem: TimeSystem;
  public weatherSystem: WeatherSystem;
  public fishingEngine: FishingEngine;
  public rodSystem: RodUpgradeSystem;
  public baitSystem: BaitResearchSystem;
  public tournamentSystem: TournamentSystem;
  public cookingSystem: CookingSystem;
  public marketSystem: TradeMarketSystem;
  public guildSystem: GuildSystem;
  public reportingSystem: ReportingSystem;
  public pdfExporter: PDFExporter;
  public eventBus: EventBus;
  public aggregator: DataAggregator;
  public realtime?: RealtimeServer;

  constructor() {
    this.store = DataStore.getInstance();
    this.timeSystem = new TimeSystem(60);
    this.weatherSystem = new WeatherSystem();
    this.fishingEngine = new FishingEngine(this.store, this.timeSystem, this.weatherSystem);
    this.rodSystem = new RodUpgradeSystem(this.store);
    this.baitSystem = new BaitResearchSystem(this.store);
    this.eventBus = EventBus.getInstance();
    this.tournamentSystem = new TournamentSystem(this.store, this.fishingEngine, this.eventBus);
    this.cookingSystem = new CookingSystem(this.store);
    this.marketSystem = new TradeMarketSystem(this.store, this.eventBus);
    this.guildSystem = new GuildSystem(this.store, this.eventBus);
    this.reportingSystem = new ReportingSystem(this.store);
    this.pdfExporter = new PDFExporter(this.store);
    this.aggregator = DataAggregator.getInstance();
  }

  start(port: number = 3000) {
    this.aggregator.start(100);
    this.realtime = new RealtimeServer(port + 1);
    this.realtime.start();

    this.setupGameEventHandlers();
    this.startGameLoops();

    console.log('[GameServer] Core systems initialized');
    console.log(`[GameServer] WS Realtime on port ${port + 1}`);
    console.log('[GameServer] Ready');
  }

  private setupGameEventHandlers() {
    this.eventBus.on('fishing:cast', (ctx: any) => {
      if (!ctx.playerId) return;
      const result = this.fishingEngine.castLine(ctx.playerId, ctx.skill as SkillType);

      if (result.success) {
        this.aggregator.queueCatch({
          playerId: ctx.playerId,
          fishId: result.fishId,
          fishName: result.fishName,
          rarity: result.rarity,
          weight: result.weight,
          expGained: result.expGained,
          timestamp: Date.now(),
        });

        const tournament = this.tournamentSystem.isPlayerInTournament(ctx.playerId);
        if (tournament && tournament.status === 'in_progress') {
          this.tournamentSystem.recordCatch(tournament.id, ctx.playerId, result);
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

    this.eventBus.on('tournament:register', (ctx: any) => {
      const result = this.tournamentSystem.registerPlayer(ctx.tournamentId, ctx.playerId);
      if (this.realtime && ctx.clientId) {
        this.realtime.sendToClient(ctx.clientId, {
          type: 'tournament:register_result',
          data: result,
          requestId: ctx.requestId,
        });
      }
    });
  }

  private startGameLoops() {
    setInterval(() => {
      this.tournamentSystem.checkDailyTournaments();
      this.tournamentSystem.updateTournamentStates();
      this.marketSystem.cleanupExpired();
    }, 5000);

    setInterval(() => {
      const stats = this.aggregator.getStats();
      if (stats.pendingCatches > 0 || stats.pendingTournamentUpdates > 0) {
        console.log(`[Metrics] catches=${stats.totalCatchesProcessed} tournUpdates=${stats.totalTournamentUpdates} broadcasts=${stats.totalBroadcasts} peakBuf=${stats.peakBufferSize}`);
      }
    }, 60000);
  }

  demo(): void {
    const p1 = this.store.createPlayer('钓神张三');
    const p2 = this.store.createPlayer('渔翁李四');
    const p3 = this.store.createPlayer('海王王五');

    const guildResult = this.guildSystem.createGuild(p1.id, '龙宫公会');
    if (guildResult.success) {
      this.guildSystem.joinGuild(p2.id, guildResult.guild!.id);
      this.guildSystem.setRole(p1.id, p2.id, 2 as any);
    }

    p1.currentWaterAreaId = 'green_lake';
    p2.currentWaterAreaId = 'silver_river';
    p3.currentWaterAreaId = 'deep_ocean';

    console.log('\n=== 玩家信息 ===');
    for (const p of [p1, p2, p3]) {
      console.log(`玩家: ${p.nickname} (${p.id.slice(0, 8)})`);
      console.log(`  金币: ${p.gold} | 鱼竿: ${p.rods.map((r) => r.name).join(', ')}`);
      console.log(`  鱼饵: ${p.baits.map((b) => `${b.name}x${b.quantity}`).join(', ')}`);
    }

    console.log('\n=== 模拟 20 次抛竿 ===');
    for (let i = 0; i < 20; i++) {
      const result = this.fishingEngine.castLine(p1.id);
      if (result.success) {
        console.log(
          `[${i + 1}] ${p1.nickname} 钓到: ${result.fishName} (${result.rarity}) ${result.weight}kg +${result.expGained}EXP`
        );
      } else {
        console.log(`[${i + 1}] ${p1.nickname} 未中鱼`);
      }
    }

    console.log('\n=== 鱼竿升级测试 ===');
    const rod = p1.rods[0];
    const upResult = this.rodSystem.upgradeRod(p1.id, rod.instanceId);
    console.log(
      upResult.success
        ? `升级成功！${rod.name} Lv.${rod.level} → Lv.${upResult.rod?.level}`
        : `升级失败: ${upResult.reason}`
    );

    console.log('\n=== 交易行上架测试 ===');
    const fishKey = Object.keys(p1.inventory).find((k) => k.startsWith('fish_'));
    if (fishKey) {
      const fishId = fishKey.replace('fish_', '');
      const listResult = this.marketSystem.createListing(p1.id, 'fish', fishId, 1, 50);
      console.log(
        listResult.success
          ? `上架成功: ${listResult.listing?.itemName} 建议价 ${listResult.suggestedRange?.min}-${listResult.suggestedRange?.max} 定价 ${listResult.listing?.unitPrice}`
          : `上架失败: ${listResult.reason}`
      );

      if (listResult.listing) {
        const buyResult = this.marketSystem.buyListing(p2.id, listResult.listing.id, 1);
        console.log(
          buyResult.success
            ? `购买成功! 花费 ${buyResult.totalCost} 金币`
            : `购买失败: ${buyResult.reason}`
        );
      }
    }

    console.log('\n=== 烹饪测试 ===');
    const cookResult = this.cookingSystem.cook(p1.id, 'grilled_carp');
    console.log(
      cookResult.success
        ? `烹饪成功: ${cookResult.dish?.name} +${cookResult.expGained} EXP`
        : `烹饪失败: ${cookResult.reason}`
    );

    console.log('\n=== 排行榜测试 ===');
    const wBoard = this.reportingSystem.getLeaderboard('total_weight', 10);
    console.log('重量排行榜 Top 10:');
    wBoard.forEach((e) => console.log(`  #${e.rank} ${e.playerName} - ${e.value.toFixed(2)}kg`));

    console.log('\n=== 周报生成 ===');
    const report = this.reportingSystem.generateWeeklyReport();
    console.log(
      `周报: 第 ${report.weekNumber} 周 | 水域统计 ${Object.keys(report.waterAreaStats).length} 个 | Top钓手: ${
        report.topFishermen[0]?.playerName || '-'
      } ${report.topFishermen[0]?.totalWeight || 0}kg`
    );
    const pdf = this.pdfExporter.exportWeeklyReport(report, 'reports/weekly-demo.pdf');
    console.log('PDF 生成: reports/weekly-demo.pdf');

    console.log('\n=== 系统初始化完成 ===\n');
  }
}
