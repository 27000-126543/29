import { Router, Request, Response } from 'express';
import { GameServer } from '../../server/GameServer';
import { ok, fail } from '../response';
import { TradeListing } from '../../types/interfaces';

export function createMarketRouter(gameServer: GameServer): Router {
  const router = Router();

  router.get('/listings', (req: Request, res: Response) => {
    const { itemType, itemId, minPrice, maxPrice } = req.query;

    const filters: Partial<{
      itemType: TradeListing['itemType'];
      itemId: string;
      minPrice: number;
      maxPrice: number;
    }> = {};

    if (itemType && typeof itemType === 'string') {
      filters.itemType = itemType as TradeListing['itemType'];
    }
    if (itemId && typeof itemId === 'string') {
      filters.itemId = itemId;
    }
    if (minPrice !== undefined) {
      const mp = Number(minPrice);
      if (!isNaN(mp)) filters.minPrice = mp;
    }
    if (maxPrice !== undefined) {
      const mp = Number(maxPrice);
      if (!isNaN(mp)) filters.maxPrice = mp;
    }

    const listings = gameServer.marketSystem.searchListings(filters);
    return ok(res, listings);
  });

  router.post('/listings', (req: Request, res: Response) => {
    const { sellerId, itemType, itemId, quantity, unitPrice } = req.body;
    if (!sellerId) {
      return fail(res, '缺少 sellerId 参数');
    }
    if (!itemType) {
      return fail(res, '缺少 itemType 参数');
    }
    if (!itemId) {
      return fail(res, '缺少 itemId 参数');
    }
    if (quantity === undefined || quantity === null) {
      return fail(res, '缺少 quantity 参数');
    }
    if (unitPrice === undefined || unitPrice === null) {
      return fail(res, '缺少 unitPrice 参数');
    }

    const result = gameServer.marketSystem.createListing(
      sellerId,
      itemType as TradeListing['itemType'],
      itemId,
      Number(quantity),
      Number(unitPrice)
    );

    if (!result.success) {
      return fail(res, result.reason || '上架失败');
    }
    return ok(res, result);
  });

  router.post('/listings/:id/buy', (req: Request, res: Response) => {
    const { id } = req.params;
    const { buyerId, quantity } = req.body;
    if (!buyerId) {
      return fail(res, '缺少 buyerId 参数');
    }

    const qty = quantity !== undefined ? Number(quantity) : undefined;
    const result = gameServer.marketSystem.buyListing(buyerId, id, qty);

    if (!result.success) {
      return fail(res, result.reason || '购买失败');
    }
    return ok(res, result);
  });

  router.get('/suggested-price', (req: Request, res: Response) => {
    const { itemType, itemId } = req.query;
    if (!itemType || typeof itemType !== 'string') {
      return fail(res, '缺少 itemType 参数');
    }
    if (!itemId || typeof itemId !== 'string') {
      return fail(res, '缺少 itemId 参数');
    }

    const price = gameServer.marketSystem.getSuggestedPrice(
      itemType as TradeListing['itemType'],
      itemId
    );
    return ok(res, price);
  });

  return router;
}
