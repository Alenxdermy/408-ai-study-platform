import { promises as fs } from 'node:fs';
import path from 'node:path';
import mammoth from 'mammoth';
import { AppError } from '../shared/http.js';

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown'
]);

export class DocumentParserService {
  async parse(file: Express.Multer.File) {
    return this.parseByFileInfo(file.path, file.originalname, file.mimetype);
  }

  async parseByFileInfo(filePath: string, originalName: string, mimeType: string) {
    if (!SUPPORTED_MIME_TYPES.has(mimeType) && !this.isSupportedExtension(originalName)) {
      throw new AppError(400, '仅支持 PDF、DOCX、TXT、Markdown 文件', 'UNSUPPORTED_DOCUMENT_TYPE');
    }

    if (mimeType === 'application/pdf' || originalName.toLowerCase().endsWith('.pdf')) {
      return this.extractTextFromPdf(filePath);
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      originalName.toLowerCase().endsWith('.docx')
    ) {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    }

    return fs.readFile(filePath, 'utf8');
  }

  private async extractTextFromPdf(filePath: string): Promise<string> {
    try {
      const buffer = await fs.readFile(filePath);
      return this.extractTextFromPdfBuffer(buffer);
    } catch (error) {
      console.warn('PDF 解析失败:', error);
      return '';
    }
  }

  private extractTextFromPdfBuffer(buffer: Buffer): string {
    try {
      const data = buffer.toString('binary');
      let text = '';
      let inText = false;
      let currentText = '';

      for (let i = 0; i < data.length - 4; i++) {
        const chunk = data.slice(i, i + 4);
        if (chunk === 'Tj\n' || chunk === 'Tj\r' || chunk === 'TJ ') {
          inText = true;
          currentText = '';
        } else if (inText && chunk === ' ET') {
          inText = false;
          text += this.decodePdfString(currentText) + '\n';
          currentText = '';
        } else if (inText) {
          currentText += data[i];
        }
      }

      return text.trim() || 'PDF 内容已上传，支持在线预览和下载';
    } catch {
      return 'PDF 内容已上传，支持在线预览和下载';
    }
  }

  private decodePdfString(str: string): string {
    try {
      const matches = str.match(/\(([^)]*)\)/g);
      if (!matches) return str;

      return matches.map(m => {
        const content = m.slice(1, -1);
        let decoded = '';
        let i = 0;
        while (i < content.length) {
          if (content[i] === '\\' && i + 1 < content.length) {
            const next = content[i + 1];
            if (next === 'n') decoded += '\n';
            else if (next === 'r') decoded += '\r';
            else if (next === 't') decoded += '\t';
            else if (next === '\\') decoded += '\\';
            else if (next === '(') decoded += '(';
            else if (next === ')') decoded += ')';
            else if (next === 'f') decoded += '\f';
            else if (next === 'b') decoded += '\b';
            else if (next === '0') decoded += '\0';
            else {
              const octal = content.slice(i + 1, i + 4);
              if (/^[0-7]{1,3}$/.test(octal)) {
                decoded += String.fromCharCode(parseInt(octal, 8));
                i += 2;
              } else {
                decoded += next;
              }
            }
            i += 2;
          } else {
            decoded += content[i];
            i++;
          }
        }
        return decoded;
      }).join(' ');
    } catch {
      return str;
    }
  }

  private isSupportedExtension(filename: string) {
    return /\.(pdf|docx|txt|md|markdown)$/i.test(filename);
  }
}

export const documentParserService = new DocumentParserService();