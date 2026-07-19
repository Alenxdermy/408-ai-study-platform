export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3000/api';

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

const request = async <T>(
  method: UniApp.RequestOptions['method'],
  url: string,
  data?: unknown,
  options?: RequestOptions
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
      success: response => {
        const body = response.data as ApiResponse<T>;
        if (response.statusCode >= 200 && response.statusCode < 300 && body?.code === 0) {
          resolve(body.data);
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
