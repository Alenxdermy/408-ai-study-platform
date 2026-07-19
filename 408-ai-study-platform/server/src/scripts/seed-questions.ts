import { config } from 'dotenv';
config();

import { ChapterModel } from '../models/chapter.model.js';
import { QuestionModel } from '../models/question.model.js';
import { connectDatabase } from '../shared/database.js';
import { logger } from '../shared/logger.js';

const ensureChapter = async (subject: string, title: string, order: number, knowledgePoints: string[]) => {
  const [chapter] = await ChapterModel.findOrCreate({
    where: { subject, title },
    defaults: { subject, title, order, knowledgePoints }
  });
  return chapter.id;
};

const seed = async () => {
  await connectDatabase();

  const treeChapterId = await ensureChapter('data_structure', '树与二叉树', 1, ['二叉树遍历', '哈夫曼树', '二叉排序树']);
  const processChapterId = await ensureChapter('os', '进程管理', 2, ['进程状态', 'PV操作', '死锁']);
  const transportChapterId = await ensureChapter('computer_network', '传输层', 3, ['TCP可靠传输', '拥塞控制', 'UDP']);
  const storageChapterId = await ensureChapter('computer_organization', '存储系统', 4, ['Cache', '虚拟存储器', '主存编址']);

  await QuestionModel.destroy({ where: { source: '系统内置样题' } });
  
  await QuestionModel.bulkCreate([
    {
      subject: 'data_structure',
      chapterId: treeChapterId,
      type: 'single',
      stem: '若一棵二叉树的先序序列为 ABC，中序序列为 BAC，则该二叉树的后序序列是？',
      options: [
        { key: 'A', content: 'BCA' },
        { key: 'B', content: 'CBA' },
        { key: 'C', content: 'BAC' },
        { key: 'D', content: 'ABC' }
      ],
      answer: 'A',
      explanation: '先序首结点 A 为根；中序 BAC 中，B 在 A 左侧，C 在 A 右侧，所以后序为 BCA。',
      difficulty: 2,
      tags: ['二叉树遍历'],
      source: '系统内置样题',
      score: 2
    },
    {
      subject: 'os',
      chapterId: processChapterId,
      type: 'single',
      stem: '下列哪一项不是产生死锁的必要条件？',
      options: [
        { key: 'A', content: '互斥条件' },
        { key: 'B', content: '请求和保持条件' },
        { key: 'C', content: '资源有序分配条件' },
        { key: 'D', content: '循环等待条件' }
      ],
      answer: 'C',
      explanation: '死锁四个必要条件是互斥、请求和保持、不可剥夺、循环等待。资源有序分配是预防死锁的方法。',
      difficulty: 2,
      tags: ['死锁'],
      source: '系统内置样题',
      score: 2
    },
    {
      subject: 'computer_network',
      chapterId: transportChapterId,
      type: 'multiple',
      stem: 'TCP 实现可靠传输通常依赖哪些机制？',
      options: [
        { key: 'A', content: '确认应答' },
        { key: 'B', content: '超时重传' },
        { key: 'C', content: '滑动窗口' },
        { key: 'D', content: '广播转发' }
      ],
      answer: ['A', 'B', 'C'],
      explanation: 'TCP 通过确认、重传、序号、滑动窗口和校验等机制实现可靠传输；广播转发不是 TCP 可靠传输机制。',
      difficulty: 3,
      tags: ['TCP可靠传输'],
      source: '系统内置样题',
      score: 3
    },
    {
      subject: 'computer_organization',
      chapterId: storageChapterId,
      type: 'single',
      stem: 'Cache 的主要作用是解决 CPU 与主存之间的什么矛盾？',
      options: [
        { key: 'A', content: '容量不匹配' },
        { key: 'B', content: '速度不匹配' },
        { key: 'C', content: '地址空间不匹配' },
        { key: 'D', content: '数据格式不匹配' }
      ],
      answer: 'B',
      explanation: 'Cache 利用程序局部性原理缓解 CPU 高速访问与主存较慢访问之间的速度矛盾。',
      difficulty: 1,
      tags: ['Cache'],
      source: '系统内置样题',
      score: 2
    }
  ]);

  logger.info('seed questions completed');
  process.exit(0);
};

seed().catch(error => {
  logger.error(error, 'seed questions failed');
  process.exit(1);
});
