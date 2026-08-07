import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import HttpsProxyAgent from 'https-proxy-agent';
import { env } from '../shared/env.js';
import { AppError } from '../shared/http.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

type EmbeddingProvider = {
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
};

interface OpenAICompatibleEmbeddingResponse {
  data?: Array<{ embedding?: number[] }>;
  error?: { message?: string; code?: string };
}

interface OpenAICompatibleChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
      reasoning_content?: string;
    };
  }>;
  error?: { message?: string; code?: string };
}

const LOCAL_EMBEDDING_DIMENSION = 384;

const pickApiKey = () => env.DEEPSEEK_API_KEY ?? env.OPENAI_API_KEY ?? '';
const pickProxy = () => env.HTTPS_PROXY ?? env.HTTP_PROXY ?? '';

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

const createAgent = (targetUrl: URL, useProxy = true) => {
  const proxyUrl = pickProxy();
  if (!proxyUrl || !useProxy) return undefined;
  if (targetUrl.protocol === 'https:') {
    return HttpsProxyAgent(proxyUrl);
  }
  return undefined;
};

const readBody = async (response: http.IncomingMessage) => new Promise<string>((resolve, reject) => {
  const chunks: Buffer[] = [];
  response.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  response.on('error', reject);
});

const localEmbedding = (text: string, dimensions = LOCAL_EMBEDDING_DIMENSION) => {
  const vector = new Array<number>(dimensions).fill(0);
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return vector;

  for (let index = 0; index < normalized.length; index += 1) {
    const charCode = normalized.charCodeAt(index);
    vector[charCode % dimensions] += 1;
    if (index + 1 < normalized.length) {
      const pair = (charCode * 31 + normalized.charCodeAt(index + 1)) >>> 0;
      vector[pair % dimensions] += 0.5;
    }
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map(value => Number((value / norm).toFixed(6)));
};

class OpenAICompatibleClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly timeoutMs = 60000
  ) {}

  async postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    const payload = JSON.stringify(body);
    const proxyUrl = pickProxy();
    const transport = url.protocol === 'https:' ? https : http;

    const send = (useProxy: boolean) => new Promise<T>((resolve, reject) => {
      const agent = createAgent(url, useProxy);
      const request = transport.request(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        agent: agent as unknown as http.Agent | undefined,
        timeout: this.timeoutMs
      }, async response => {
        const text = await readBody(response);
        let parsed: Record<string, unknown> | null = null;

        try {
          parsed = text ? JSON.parse(text) : null;
        } catch {
          parsed = null;
        }

        if ((response.statusCode ?? 500) < 200 || (response.statusCode ?? 500) >= 300) {
          const message = (parsed?.error as { message?: string } | undefined)?.message
            ?? text
            ?? `HTTP ${response.statusCode}`;
          reject(new AppError(response.statusCode ?? 502, message, 'LLM_REQUEST_FAILED'));
          return;
        }

        resolve((parsed ?? {}) as T);
      });

      request.on('error', reject);
      request.write(payload);
      request.end();
    });

    try {
      return await send(Boolean(proxyUrl));
    } catch (error: any) {
      const canRetryWithoutProxy = Boolean(proxyUrl)
        && ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'].includes(String(error?.code ?? ''));

      if (!canRetryWithoutProxy) throw error;

      console.warn(`Configured proxy ${proxyUrl} is unavailable, retrying AI request without proxy.`, error);
      return send(false);
    }
  }
}

class DeepSeekEmbeddings implements EmbeddingProvider {
  private localFallback = false;
  private readonly client: OpenAICompatibleClient;

  constructor(
    baseUrl: string,
    apiKey: string,
    private readonly model: string
  ) {
    this.client = new OpenAICompatibleClient(baseUrl, apiKey, 60000);
  }

  async embedDocuments(texts: string[]) {
    return this.embed(texts);
  }

  async embedQuery(text: string) {
    const [vector] = await this.embed([text]);
    return vector;
  }

  private async embed(texts: string[]) {
    if (this.localFallback) {
      return texts.map(text => localEmbedding(text));
    }

    try {
      const response = await this.client.postJson<OpenAICompatibleEmbeddingResponse>('/embeddings', {
        model: this.model,
        input: texts
      });
      const vectors = response.data?.map(item => item.embedding ?? []) ?? [];
      if (vectors.length !== texts.length || vectors.some(vector => !vector.length)) {
        throw new Error('Embedding response was empty');
      }
      return vectors;
    } catch (error) {
      this.localFallback = true;
      console.warn('DeepSeek embeddings unavailable, falling back to local hash embeddings.', error);
      return texts.map(text => localEmbedding(text));
    }
  }
}

export class LLMService {
  private readonly apiKey = pickApiKey();
  private readonly baseUrl = normalizeBaseUrl(env.OPENAI_BASE_URL);
  private chatClient?: OpenAICompatibleClient;
  private embeddingProvider?: EmbeddingProvider;

  private get client() {
    if (!this.chatClient) {
      this.chatClient = new OpenAICompatibleClient(this.baseUrl, this.apiKey, 60000);
    }
    return this.chatClient;
  }

  getEmbeddingModel() {
    this.assertApiKey();
    if (!this.embeddingProvider) {
      this.embeddingProvider = new DeepSeekEmbeddings(this.baseUrl, this.apiKey, env.OPENAI_EMBEDDING_MODEL);
    }
    return this.embeddingProvider;
  }

  async chat(messages: ChatMessage[]) {
    this.assertApiKey();
    const response = await this.client.postJson<OpenAICompatibleChatResponse>('/chat/completions', {
      model: env.OPENAI_MODEL,
      messages,
      temperature: 0.2,
      stream: false,
      max_tokens: 1200
    });

    const message = response.choices?.[0]?.message;
    const content = (message?.content ?? message?.reasoning_content ?? '').trim();
    if (!content) {
      throw new AppError(502, 'AI 返回为空，请稍后重试', 'LLM_EMPTY_RESPONSE');
    }

    return content;
  }

  async embedDocuments(texts: string[]) {
    return this.getEmbeddingModel().embedDocuments(texts);
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  private assertApiKey() {
    if (!this.apiKey) {
      throw new AppError(500, 'DeepSeek API key 未配置', 'LLM_CONFIG_ERROR');
    }
  }
}

export const llmService = new LLMService();
