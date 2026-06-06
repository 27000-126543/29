import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  reason?: string;
}

export function ok<T>(res: Response, data?: T): Response<ApiResponse<T>> {
  return res.json({ success: true, data });
}

export function fail(res: Response, reason: string, status: number = 400): Response<ApiResponse> {
  return res.status(status).json({ success: false, reason });
}
