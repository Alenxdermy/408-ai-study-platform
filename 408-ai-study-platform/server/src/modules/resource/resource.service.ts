import { ResourceDocumentModel } from '../../models/resource-document.model.js';
import { documentParserService } from '../../services/document-parser.service.js';
import { llmService } from '../../services/llm.service.js';
import { AppError } from '../../shared/http.js';

const PDF_MIME_TYPE = 'application/pdf';
const SUMMARY_SOURCE_LIMIT = 6000;

export class ResourceService {
  async createPdfResource(userId: string | undefined, file: Express.Multer.File, body: Record<string, unknown>) {
    if (file.mimetype !== PDF_MIME_TYPE && !file.originalname.toLowerCase().endsWith('.pdf')) {
      throw new AppError(400, '当前仅支持 PDF 文件', 'ONLY_PDF_ALLOWED');
    }

    const title = String(body.title || file.originalname.replace(/\.pdf$/i, '')).trim();
    const document = await ResourceDocumentModel.create({
      uploaderId: userId,
      title,
      description: String(body.description || ''),
      category: body.category || 'general',
      originalName: file.originalname,
      mimeType: PDF_MIME_TYPE,
      storagePath: file.path,
      size: file.size
    });

    return this.parseAndSummarize(document.id, file);
  }

  async parseAndSummarize(documentId: string, file: Express.Multer.File) {
    try {
      const text = await documentParserService.parse(file);
      const normalizedText = this.normalizeText(text);

      await ResourceDocumentModel.update({
        parseStatus: 'parsed',
        parseError: '',
        textPreview: normalizedText.slice(0, 500),
        wordCount: normalizedText.length,
        parsedAt: new Date()
      }, { where: { id: documentId } });

      if (!llmService.isConfigured()) {
        await ResourceDocumentModel.update({
          summaryStatus: 'skipped',
          summaryError: 'OPENAI_API_KEY 未配置，已跳过 AI 摘要生成'
        }, { where: { id: documentId } });
        return ResourceDocumentModel.findByPk(documentId, { attributes: { exclude: ['storagePath'] } });
      }

      return this.generateSummary(documentId, normalizedText);
    } catch (error) {
      await ResourceDocumentModel.update({
        parseStatus: 'failed',
        parseError: error instanceof Error ? error.message : 'PDF 解析失败',
        summaryStatus: 'failed',
        summaryError: 'PDF 解析失败，无法生成摘要'
      }, { where: { id: documentId } });
      return ResourceDocumentModel.findByPk(documentId, { attributes: { exclude: ['storagePath'] } });
    }
  }

  async regenerateSummary(documentId: string) {
    const document = await ResourceDocumentModel.findByPk(documentId);
    if (!document || document.status !== 'published') {
      throw new AppError(404, '资料不存在', 'RESOURCE_NOT_FOUND');
    }
    if (!llmService.isConfigured()) {
      throw new AppError(500, 'OPENAI_API_KEY 未配置，无法生成 AI 摘要', 'LLM_CONFIG_ERROR');
    }

    const text = await documentParserService.parseByFileInfo(document.storagePath, document.originalName, document.mimeType);
    return this.generateSummary(document.id, this.normalizeText(text));
  }

  private async generateSummary(documentId: string, text: string) {
    try {
      await ResourceDocumentModel.update({
        summaryStatus: 'pending',
        summaryError: ''
      }, { where: { id: documentId } });

      const source = text.slice(0, SUMMARY_SOURCE_LIMIT);
      const summary = await llmService.chat([
        {
          role: 'system',
          content: [
            '你是 408 计算机考研资料分析助手。',
            '请基于用户上传的 PDF 内容，输出适合小程序展示的学习摘要。',
            '必须包含：资料主题、核心知识点、适合刷题的考点、建议学习方式。',
            '控制在 300 字以内，不要编造 PDF 中没有的信息。'
          ].join('\n')
        },
        { role: 'user', content: source || '该 PDF 未解析出有效文本。' }
      ]);

      await ResourceDocumentModel.update({
        summary,
        summaryStatus: 'generated',
        summaryError: '',
        summarizedAt: new Date()
      }, { where: { id: documentId } });

      return ResourceDocumentModel.findByPk(documentId, { attributes: { exclude: ['storagePath'] } });
    } catch (error) {
      await ResourceDocumentModel.update({
        summaryStatus: 'failed',
        summaryError: error instanceof Error ? error.message : 'AI 摘要生成失败'
      }, { where: { id: documentId } });
      return ResourceDocumentModel.findByPk(documentId, { attributes: { exclude: ['storagePath'] } });
    }
  }

  private normalizeText(text: string) {
    return text.replace(/\s+/g, ' ').trim();
  }
}

export const resourceService = new ResourceService();
