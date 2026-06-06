import { Router, Request, Response } from 'express';
import { GameServer } from '../../server/GameServer';
import { ok, fail } from '../response';

export function createCookingRouter(gameServer: GameServer): Router {
  const router = Router();

  router.get('/recipes', (req: Request, res: Response) => {
    const { playerId } = req.query;
    if (!playerId || typeof playerId !== 'string') {
      return fail(res, '缺少 playerId 参数');
    }

    const player = gameServer.store.players.get(playerId);
    if (!player) {
      return fail(res, '玩家不存在', 404);
    }

    const recipes = gameServer.cookingSystem.getAvailableRecipes(player);
    return ok(res, recipes);
  });

  router.post('/cook', (req: Request, res: Response) => {
    const { playerId, dishId } = req.body;
    if (!playerId) {
      return fail(res, '缺少 playerId 参数');
    }
    if (!dishId) {
      return fail(res, '缺少 dishId 参数');
    }

    const result = gameServer.cookingSystem.cook(playerId, dishId);
    if (!result.success) {
      return fail(res, result.reason || '烹饪失败');
    }
    return ok(res, result);
  });

  return router;
}
