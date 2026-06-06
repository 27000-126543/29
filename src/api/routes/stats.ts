import { Router, Request, Response } from 'express';
import { GameServer } from '../../server/GameServer';
import { ok, fail } from '../response';

export function createStatsRouter(gameServer: GameServer): Router {
  const router = Router();

  router.get('/leaderboard', (req: Request, res: Response) => {
    const { type, playerId, limit } = req.query;

    const validTypes = ['total_weight', 'collection', 'cooking_level'];
    if (!type || typeof type !== 'string' || !validTypes.includes(type)) {
      return fail(res, '缺少或无效的 type 参数，必须是 total_weight、collection 或 cooking_level');
    }

    const limitNum = limit ? Number(limit) : 100;
    const board = gameServer.reportingSystem.getLeaderboard(
      type as 'total_weight' | 'collection' | 'cooking_level',
      limitNum
    );

    let myRank: number | undefined;
    if (playerId && typeof playerId === 'string') {
      myRank = gameServer.reportingSystem.getPlayerRank(
        playerId,
        type as 'total_weight' | 'collection' | 'cooking_level'
      );
    }

    return ok(res, { entries: board, myRank });
  });

  router.get('/report/weekly', (_req: Request, res: Response) => {
    const report = gameServer.reportingSystem.generateWeeklyReport();
    return ok(res, report);
  });

  router.get('/report/weekly/pdf', async (_req: Request, res: Response) => {
    try {
      const report = gameServer.reportingSystem.generateWeeklyReport();
      const pdfBuffer: Buffer = await gameServer.pdfExporter.exportWeeklyReport(report);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="weekly-report.pdf"');
      return res.send(pdfBuffer);
    } catch (err: any) {
      return fail(res, `PDF 生成失败: ${err.message || err}`, 500);
    }
  });

  return router;
}
