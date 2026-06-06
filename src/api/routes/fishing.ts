import { Router, Request, Response } from 'express';
import { GameServer } from '../../server/GameServer';
import { ok, fail } from '../response';
import { SkillType } from '../../types/enums';

export function createFishingRouter(gameServer: GameServer): Router {
  const router = Router();

  router.get('/water-areas', (_req: Request, res: Response) => {
    const areas = Array.from(gameServer.store.waterAreas.values()).map((area) => ({
      ...area,
      weather: gameServer.weatherSystem.getWeather(area.id),
    }));
    return ok(res, areas);
  });

  router.post('/cast', (req: Request, res: Response) => {
    const { playerId, waterAreaId, skill } = req.body;
    if (!playerId) {
      return fail(res, '缺少 playerId 参数');
    }
    if (!waterAreaId) {
      return fail(res, '缺少 waterAreaId 参数');
    }

    const player = gameServer.store.players.get(playerId);
    if (!player) {
      return fail(res, '玩家不存在', 404);
    }

    const waterArea = gameServer.store.waterAreas.get(waterAreaId);
    if (!waterArea) {
      return fail(res, '水域不存在', 404);
    }

    player.currentWaterAreaId = waterAreaId;

    let skillUsed: SkillType | undefined;
    if (skill && Object.values(SkillType).includes(skill as SkillType)) {
      skillUsed = skill as SkillType;
    }

    const result = gameServer.fishingEngine.castLine(playerId, skillUsed);

    if (result.success) {
      gameServer.aggregator.queueCatch({
        playerId,
        fishId: result.fishId!,
        fishName: result.fishName!,
        rarity: result.rarity!,
        weight: result.weight!,
        expGained: result.expGained!,
        timestamp: Date.now(),
      });

      const tournament = gameServer.tournamentSystem.isPlayerInTournament(playerId);
      if (tournament && tournament.status === 'in_progress') {
        gameServer.tournamentSystem.recordCatch(tournament.id, playerId, result);
      }
    }

    return ok(res, result);
  });

  router.post('/rod/upgrade', (req: Request, res: Response) => {
    const { playerId, rodInstanceId } = req.body;
    if (!playerId) {
      return fail(res, '缺少 playerId 参数');
    }
    if (!rodInstanceId) {
      return fail(res, '缺少 rodInstanceId 参数');
    }

    const result = gameServer.rodSystem.upgradeRod(playerId, rodInstanceId);
    if (!result.success) {
      return fail(res, result.reason || '升级失败');
    }
    return ok(res, result);
  });

  router.get('/fish-species', (_req: Request, res: Response) => {
    const species = Array.from(gameServer.store.fishSpecies.values());
    return ok(res, species);
  });

  return router;
}
