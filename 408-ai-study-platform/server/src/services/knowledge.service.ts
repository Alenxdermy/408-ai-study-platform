import { Chroma } from '@langchain/community/vectorstores/chroma';
import { Document } from '@langchain/core/documents';
import { KnowledgeChunkModel } from '../models/knowledge-chunk.model.js';
import { KnowledgeDocumentModel } from '../models/knowledge-document.model.js';
import { env } from '../shared/env.js';
import { documentParserService } from './document-parser.service.js';
import { llmService } from './llm.service.js';
import { Op } from 'sequelize';

const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 120;

export class KnowledgeService {
  async createDocument(userId: string, file: Express.Multer.File) {
    return KnowledgeDocumentModel.create({
      userId,
      title: file.originalname.replace(/\.[^.]+$/, ''),
      originalName: file.originalname,
      mimeType: file.mimetype,
      storagePath: file.path,
      status: 'uploaded'
    });
  }

  async ingestUploadedFile(userId: string, file: Express.Multer.File) {
    const document = await this.createDocument(userId, file);
    try {
      const text = await documentParserService.parse(file);
      await document.update({ status: 'parsed' });
      await this.indexText(document.id, userId, text);
      return KnowledgeDocumentModel.findByPk(document.id);
    } catch (error) {
      await document.update({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'unknown parser error'
      });
      throw error;
    }
  }

  chunkText(text: string) {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      chunks.push(text.slice(start, start + CHUNK_SIZE));
      start += CHUNK_SIZE - CHUNK_OVERLAP;
    }
    return chunks.filter(Boolean);
  }

  async indexText(documentId: string, userId: string, text: string) {
    const chunks = this.chunkText(text);
    const vectorStore = await Chroma.fromDocuments([], llmService.getEmbeddingModel(), {
      collectionName: env.CHROMA_COLLECTION,
      url: env.CHROMA_URL
    });
    const docs = chunks.map((content, index) => new Document({
      pageContent: content,
      metadata: { documentId, userId, chunkIndex: index }
    }));
    const ids = chunks.map((_, index) => `${documentId}:${index}`);
    await vectorStore.addDocuments(docs, { ids });
    await KnowledgeChunkModel.bulkCreate(chunks.map((content, index) => ({
      documentId,
      userId,
      chunkIndex: index,
      content,
      tokenCount: Math.ceil(content.length / 2),
      vectorId: ids[index]
    })));
    await KnowledgeDocumentModel.findByPk(documentId)?.then(doc => doc?.update({ status: 'embedded', chunkCount: chunks.length }));
  }

  async hybridSearch(userId: string, query: string) {
    const [keywordResults, vectorResults] = await Promise.all([
      KnowledgeChunkModel.findAll({
        where: {
          userId,
          [Op.or]: [
            { content: { [Op.like]: `%${query}%` } }
          ]
        },
        limit: 5
      }),
      this.vectorSearch(userId, query)
    ]);

    const merged = new Map<string, { content: string; score: number }>();
    keywordResults.forEach((item, index) => merged.set(item.vectorId, { content: item.content, score: 1 / (index + 1) }));
    vectorResults.forEach((item, index) => {
      const key = String(item.metadata?.documentId ?? '') + ':' + String(item.metadata?.chunkIndex ?? index);
      const previous = merged.get(key);
      merged.set(key, { content: item.pageContent, score: (previous?.score ?? 0) + 1 / (index + 1) });
    });

    return [...merged.values()].sort((a, b) => b.score - a.score).slice(0, 6);
  }

  async answerWithRag(userId: string, query: string) {
    const contexts = await this.hybridSearch(userId, query);
    const contextText = contexts.map((item, index) => `【资料${index + 1}】\n${item.content}`).join('\n\n');
    return llmService.chat([
      { role: 'system', content: '你是 408 知识库问答专家。必须基于资料回答；资料不足时明确说明缺口，并给出可验证学习建议。' },
      { role: 'user', content: `问题：${query}\n\n参考资料：\n${contextText}` }
    ]);
  }

  private async vectorSearch(userId: string, query: string) {
    const vectorStore = await this.getVectorStore();
    const retriever = vectorStore.asRetriever({ k: 6, filter: { userId } });
    return retriever.invoke(query);
  }

  private async getVectorStore() {
    return Chroma.fromExistingCollection(llmService.getEmbeddingModel(), {
      collectionName: env.CHROMA_COLLECTION,
      url: env.CHROMA_URL
    });
  }
}

export const knowledgeService = new KnowledgeService();
