import { clearSession } from './session';

const defaultApiBaseUrl = 'http://127.0.0.1:3000/api';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl;

interface ApiResponse<T> {
  code: number | string;
  message: string;
  data: T;
}

interface RequestOptions {
  params?: Record<string, string | number | boolean | undefined>;
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
) => new Promise<T>((resolve, reject) => {
  const token = uni.getStorageSync('token') || '';

  uni.request({
    url: buildUrl(url, options?.params),
    method,
    data,
    timeout: 20000,
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

export const http = {
  get: <T = unknown>(url: string, options?: RequestOptions) => request<T>('GET', url, undefined, options),
  post: <T = unknown>(url: string, data?: unknown) => request<T>('POST', url, data),
  put: <T = unknown>(url: string, data?: unknown) => request<T>('PUT', url, data),
  delete: <T = unknown>(url: string, data?: unknown) => request<T>('DELETE', url, data)
};
