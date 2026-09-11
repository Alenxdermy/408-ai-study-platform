import { clearSession } from './session';

declare const wx: any;

const defaultApiBaseUrl = 'http://127.0.0.1:3000/api';
const cloudFunctionName = import.meta.env.VITE_CLOUD_FUNCTION_NAME ?? 'api';
const cloudEnv = import.meta.env.VITE_CLOUD_ENV ?? 'cloudbase-d8gk6gtnw00fe55a2';
let cloudInited = false;

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl;

interface ApiResponse<T> {
  code: number | string;
  message: string;
  data: T;
}

interface RequestOptions {
  params?: Record<string, string | number | boolean | undefined>;
  timeout?: number;
}

const buildUrl = (url: string, params?: RequestOptions['params']) => {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  if (!params) return fullUrl;

  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');

  if (!query) return fullUrl;
  return `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}${query}`;
};

const request = async <T>(
  method: UniApp.RequestOptions['method'],
  url: string,
  data?: unknown,
  options?: RequestOptions
) => {
  const token = uni.getStorageSync('token') || '';

  // #ifdef MP-WEIXIN
  if (import.meta.env.VITE_USE_CLOUD !== 'false') {
    if (typeof wx === 'undefined' || !wx.cloud) {
      throw new Error('云开发不可用，请确认用微信开发者工具打开项目根目录');
    }
    if (!cloudInited) {
      wx.cloud.init({ env: cloudEnv, traceUser: true });
      cloudInited = true;
    }
    try {
      const response = await wx.cloud.callFunction({
        name: cloudFunctionName,
        data: {
          method,
          path: url,
          body: data,
          params: options?.params,
          token
        }
      });
      const body = response.result as ApiResponse<T> | undefined;
      if (body?.code === 0) return body.data;
      if (body?.code === 401) clearSession();
      throw new Error(body?.message || '云函数请求失败');
    } catch (error) {
      throw error instanceof Error ? error : new Error('云函数请求失败');
    }
  }
  // #endif

  return new Promise<T>((resolve, reject) => {
  uni.request({
    url: buildUrl(url, options?.params),
    method,
    data,
    ...(options?.timeout ? { timeout: options.timeout } : {}),
    header: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    success: response => {
      const body = response.data as ApiResponse<T> | undefined;
      if (response.statusCode >= 200 && response.statusCode < 300 && body?.code === 0) {
        resolve(body.data);
        return;
      }

      if (response.statusCode === 401) {
        clearSession();
      }

      const message = body?.message || `请求失败：${response.statusCode}`;
      reject(new Error(message));
    },
    fail: error => reject(error)
  });
  });
};

export const http = {
  get: <T = unknown>(url: string, options?: RequestOptions) => request<T>('GET', url, undefined, options),
  post: <T = unknown>(url: string, data?: unknown, options?: RequestOptions) => request<T>('POST', url, data, options),
  put: <T = unknown>(url: string, data?: unknown, options?: RequestOptions) => request<T>('PUT', url, data, options),
  delete: <T = unknown>(url: string, data?: unknown, options?: RequestOptions) => request<T>('DELETE', url, data, options)
};
