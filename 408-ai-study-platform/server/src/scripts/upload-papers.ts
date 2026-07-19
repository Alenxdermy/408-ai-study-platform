import { config } from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory
config({ path: path.resolve(__dirname, '../../.env') });

const DOCS_DIR = path.resolve(__dirname, '../../../../docs');
const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:3000/api';

interface UploadResult {
  filename: string;
  success: boolean;
  message: string;
}

const log = {
  info: (msg: string, data?: unknown) => console.log(`[INFO] ${msg}`, data || ''),
  warn: (msg: string, data?: unknown) => console.warn(`[WARN] ${msg}`, data || ''),
  error: (msg: string, data?: unknown) => console.error(`[ERROR] ${msg}`, data || '')
};

const getAuthToken = async (): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/auth/mock-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: '系统管理员' })
  });

  if (!response.ok) {
    throw new Error(`获取认证令牌失败: ${response.status}`);
  }

  const data = await response.json() as { code: number; data: { token: string } };
  if (data.code !== 0) {
    throw new Error('获取认证令牌失败');
  }

  return data.data.token;
};

const uploadPdf = async (filePath: string, title: string, category: string, token: string): Promise<UploadResult> => {
  const filename = path.basename(filePath);

  try {
    // 使用 Node.js 原生 Web API FormData 和 Blob
    const fileBuffer = readFileSync(filePath);
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    
    const form = new FormData();
    form.append('file', blob, filename);
    form.append('title', title);
    form.append('category', category);

    const response = await fetch(`${API_BASE_URL}/resources/pdf`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: form
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { filename, success: false, message: `HTTP ${response.status}: ${errorText}` };
    }

    const data = await response.json() as { code: number; message?: string };
    if (data.code !== 0) {
      return { filename, success: false, message: data.message || '上传失败' };
    }

    return { filename, success: true, message: '上传成功' };
  } catch (error) {
    return { filename, success: false, message: error instanceof Error ? error.message : '未知错误' };
  }
};

const getAllPdfFiles = async (dirPath: string): Promise<string[]> => {
  const pdfFiles: string[] = [];
  if (!existsSync(dirPath)) return pdfFiles;

  const entries = await readdir(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await getAllPdfFiles(fullPath);
      pdfFiles.push(...subFiles);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
      pdfFiles.push(fullPath);
    }
  }
  
  return pdfFiles;
};

const main = async () => {
  log.info('开始批量上传docs目录下的所有PDF文件');

  try {
    const token = await getAuthToken();
    log.info('认证成功');

    const pdfFiles = await getAllPdfFiles(DOCS_DIR);
    log.info('发现PDF文件', { count: pdfFiles.length });

    const results: UploadResult[] = [];

    for (const filePath of pdfFiles) {
      const filename = path.basename(filePath);
      const title = filename.replace(/\.pdf$/i, '');
      
      const result = await uploadPdf(filePath, title, 'general', token);
      results.push(result);

      log.info('文件上传结果', { filename: filename, success: result.success, message: result.message });

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    log.info('批量上传完成', {
      total: results.length,
      success: successCount,
      failed: failCount
    });

    if (failCount > 0) {
      log.warn('失败文件列表:');
      results.filter(r => !r.success).forEach(r => {
        log.warn('失败详情', { filename: r.filename, message: r.message });
      });
    }
  } catch (error) {
    log.error('批量上传失败', error);
    process.exit(1);
  }
};

main().catch((error) => {
  log.error('未捕获的错误', error);
  process.exit(1);
});
