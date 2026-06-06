import axios, { AxiosRequestConfig } from 'axios';
import { useGameStore } from '../store/useGameStore';

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  reason?: string;
}

const instance = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

instance.interceptors.request.use((config) => {
  const player = useGameStore.getState().player;
  if (player?.id) {
    config.headers['X-Player-Id'] = player.id;
  }
  return config;
});

instance.interceptors.response.use(
  (response) => response.data as unknown as typeof response,
  (error) => {
    console.error('API Error:', error?.message || error);
    return Promise.reject(error);
  }
);

const apiClient = {
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const res = (await instance.get(url, config)) as ApiResult<T>;
    if (!res.success) throw new Error(res.reason || '请求失败');
    return res.data as T;
  },
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const res = (await instance.post(url, data, config)) as ApiResult<T>;
    if (!res.success) throw new Error(res.reason || '请求失败');
    return res.data as T;
  },
  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const res = (await instance.put(url, data, config)) as ApiResult<T>;
    if (!res.success) throw new Error(res.reason || '请求失败');
    return res.data as T;
  },
  async del<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const res = (await instance.delete(url, config)) as ApiResult<T>;
    if (!res.success) throw new Error(res.reason || '请求失败');
    return res.data as T;
  },
  rawGet(url: string, config?: AxiosRequestConfig) {
    return instance.get(url, { ...config, responseType: config?.responseType || 'json' });
  },
} as const;

export default apiClient;
