import cloudbase from '@cloudbase/js-sdk';
import { registerAuth } from '@cloudbase/js-sdk/auth';
import { registerFunctions } from '@cloudbase/js-sdk/functions';

registerAuth(cloudbase);
registerFunctions(cloudbase);

const CLOUD_ENV = import.meta.env.VITE_CLOUD_ENV ?? 'cloudbase-d8gk6gtnw00fe55a2';
const CLOUD_FUNCTION_NAME = import.meta.env.VITE_CLOUD_FUNCTION_NAME ?? 'api';
const CLOUD_ACCESS_KEY = import.meta.env.VITE_CLOUD_PUBLISHABLE_KEY ?? '';

export const API_BASE_URL = `CloudBase 云函数：${CLOUD_FUNCTION_NAME} @ ${CLOUD_ENV}`;

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

export interface ImportJob {
  id: string;
  status: 'queued' | 'processing' | 'succeeded' | 'failed';
  fileName: string;
  year?: number;
  stage: string;
  result?: { created: number; updated: number; skipped: number; total: number; items: QuestionItem[] };
  error?: string;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T> {
  code: number | string;
  message: string;
  data: T;
}

const cloudApp = cloudbase.init({
  env: CLOUD_ENV,
  region: 'ap-shanghai',
  accessKey: CLOUD_ACCESS_KEY,
  throw: true,
  auth: { detectSessionInUrl: true }
});

interface CloudAuth {
  getSession?: () => Promise<{ data?: { session?: unknown }; error?: { message?: string } }>;
  signInAnonymously: (data?: { provider_token?: string }) => Promise<{
    data?: unknown;
    error?: { message?: string; code?: string };
  }>;
}

const getAuth = (): CloudAuth => {
  const raw = (cloudApp as { auth?: CloudAuth }).auth;
  if (raw && typeof raw.signInAnonymously === 'function') {
    return raw;
  }
  throw new Error('CloudBase Auth 不可用，请确认已安装 @cloudbase/js-sdk');
};

const AUTH_HINT =
  '请打开云开发控制台：1) 确认 VITE_CLOUD_PUBLISHABLE_KEY 是当前环境的 Publishable Key；2) 在「身份认证 → 登录方式」开启匿名登录。';

const toError = (err: unknown) => {
  if (err instanceof Error) return err;
  if (err && typeof err === 'object') {
    const record = err as { message?: string; code?: string; error?: string; status?: number };
    const code = String(record.code || '');
    const message = String(record.message || record.error || '云函数请求失败');
    if (
      code === 'INVALID_CREDENTIALS' ||
      record.status === 401 ||
      /401|unauthorized|invalid.?credential/i.test(message)
    ) {
      return new Error(`云开发鉴权失败（401）。${AUTH_HINT}`);
    }
    return new Error(message);
  }
  return new Error('云函数请求失败');
};

let sessionReady: Promise<void> | null = null;

const ensureGatewaySession = async () => {
  if (!sessionReady) {
    sessionReady = (async () => {
      const auth = getAuth();
      if (!auth?.signInAnonymously) {
        throw new Error('CloudBase Auth 不可用，请确认已安装 @cloudbase/js-sdk');
      }
      const session = await auth.getSession?.();
      if (session?.data?.session) return;
      const { error } = await auth.signInAnonymously({});
      if (error) {
        throw new Error(`云开发匿名登录失败：${error.message || '未知错误'}。${AUTH_HINT}`);
      }
    })();
  }

  try {
    await sessionReady;
  } catch (error) {
    sessionReady = null;
    throw error;
  }
};

const callCloud = async <T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | number | undefined>
) => {
  if (!CLOUD_ACCESS_KEY) {
    throw new Error('请先在 CloudBase 控制台生成 Publishable Key，并配置 VITE_CLOUD_PUBLISHABLE_KEY');
  }

  try {
    await ensureGatewaySession();
    const response = await cloudApp.callFunction<ApiResponse<T>>({
      name: CLOUD_FUNCTION_NAME,
      data: {
        method,
        path,
        body,
        params
      }
    });

    const result = response.result;
    if (!result) throw new Error('云函数没有返回结果');
    if (Number(result.code) !== 0) throw new Error(result.message || '云函数请求失败');
    return result.data;
  } catch (error) {
    throw toError(error);
  }
};

export const request = async <T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | number | undefined>
) => callCloud<T>(method, path, body, params);

export const api = {
  stats: () => request<any>('GET', '/admin/questions/stats'),
  list: (params: Record<string, string | number | undefined>) =>
    request<{ items: QuestionItem[]; total: number; page: number; pageSize: number }>('GET', '/admin/questions', undefined, params),
  create: (body: Record<string, unknown>) => request<QuestionItem>('POST', '/admin/questions', body),
  update: (id: string, body: Record<string, unknown>) => request<QuestionItem>('PUT', `/admin/questions/${id}`, body),
  remove: (id: string) => request<{ deleted: boolean }>('DELETE', `/admin/questions/${id}`),
  importJson: (jsonText: string) => request<{ created: number; updated: number; total: number; items: QuestionItem[] }>('POST', '/admin/questions/import', { jsonText }),
  importPdf: (body: Record<string, unknown>) =>
    request<{ created: number; updated: number; total: number; items: QuestionItem[] }>('POST', '/admin/questions/import-pdf', body),
  importPdfJob: (body: Record<string, unknown>) =>
    request<ImportJob>('POST', '/admin/questions/import-pdf-job', body),
  getImportJob: (id: string) =>
    request<ImportJob>('GET', `/admin/questions/import-jobs/${id}`),
  import2025: () => request<{ created: number; updated: number; total: number; items: QuestionItem[] }>('POST', '/admin/questions/import-2025')
};
