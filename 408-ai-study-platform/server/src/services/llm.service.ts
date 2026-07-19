import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { env } from '../shared/env.js';
import { AppError } from '../shared/http.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class LLMService {
  private chatModel?: ChatOpenAI;
  private embeddingModel?: OpenAIEmbeddings;

  getChatModel() {
    this.assertApiKey();
    this.chatModel ??= new ChatOpenAI({
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
      temperature: 0.2,
      timeout: 60000,
      maxRetries: 3,
      configuration: { baseURL: env.OPENAI_BASE_URL }
    });
    return this.chatModel;
  }

  getEmbeddingModel() {
    this.assertApiKey();
    this.embeddingModel ??= new OpenAIEmbeddings({
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_EMBEDDING_MODEL,
      configuration: { baseURL: env.OPENAI_BASE_URL }
    });
    return this.embeddingModel;
  }

  async chat(messages: ChatMessage[]) {
    const langchainMessages = messages.map(message => {
      if (message.role === 'system') return new SystemMessage(message.content);
      if (message.role === 'assistant') return new AIMessage(message.content);
      return new HumanMessage(message.content);
    });
    const response = await this.getChatModel().invoke(langchainMessages);
    return String(response.content);
  }

  async embedDocuments(texts: string[]) {
    return this.getEmbeddingModel().embedDocuments(texts);
  }

  isConfigured() {
    return Boolean(env.OPENAI_API_KEY);
  }

  private assertApiKey() {
    if (!env.OPENAI_API_KEY) throw new AppError(500, 'OPENAI_API_KEY 未配置', 'LLM_CONFIG_ERROR');
  }
}

export const llmService = new LLMService();
