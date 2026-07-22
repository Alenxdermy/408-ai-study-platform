import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../shared/env.js';
import { ChatOpenAI } from '@langchain/openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.resolve(__dirname, '../../.env') });

console.log('=== OpenAI API 测试 ===');
console.log('API Key:', env.OPENAI_API_KEY ? '***' + env.OPENAI_API_KEY.slice(-8) : '未配置');
console.log('Base URL:', env.OPENAI_BASE_URL);
console.log('Model:', env.OPENAI_MODEL);

const testDirectApi = async () => {
  console.log('\n--- 直接API测试 ---');
  try {
    const model = new ChatOpenAI({
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
      temperature: 0.2,
      maxRetries: 1,
      configuration: { baseURL: env.OPENAI_BASE_URL }
    });

    const response = await model.invoke([
      { role: 'user', content: 'Hello' }
    ]);
    console.log('成功:', String(response.content).slice(0, 50));
  } catch (error: any) {
    console.log('失败:', error.message);
    if (error.response) {
      console.log('状态码:', error.response.status);
      console.log('响应体:', JSON.stringify(error.response.data).slice(0, 200));
    }
  }
};

const testFetch = async () => {
  console.log('\n--- Fetch测试 ---');
  try {
    const response = await fetch(`${env.OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10
      })
    });

    console.log('状态码:', response.status);
    const data = await response.json();
    console.log('响应:', JSON.stringify(data).slice(0, 300));
  } catch (error: any) {
    console.log('失败:', error.message);
  }
};

const main = async () => {
  await testDirectApi();
  await testFetch();
};

main();

