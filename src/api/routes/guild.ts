import { Router, Request, Response } from 'express';
import { GameServer } from '../../server/GameServer';
import { ok, fail } from '../response';
import { ApprovalStatus } from '../../types/enums';

export function createGuildRouter(gameServer: GameServer): Router {
  const router = Router();

  router.post('/create', (req: Request, res: Response) => {
    const { leaderId, name } = req.body;
    if (!leaderId) {
      return fail(res, '缺少 leaderId 参数');
    }
    if (!name) {
      return fail(res, '缺少 name 参数');
    }

    const result = gameServer.guildSystem.createGuild(leaderId, name);
    if (!result.success) {
      return fail(res, result.reason || '创建公会失败');
    }
    return ok(res, result);
  });

  router.get('/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const guild = gameServer.guildSystem.getGuild(id);
    if (!guild) {
      return fail(res, '公会不存在', 404);
    }
    return ok(res, guild);
  });

  router.post('/:id/join', (req: Request, res: Response) => {
    const { id } = req.params;
    const { playerId } = req.body;
    if (!playerId) {
      return fail(res, '缺少 playerId 参数');
    }

    const result = gameServer.guildSystem.joinGuild(playerId, id);
    if (!result.success) {
      return fail(res, result.reason || '加入公会失败');
    }
    return ok(res, result);
  });

  router.post('/pond/upgrade', (req: Request, res: Response) => {
    const { playerId } = req.body;
    if (!playerId) {
      return fail(res, '缺少 playerId 参数');
    }

    const result = gameServer.guildSystem.buildGuildPond(playerId);
    if (!result.success) {
      return fail(res, result.reason || '升级鱼塘失败');
    }
    return ok(res, result);
  });

  router.post('/approve/:queueType/:index', (req: Request, res: Response) => {
    const { queueType, index } = req.params;
    const { adminId, action } = req.body;

    if (!adminId) {
      return fail(res, '缺少 adminId 参数');
    }
    if (!action || (action !== ApprovalStatus.APPROVED && action !== ApprovalStatus.REJECTED)) {
      return fail(res, '缺少或无效的 action 参数，必须是 approved 或 rejected');
    }

    const idx = Number(index);
    if (isNaN(idx) || idx < 0) {
      return fail(res, '无效的 index 参数');
    }

    let result;
    if (queueType === 'building') {
      result = gameServer.guildSystem.approveBuildingUpgrade(adminId, idx, action as ApprovalStatus.APPROVED | ApprovalStatus.REJECTED);
    } else if (queueType === 'fish') {
      result = gameServer.guildSystem.approveFishStock(adminId, idx, action as ApprovalStatus.APPROVED | ApprovalStatus.REJECTED);
    } else if (queueType === 'recipe') {
      return fail(res, 'recipe 审批暂未实现');
    } else {
      return fail(res, `无效的 queueType: ${queueType}，必须是 building、fish 或 recipe`);
    }

    if (!result.success) {
      return fail(res, result.reason || '审批失败');
    }
    return ok(res, result);
  });

  return router;
}
