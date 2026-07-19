import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../shared/env.js';
import { llmService } from '../services/llm.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.resolve(__dirname, '../../.env') });

console.log('OPENAI_API_KEY from env:', env.OPENAI_API_KEY ? '***' + env.OPENAI_API_KEY.slice(-8) : 'not found');
console.log('LLM is configured:', llmService.isConfigured());

if (llmService.isConfigured()) {
  try {
    const response = await llmService.chat([
      { role: 'user', content: 'Hello, please respond with a short message.' }
    ]);
    console.log('API call successful:', response);
  } catch (error) {
    console.error('API call failed:', error);
  }
}