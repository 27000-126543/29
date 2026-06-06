import { Router, Request, Response } from 'express';
import { GameServer } from '../../server/GameServer';
import { ok, fail } from '../response';

export function createTournamentRouter(gameServer: GameServer): Router {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    const tournaments = Array.from(gameServer.store.tournaments.values());
    return ok(res, tournaments);
  });

  router.post('/:id/register', (req: Request, res: Response) => {
    const { id } = req.params;
    const { playerId } = req.body;
    if (!playerId) {
      return fail(res, '缺少 playerId 参数');
    }

    const result = gameServer.tournamentSystem.registerPlayer(id, playerId);
    if (!result.success) {
      return fail(res, result.reason || '报名失败');
    }
    return ok(res, result);
  });

  router.get('/:id/leaderboard', (req: Request, res: Response) => {
    const { id } = req.params;
    const { limit } = req.query;
    const limitNum = limit ? Number(limit) : 10;
    const tournament = gameServer.store.tournaments.get(id);
    const participants = gameServer.tournamentSystem.getLiveLeaderboard(id, limitNum);
    const remainingMs = gameServer.tournamentSystem.getRemainingTime(id);
    const status = tournament?.status;
    return ok(res, { participants, remainingMs, status });
  });

  return router;
}
