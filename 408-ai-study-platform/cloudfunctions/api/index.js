const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const SUBJECT_LABELS = {
  data_structure: '数据结构',
  computer_organization: '计算机组成原理',
  os: '操作系统',
  computer_network: '计算机网络'
};

const SUBJECT_ALIASES = {
  data_structure: 'data_structure',
  数据结构: 'data_structure',
  computer_organization: 'computer_organization',
  计算机组成原理: 'computer_organization',
  组成原理: 'computer_organization',
  os: 'os',
  操作系统: 'os',
  computer_network: 'computer_network',
  计算机网络: 'computer_network',
  network: 'computer_network'
};

const ok = (data, message = 'ok') => ({ code: 0, message, data });
const fail = (message, code = 'CLOUD_API_ERROR') => ({ code, message, data: null });
const now = () => new Date().toISOString();
const collection = name => db.collection(name);

const normalizeSubject = value => SUBJECT_ALIASES[String(value || '').trim()] || 'data_structure';
const normalizeDifficulty = value => {
  const number = Number(value);
  if (Number.isFinite(number)) return Math.max(1, Math.min(5, Math.round(number)));
  const text = String(value || '').toLowerCase();
  if (text.includes('难') || text === 'hard') return 5;
  if (text.includes('易') || text.includes('简单') || text === 'easy') return 1;
  return 3;
};
const normalizeStatus = value => String(value || '').trim() === 'draft' ? 'draft' : 'published';
const normalizeTags = value => Array.isArray(value)
  ? value.map(item => String(item).trim()).filter(Boolean)
  : String(value || '').split(/[，,、;；\n]/).map(item => item.trim()).filter(Boolean);
const normalizeOptions = value => {
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (typeof item === 'string') return { key: String.fromCharCode(65 + index), content: item.trim() };
      return {
        key: String(item.key || item.label || String.fromCharCode(65 + index)).trim(),
        content: String(item.content || item.text || item.value || '').trim()
      };
    }).filter(item => item.content);
  }
  return String(value || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).map((line, index) => {
    const match = line.match(/^([A-H])[\.\、\)\：:]\s*(.+)$/);
    return match ? { key: match[1], content: match[2].trim() } : { key: String.fromCharCode(65 + index), content: line };
  });
};
const normalizeAnswer = value => {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  const text = String(value || '').trim().toUpperCase();
  return /^[A-H]$/.test(text) ? text : String(value || '').trim();
};
const serializeQuestion = item => ({
  id: item._id || item.id,
  _id: item._id || item.id,
  stem: item.stem || '',
  subject: item.subject || 'data_structure',
  type: item.type || 'single',
  difficulty: item.difficulty || 3,
  options: item.options || [],
  answer: item.answer || '',
  explanation: item.explanation || '',
  source: item.source || '',
  year: item.year || null,
  status: item.status || 'published',
  tags: item.tags || []
});
const serializeUser = item => ({
  id: item._id || item.id,
  nickname: item.nickname || '408 考生',
  avatarUrl: item.avatarUrl || '',
  phone: item.phone || null,
  targetScore: item.targetScore || 120,
  examDate: item.examDate || null,
  status: item.status || 'active',
  stats: item.stats || {
    totalQuestions: 0,
    correctQuestions: 0,
    studyMinutes: 0,
    streakDays: 0,
    lastCheckInAt: null
  },
  achievements: item.achievements || []
});

const getOpenId = () => cloud.getWXContext().OPENID || '';
const getTokenUserId = event => {
  const token = String(event.token || event.headers?.authorization || event.headers?.Authorization || '').replace(/^Bearer\s+/i, '');
  if (token.startsWith('cloud:')) return token.slice(6);
  return token || getOpenId() || 'admin-web-user';
};

const getDocById = async (name, id) => {
  try {
    const result = await collection(name).doc(String(id)).get();
    return result.data;
  } catch {
    return null;
  }
};

const ensureUser = async (event, patch = {}) => {
  const userId = getTokenUserId(event);
  const existed = await getDocById('users', userId);
  if (existed) {
    if (Object.keys(patch).length) {
      await collection('users').doc(userId).update({ data: { ...patch, updatedAt: now() } });
      return serializeUser({ ...existed, ...patch, _id: userId });
    }
    return serializeUser({ ...existed, _id: userId });
  }
  const user = {
    _id: userId,
    openid: getOpenId(),
    nickname: patch.nickname || '408 考生',
    phone: patch.phone || null,
    targetScore: 120,
    examDate: null,
    status: 'active',
    stats: { totalQuestions: 0, correctQuestions: 0, studyMinutes: 0, streakDays: 0, lastCheckInAt: null },
    achievements: [],
    createdAt: now(),
    updatedAt: now(),
    ...patch
  };
  await collection('users').add({ data: user });
  return serializeUser(user);
};

const jsonBodyRows = input => {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input?.questions)) return input.questions;
  if (Array.isArray(input?.items)) return input.items;
  return [];
};

const buildQuestionPayload = raw => {
  const annotation = raw.annotation || {};
  const type = 'single';
  const stem = String(raw.stem || raw.question || raw.text || '').trim();
  const options = normalizeOptions(raw.options || annotation.options || []);
  if (!stem || options.length < 2) return null;
  return {
    subject: normalizeSubject(annotation.subject || raw.subject),
    type,
    stem,
    options,
    answer: normalizeAnswer(annotation.answer || raw.answer || ''),
    explanation: String(raw.explanation || annotation.explanation || raw.analysis || '').trim(),
    difficulty: normalizeDifficulty(annotation.difficulty || raw.difficulty),
    tags: normalizeTags(raw.tags || annotation.tags || raw.knowledge_point),
    source: String(raw.source || raw.source_pdf || '后台录入').trim(),
    year: Number(raw.year || 0) || null,
    score: Number(raw.score || 2),
    status: normalizeStatus(raw.status),
    createdAt: raw.createdAt || now(),
    updatedAt: now()
  };
};

const importQuestionRows = async (rows, source = '') => {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const items = [];
  for (const raw of rows) {
    const payload = buildQuestionPayload({ ...raw, source: raw.source || source || raw.source_pdf });
    if (!payload) {
      skipped += 1;
      continue;
    }
    const existed = await collection('questions').where({ source: payload.source, stem: payload.stem }).limit(1).get();
    if (existed.data.length) {
      const id = existed.data[0]._id;
      await collection('questions').doc(id).update({ data: payload });
      updated += 1;
      items.push(serializeQuestion({ ...existed.data[0], ...payload, _id: id }));
    } else {
      const addResult = await collection('questions').add({ data: payload });
      created += 1;
      items.push(serializeQuestion({ ...payload, _id: addResult._id }));
    }
  }
  return { created, updated, skipped, total: rows.length, items };
};

const isAnswerCorrect = (standard, userAnswer) => {
  const normalize = value => Array.isArray(value)
    ? value.map(item => String(item).trim().toUpperCase()).sort().join('')
    : String(value || '').trim().toUpperCase().replace(/[，,、\s]/g, '');
  return normalize(standard) === normalize(userAnswer);
};

const getQuestionList = async (where, limit = 20, random = false) => {
  const result = await collection('questions').where(where).limit(Math.max(1, Math.min(100, limit))).get();
  const items = result.data.map(serializeQuestion);
  return random ? items.sort(() => Math.random() - 0.5) : items;
};

const loadQuestionsByIds = async questionIds => {
  if (!questionIds.length) return [];
  const result = await collection('questions').where({ _id: _.in(questionIds), status: 'published' }).limit(100).get();
  const map = new Map(result.data.map(item => [item._id, serializeQuestion(item)]));
  return questionIds.map(id => map.get(id)).filter(Boolean);
};

const groupSubjectCounts = async (linkCollection, userId) => {
  const links = await collection(linkCollection).where({ userId, ...(linkCollection === 'wrong_books' ? { mastered: false } : {}) }).limit(1000).get();
  const questions = await loadQuestionsByIds(links.data.map(item => item.questionId));
  const counts = {};
  questions.forEach(question => { counts[question.subject] = (counts[question.subject] || 0) + 1; });
  return Object.entries(counts).map(([subject, count]) => ({ subject, label: SUBJECT_LABELS[subject] || subject, count })).sort((a, b) => b.count - a.count);
};

const sameDay = (left, right) => {
  if (!left) return false;
  const date = new Date(left);
  return date.getFullYear() === right.getFullYear() && date.getMonth() === right.getMonth() && date.getDate() === right.getDate();
};
const yesterday = date => {
  const value = new Date(date);
  value.setDate(value.getDate() - 1);
  return value;
};

const deepseekChat = content => new Promise((resolve, reject) => {
  const https = require('https');
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    reject(new Error('DeepSeek API Key 未配置'));
    return;
  }
  const body = JSON.stringify({
    model: process.env.OPENAI_MODEL || 'deepseek-v4-pro',
    messages: [
      { role: 'system', content: '你是408考研AI讲题老师。回答使用简洁中文，包含答案、解析、考点、易错点，不使用复杂Markdown。' },
      { role: 'user', content }
    ],
    thinking: { type: 'enabled' },
    reasoning_effort: 'high',
    stream: false
  });
  const req = https.request('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(body)
    }
  }, res => {
    let text = '';
    res.on('data', chunk => { text += chunk; });
    res.on('end', () => {
      try {
        const json = JSON.parse(text);
        if (res.statusCode >= 400) reject(new Error(json.error?.message || 'AI 服务请求失败'));
        else resolve(json.choices?.[0]?.message?.content || 'AI 暂无回复');
      } catch (error) {
        reject(error);
      }
    });
  });
  req.on('error', reject);
  req.write(body);
  req.end();
});

const parsePdfQuestions = async ({ fileID, fileBase64 }) => {
  const pdfParse = require('pdf-parse');
  let buffer;
  if (fileBase64) {
    const raw = String(fileBase64).includes(',') ? String(fileBase64).split(',', 2)[1] : String(fileBase64);
    buffer = Buffer.from(raw, 'base64');
  } else if (fileID) {
    const file = await cloud.downloadFile({ fileID });
    buffer = file.fileContent;
  } else {
    throw new Error('请先上传 PDF 文件');
  }

  const parsed = await pdfParse(buffer);
  const text = parsed.text.replace(/\r/g, '\n');
  const blocks = text.split(/\n(?=\s*(?:\d{1,2}[\.\、]|第\s*\d+\s*题))/).map(item => item.trim()).filter(Boolean);
  return blocks.map((block, index) => {
    const optionMatches = [...block.matchAll(/(^|\n)\s*([A-D])[\.\、\)\：:]\s*([\s\S]*?)(?=(\n\s*[A-D][\.\、\)\：:])|$)/g)];
    if (optionMatches.length < 2) return null;
    const firstOption = optionMatches[0].index || block.length;
    const stem = block.slice(0, firstOption).replace(/^\s*\d{1,2}[\.\、]\s*/, '').trim();
    const options = optionMatches.map(match => ({ key: match[2], content: match[3].replace(/\n+/g, ' ').trim() })).filter(item => item.content);
    return {
      stem,
      options,
      answer: '',
      explanation: '',
      difficulty: 3,
      subject: 'data_structure',
      type: 'single',
      source: `PDF识别#${index + 1}`,
      status: 'published'
    };
  }).filter(Boolean);
};

const handlers = {
  async mockLogin(event) {
    const user = await ensureUser(event, { nickname: event.body?.nickname || '408 考生' });
    return { token: `cloud:${user.id}`, user };
  },
  async wechatLogin(event) {
    const user = await ensureUser(event, { nickname: event.body?.nickname || '微信用户' });
    return { token: `cloud:${user.id}`, user };
  },
  async login(event) {
    const phone = String(event.body?.phone || '').trim();
    if (!phone) throw new Error('手机号不能为空');
    const users = await collection('users').where({ phone }).limit(1).get();
    const user = users.data[0] ? serializeUser(users.data[0]) : await ensureUser({ ...event, token: `phone:${phone}` }, { phone, nickname: '408 考生' });
    return { token: user.id, user };
  },
  async register(event) {
    const phone = String(event.body?.phone || '').trim();
    const nickname = String(event.body?.nickname || '408 考生').trim();
    if (!phone) throw new Error('手机号不能为空');
    const existed = await collection('users').where({ phone }).limit(1).get();
    if (existed.data.length) throw new Error('手机号已注册');
    const user = await ensureUser({ ...event, token: `phone:${phone}` }, { phone, nickname });
    return { token: user.id, user };
  },
  async me(event) {
    return ensureUser(event);
  },
  async target(event) {
    return ensureUser(event, {
      targetScore: Number(event.body?.targetScore || 120),
      examDate: event.body?.examDate || null
    });
  },
  async questions(event) {
    const mode = event.params?.mode || 'sequence';
    return getQuestionList({ status: 'published', type: 'single' }, 20, mode === 'random');
  },
  async daily() {
    return getQuestionList({ status: 'published', type: 'single' }, 10, true);
  },
  async answer(event) {
    const user = await ensureUser(event);
    const question = await getDocById('questions', event.id);
    if (!question) throw new Error('题目不存在');
    const userAnswer = event.body?.answer;
    const correct = question.answer ? isAnswerCorrect(question.answer, userAnswer) : null;
    await collection('study_records').add({ data: { userId: user.id, questionId: event.id, action: 'answer', isCorrect: correct, metadata: { userAnswer }, createdAt: now() } });
    const stats = user.stats || {};
    await collection('users').doc(user.id).update({ data: { stats: { ...stats, totalQuestions: (stats.totalQuestions || 0) + 1, correctQuestions: (stats.correctQuestions || 0) + (correct ? 1 : 0) }, updatedAt: now() } });
    if (correct === false) {
      const existed = await collection('wrong_books').where({ userId: user.id, questionId: event.id }).limit(1).get();
      if (existed.data.length) {
        const item = existed.data[0];
        await collection('wrong_books').doc(item._id).update({ data: { wrongAnswer: userAnswer, wrongCount: (item.wrongCount || 0) + 1, lastWrongAt: now(), mastered: false } });
      } else {
        await collection('wrong_books').add({ data: { userId: user.id, questionId: event.id, wrongAnswer: userAnswer, wrongCount: 1, mastered: false, lastWrongAt: now(), createdAt: now() } });
      }
    }
    return { isCorrect: correct, answer: question.answer || '', explanation: question.explanation || '暂无解析', source: question.source, tags: question.tags || [] };
  },
  async toggleFavorite(event) {
    const user = await ensureUser(event);
    const existed = await collection('favorites').where({ userId: user.id, questionId: event.id }).limit(1).get();
    if (existed.data.length) {
      await collection('favorites').doc(existed.data[0]._id).remove();
      return { favorited: false };
    }
    await collection('favorites').add({ data: { userId: user.id, questionId: event.id, createdAt: now() } });
    return { favorited: true };
  },
  async favorites(event) {
    const user = await ensureUser(event);
    const result = await collection('favorites').where({ userId: user.id }).orderBy('createdAt', 'desc').limit(50).get();
    return loadQuestionsByIds(result.data.map(item => item.questionId));
  },
  async wrongBook(event) {
    const user = await ensureUser(event);
    const result = await collection('wrong_books').where({ userId: user.id, mastered: false }).orderBy('lastWrongAt', 'desc').limit(50).get();
    return loadQuestionsByIds(result.data.map(item => item.questionId));
  },
  async dashboard(event) {
    const user = await ensureUser(event);
    const [recentRecords, wrongBookCount, favoriteCount, totalAnswered, correctAnswered, questionCount, resourceCount] = await Promise.all([
      collection('study_records').where({ userId: user.id }).orderBy('createdAt', 'desc').limit(30).get(),
      collection('wrong_books').where({ userId: user.id, mastered: false }).count(),
      collection('favorites').where({ userId: user.id }).count(),
      collection('study_records').where({ userId: user.id, action: 'answer' }).count(),
      collection('study_records').where({ userId: user.id, action: 'answer', isCorrect: true }).count(),
      collection('questions').where({ status: 'published', type: 'single' }).count(),
      collection('resources').where({ status: 'published' }).count()
    ]);
    const weakSubjects = await groupSubjectCounts('wrong_books', user.id);
    const favoriteSubjects = await groupSubjectCounts('favorites', user.id);
    const accuracy = totalAnswered.total ? Math.round((correctAnswered.total / totalAnswered.total) * 100) : 0;
    const weakest = weakSubjects[0]?.label || '暂无明显薄弱科目';
    return {
      user,
      recentRecords: recentRecords.data,
      studyStats: {
        wrongBookCount: wrongBookCount.total,
        favoriteCount: favoriteCount.total,
        totalAnswered: totalAnswered.total,
        correctAnswered: correctAnswered.total,
        accuracy,
        weakSubjects,
        favoriteSubjects,
        report: totalAnswered.total ? `已完成 ${totalAnswered.total} 次作答，正确率 ${accuracy}%。当前薄弱重点是${weakest}，建议优先回收错题并复盘收藏题。` : '还没有作答记录。建议先完成每日一练，系统会自动生成薄弱科目和学习报告。',
        questionCount: questionCount.total,
        resourceCount: resourceCount.total
      }
    };
  },
  async checkin(event) {
    const user = await ensureUser(event);
    const stats = user.stats || {};
    const current = new Date();
    const alreadyCheckedToday = sameDay(stats.lastCheckInAt, current);
    const streakDays = alreadyCheckedToday ? (stats.streakDays || 0) : sameDay(stats.lastCheckInAt, yesterday(current)) ? (stats.streakDays || 0) + 1 : 1;
    const nextUser = await ensureUser(event, { stats: { ...stats, streakDays, lastCheckInAt: now() } });
    await collection('checkins').add({ data: { userId: user.id, checkedAt: now(), alreadyCheckedToday } });
    return { user: nextUser, checkedToday: true, alreadyCheckedToday };
  },
  async resources(event) {
    const where = { status: 'published' };
    if (event.params?.category && event.params.category !== 'all') where.category = event.params.category;
    const result = await collection('resources').where(where).orderBy('updatedAt', 'desc').limit(100).get();
    const keyword = String(event.params?.keyword || '').trim();
    return result.data.filter(item => !keyword || `${item.title || ''} ${item.description || ''} ${item.originalName || ''}`.includes(keyword)).map(item => ({ id: item._id, ...item }));
  },
  async aiTeacher(event) {
    const question = event.body?.payload?.question || event.body?.question || '';
    if (!String(question).trim()) throw new Error('请输入题目或疑问');
    return { content: await deepseekChat(question) };
  },
  async adminStats() {
    const [total, published, draft] = await Promise.all([
      collection('questions').count(),
      collection('questions').where({ status: 'published' }).count(),
      collection('questions').where({ status: 'draft' }).count()
    ]);
    return { total: total.total, published: published.total, draft: draft.total, subjectLabels: SUBJECT_LABELS };
  },
  async adminList(event) {
    const params = event.params || {};
    const where = {};
    if (params.subject) where.subject = params.subject;
    if (params.year) where.year = Number(params.year);
    const page = Math.max(1, Number(params.page || 1));
    const pageSize = Math.max(1, Math.min(100, Number(params.pageSize || 20)));
    const [items, total] = await Promise.all([
      collection('questions').where(where).orderBy('updatedAt', 'desc').skip((page - 1) * pageSize).limit(pageSize).get(),
      collection('questions').where(where).count()
    ]);
    const keyword = String(params.keyword || '').trim();
    const list = items.data.map(serializeQuestion).filter(item => !keyword || `${item.stem} ${item.source}`.includes(keyword));
    return { items: list, total: total.total, page, pageSize };
  },
  async adminCreate(event) {
    const payload = buildQuestionPayload(event.body || {});
    if (!payload) throw new Error('只允许保存带选项的单选题');
    const result = await collection('questions').add({ data: payload });
    return serializeQuestion({ ...payload, _id: result._id });
  },
  async adminUpdate(event) {
    const payload = buildQuestionPayload(event.body || {});
    if (!payload) throw new Error('只允许保存带选项的单选题');
    await collection('questions').doc(event.id).update({ data: payload });
    return serializeQuestion({ ...payload, _id: event.id });
  },
  async adminRemove(event) {
    const questionId = event.id;
    const refs = await Promise.all(['favorites', 'wrong_books', 'study_records'].map(name => collection(name).where({ questionId }).limit(1000).get().then(result => ({ name, rows: result.data }))));
    for (const ref of refs) {
      for (const row of ref.rows) await collection(ref.name).doc(row._id).remove();
    }
    await collection('questions').doc(questionId).remove();
    return { deleted: true };
  },
  async adminImport(event) {
    let rows = event.body?.questions || event.body?.items || [];
    if (event.body?.jsonText) rows = JSON.parse(String(event.body.jsonText));
    return importQuestionRows(jsonBodyRows(rows), event.body?.source || '后台导入');
  },
  async adminImportPdfJob(event) {
    if (!event.body?.fileID && !event.body?.fileBase64) throw new Error('请先上传 PDF 文件');
    const jobId = `${Date.now()}`;
    await collection('import_jobs').add({ data: { _id: jobId, status: 'processing', fileName: event.body.fileName || 'upload.pdf', stage: '正在解析 PDF', createdAt: now(), updatedAt: now() } });
    const rows = await parsePdfQuestions({ fileID: event.body.fileID, fileBase64: event.body.fileBase64 });
    const result = await importQuestionRows(rows.map(item => ({ ...item, year: Number(event.body.year || 0) || null, source: event.body.fileName || item.source })), event.body.fileName || 'PDF识别');
    const job = { id: jobId, status: 'succeeded', fileName: event.body.fileName || 'upload.pdf', stage: '导入完成', result, createdAt: now(), updatedAt: now() };
    await collection('import_jobs').doc(jobId).update({ data: job });
    return job;
  },
  async adminImport2025() {
    throw new Error('云函数不能直接读取电脑本地 2025 PDF，请在后台选择 2025 PDF 上传识别');
  },
  async adminGetImportJob(event) {
    const job = await getDocById('import_jobs', event.id);
    if (!job) throw new Error('导入任务不存在');
    return { id: job._id, ...job };
  }
};

const route = event => {
  const method = String(event.method || 'GET').toUpperCase();
  const path = String(event.path || '').replace(/^\/api/, '');
  const params = event.params || {};
  const body = event.body || {};
  const adminId = path.match(/^\/admin\/questions\/([^/]+)$/)?.[1];
  const answerId = path.match(/^\/questions\/([^/]+)\/answer$/)?.[1];
  const favoriteId = path.match(/^\/questions\/([^/]+)\/favorite$/)?.[1];
  const jobId = path.match(/^\/admin\/questions\/import-jobs\/([^/]+)$/)?.[1];

  if (method === 'POST' && path === '/auth/mock-login') return ['mockLogin', { ...event, body }];
  if (method === 'POST' && path === '/auth/wechat-login') return ['wechatLogin', { ...event, body }];
  if (method === 'POST' && path === '/auth/login') return ['login', { ...event, body }];
  if (method === 'POST' && path === '/auth/register') return ['register', { ...event, body }];
  if (method === 'GET' && path === '/auth/me') return ['me', event];
  if (method === 'POST' && path === '/auth/target') return ['target', { ...event, body }];
  if (method === 'GET' && path === '/questions/daily') return ['daily', event];
  if (method === 'GET' && path === '/questions') return ['questions', { ...event, params }];
  if (method === 'POST' && answerId) return ['answer', { ...event, id: answerId, body }];
  if (method === 'POST' && favoriteId) return ['toggleFavorite', { ...event, id: favoriteId }];
  if (method === 'GET' && path === '/questions/favorites') return ['favorites', event];
  if (method === 'GET' && path === '/questions/wrong-book') return ['wrongBook', event];
  if (method === 'GET' && path === '/study/dashboard') return ['dashboard', event];
  if (method === 'POST' && path === '/study/checkin') return ['checkin', event];
  if (method === 'GET' && path === '/resources') return ['resources', { ...event, params }];
  if (method === 'POST' && path === '/ai/agent/teacher') return ['aiTeacher', { ...event, body }];
  if (method === 'GET' && path === '/admin/questions/stats') return ['adminStats', event];
  if (method === 'GET' && path === '/admin/questions') return ['adminList', { ...event, params }];
  if (method === 'POST' && path === '/admin/questions') return ['adminCreate', { ...event, body }];
  if (method === 'PUT' && adminId) return ['adminUpdate', { ...event, id: adminId, body }];
  if (method === 'DELETE' && adminId) return ['adminRemove', { ...event, id: adminId }];
  if (method === 'POST' && path === '/admin/questions/import') return ['adminImport', { ...event, body }];
  if (method === 'POST' && path === '/admin/questions/import-pdf') return ['adminImportPdfJob', { ...event, body }];
  if (method === 'POST' && path === '/admin/questions/import-pdf-job') return ['adminImportPdfJob', { ...event, body }];
  if (method === 'POST' && path === '/admin/questions/import-2025') return ['adminImport2025', event];
  if (method === 'GET' && jobId) return ['adminGetImportJob', { ...event, id: jobId }];
  throw new Error(`未支持的云端接口：${method} ${path}`);
};

exports.main = async event => {
  try {
    const [name, payload] = route(event || {});
    return ok(await handlers[name](payload));
  } catch (error) {
    return fail(error.message || '云函数执行失败');
  }
};
