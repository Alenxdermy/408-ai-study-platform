let defaultApiBaseUrl = 'http://127.0.0.1:3000/api';

// #ifdef MP-WEIXIN
defaultApiBaseUrl = 'http://localhost:3000/api';
// #endif

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

  const parsedUrl = new URL(fullUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') parsedUrl.searchParams.set(key, String(value));
  });
  return parsedUrl.toString();
};

let isRefreshing = false;
const refreshPromise = Promise.resolve();

const refreshToken = async (): Promise<string> => {
  if (isRefreshing) return refreshPromise;
  isRefreshing = true;

  try {
    uni.removeStorageSync('token');
    uni.removeStorageSync('user');

    const response = await new Promise<{ code: number; data: { token: string } }>((resolve, reject) => {
      uni.request({
        url: `${API_BASE_URL}/auth/mock-login`,
        method: 'POST',
        data: { nickname: '408 考生' },
        timeout: 10000,
        header: { 'Content-Type': 'application/json' },
        success: res => resolve(res.data as { code: number; data: { token: string } }),
        fail: err => reject(err)
      });
    });

    if (response.code === 0) {
      const newToken = response.data.token;
      uni.setStorageSync('token', newToken);
      return newToken;
    }
    throw new Error('获取令牌失败');
  } finally {
    isRefreshing = false;
  }
};

const request = async <T>(
  method: UniApp.RequestOptions['method'],
  url: string,
  data?: unknown,
  options?: RequestOptions,
  retryCount = 0
) => {
  const token = uni.getStorageSync('token') || '';

  return new Promise<T>((resolve, reject) => {
    uni.request({
      url: buildUrl(url, options?.params),
      method,
      data,
      timeout: 20000,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      success: async response => {
        const body = response.data as ApiResponse<T>;
        if (response.statusCode >= 200 && response.statusCode < 300 && body?.code === 0) {
          resolve(body.data);
          return;
        }

        if (response.statusCode === 401 && retryCount < 1) {
          try {
            await refreshToken();
            const result = await request<T>(method, url, data, options, retryCount + 1);
            resolve(result);
          } catch {
            reject(new Error(body?.message || '登录失败'));
          }
          return;
        }

        reject(new Error(body?.message || `请求失败：${response.statusCode}`));
      },
      fail: error => reject(error)
    });
  });
};

export const http = {
  get: <T = unknown>(url: string, options?: RequestOptions) => request<T>('GET', url, undefined, options),
  post: <T = unknown>(url: string, data?: unknown) => request<T>('POST', url, data)
};

