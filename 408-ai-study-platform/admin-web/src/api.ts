export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3000/api';

export interface QuestionItem {
  id: string;
  stem: string;
  subject: string;
  type: string;
  difficulty: number;
  options: Array<{ key: string; content: string }>;
  answer: string | string[];
  explanation: string;
  source: string;
  year: number | null;
  status: string;
  tags?: string[];
}

interface ApiResponse<T> {
  code: number | string;
  message: string;
  data: T;
}

const buildUrl = (path: string, params?: Record<string, string | number | undefined>) => {
  const url = new URL(`${API_BASE_URL}${path}`);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  });
  return url.toString();
};

export const request = async <T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | number | undefined>
) => {
  const response = await fetch(buildUrl(path, params), {
    method,
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    headers: body instanceof FormData || body === undefined ? undefined : { 'Content-Type': 'application/json' }
  });
  const payload = await response.json() as ApiResponse<T>;
  if (!response.ok || payload.code !== 0) throw new Error(payload.message || '请求失败');
  return payload.data;
};

export const api = {
  stats: () => request<any>('GET', '/admin/questions/stats'),
  list: (params: Record<string, string | number | undefined>) =>
    request<{ items: QuestionItem[]; total: number; page: number; pageSize: number }>('GET', '/admin/questions', undefined, params),
  create: (body: Record<string, unknown>) => request<QuestionItem>('POST', '/admin/questions', body),
  update: (id: string, body: Record<string, unknown>) => request<QuestionItem>('PUT', `/admin/questions/${id}`, body),
  remove: (id: string) => request<{ deleted: boolean }>('DELETE', `/admin/questions/${id}`),
  importJson: (jsonText: string) => request<{ created: number; updated: number; total: number; items: QuestionItem[] }>('POST', '/admin/questions/import', { jsonText }),
  importPdf: (formData: FormData) =>
    request<{ created: number; updated: number; total: number; items: QuestionItem[] }>('POST', '/admin/questions/import-pdf', formData),
  import2025: () => request<{ created: number; updated: number; total: number; items: QuestionItem[] }>('POST', '/admin/questions/import-2025')
};
