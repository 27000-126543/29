import { Router, Request, Response } from 'express';
import { GameServer } from '../../server/GameServer';
import { ok, fail } from '../response';
import { v4 as uuidv4 } from 'uuid';

export function createPlayerRouter(gameServer: GameServer): Router {
  const router = Router();
  const tokens: Map<string, string> = new Map();

  router.post('/login', (req: Request, res: Response) => {
    const { nickname } = req.body;
    if (!nickname || typeof nickname !== 'string' || nickname.trim().length === 0) {
      return fail(res, '缺少 nickname 参数');
    }

    const player = gameServer.store.createPlayer(nickname.trim());
    const token = uuidv4();
    tokens.set(token, player.id);

    return ok(res, { player, token });
  });

  router.get('/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const player = gameServer.store.players.get(id);
    if (!player) {
      return fail(res, '玩家不存在', 404);
    }
    return ok(res, player);
  });

  router.get('/:id/inventory', (req: Request, res: Response) => {
    const { id } = req.params;
    const player = gameServer.store.players.get(id);
    if (!player) {
      return fail(res, '玩家不存在', 404);
    }

    const fishes: Array<{ fishId: string; name: string; quantity: number }> = [];
    const dishes: Array<{ dishId: string; name: string; quantity: number }> = [];
    const materials: Array<{ materialId: string; quantity: number }> = [];

    for (const [key, quantity] of Object.entries(player.inventory)) {
      if (key.startsWith('fish_')) {
        const fishId = key.replace('fish_', '');
        const fish = gameServer.store.fishSpecies.get(fishId);
        fishes.push({ fishId, name: fish?.name || fishId, quantity });
      } else if (key.startsWith('dish_')) {
        const dishId = key.replace('dish_', '');
        const dish = gameServer.store.dishes.get(dishId);
        dishes.push({ dishId, name: dish?.name || dishId, quantity });
      } else if (key.startsWith('bait_')) {
        const baitId = key.replace('bait_', '');
        const bait = gameServer.store.baitTemplates.get(baitId);
        materials.push({ materialId: key, quantity });
      } else {
        materials.push({ materialId: key, quantity });
      }
    }

    for (const [materialId, quantity] of Object.entries(player.materials)) {
      materials.push({ materialId, quantity });
    }

    return ok(res, { fishes, dishes, materials });
  });

  return router;
}
