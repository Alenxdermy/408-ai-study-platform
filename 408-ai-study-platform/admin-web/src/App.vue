<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { api, API_BASE_URL, type QuestionItem } from './api';

const subjectOptions = [
  { label: '数据结构', value: 'data_structure' },
  { label: '计算机组成原理', value: 'computer_organization' },
  { label: '操作系统', value: 'os' },
  { label: '计算机网络', value: 'computer_network' }
];

const typeOptions = [
  { label: '单选题', value: 'single' },
  { label: '多选题', value: 'multiple' },
  { label: '判断题', value: 'judge' },
  { label: '填空题', value: 'blank' },
  { label: '主观题', value: 'essay' }
];

const statusOptions = [
  { label: '已发布', value: 'published' },
  { label: '草稿', value: 'draft' }
];

const subjectLabels = Object.fromEntries(subjectOptions.map(item => [item.value, item.label]));
const typeLabels = Object.fromEntries(typeOptions.map(item => [item.value, item.label]));
const statusLabels = Object.fromEntries(statusOptions.map(item => [item.value, item.label]));

const loading = ref(false);
const saving = ref(false);
const importing = ref(false);
const message = ref('');
const error = ref('');
const editingId = ref('');
const keyword = ref('');
const filterSubject = ref('');
const filterYear = ref('');
const importText = ref('');
const importResultJson = ref('');
const pdfFile = ref<File | null>(null);
const pdfYear = ref('');
const list = ref<QuestionItem[]>([]);
const total = ref(0);
const stats = ref({ total: 0, published: 0, draft: 0 });

const form = reactive({
  subject: 'data_structure',
  type: 'single',
  difficulty: 3,
  year: '',
  source: '',
  status: 'published',
  stem: '',
  optionsText: '',
  answerText: '',
  explanation: '',
  tagsText: ''
});

const editorTitle = computed(() => editingId.value ? '编辑题目' : '新建题目');
const pdfFileName = computed(() => pdfFile.value?.name ?? '未选择 PDF');

const showMessage = (text: string) => {
  message.value = text;
  error.value = '';
};

const showError = (text: string) => {
  error.value = text;
  message.value = '';
};

const resetForm = () => {
  editingId.value = '';
  Object.assign(form, {
    subject: 'data_structure',
    type: 'single',
    difficulty: 3,
    year: '',
    source: '',
    status: 'published',
    stem: '',
    optionsText: '',
    answerText: '',
    explanation: '',
    tagsText: ''
  });
};

const formatAnswer = (answer: string | string[]) => Array.isArray(answer) ? answer.join('、') : answer;

const formatOptions = (options: QuestionItem['options']) => {
  if (!Array.isArray(options)) return '';
  return options.map(option => `${option.key}. ${option.content}`).join('\n');
};

const buildPayload = () => ({
  subject: form.subject,
  type: form.type,
  difficulty: Number(form.difficulty),
  year: form.year ? Number(form.year) : null,
  source: form.source,
  status: form.status,
  stem: form.stem,
  options: form.optionsText,
  answer: form.answerText,
  explanation: form.explanation,
  tags: form.tagsText
});

const loadStats = async () => {
  stats.value = await api.stats();
};

const loadQuestions = async () => {
  loading.value = true;
  try {
    const data = await api.list({
      keyword: keyword.value.trim(),
      subject: filterSubject.value,
      year: filterYear.value ? Number(filterYear.value) : undefined,
      page: 1,
      pageSize: 100
    });
    list.value = data.items ?? [];
    total.value = data.total ?? 0;
  } catch (err) {
    showError((err as Error).message);
  } finally {
    loading.value = false;
  }
};

const refreshAll = async () => {
  await Promise.all([loadStats(), loadQuestions()]);
};

const editQuestion = (item: QuestionItem) => {
  editingId.value = item.id;
  Object.assign(form, {
    subject: item.subject,
    type: item.type,
    difficulty: item.difficulty,
    year: item.year ? String(item.year) : '',
    source: item.source ?? '',
    status: item.status ?? 'published',
    stem: item.stem ?? '',
    optionsText: formatOptions(item.options ?? []),
    answerText: formatAnswer(item.answer ?? ''),
    explanation: item.explanation ?? '',
    tagsText: Array.isArray(item.tags) ? item.tags.join('、') : ''
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const saveQuestion = async () => {
  if (!form.stem.trim()) {
    showError('题干不能为空');
    return;
  }

  saving.value = true;
  try {
    if (editingId.value) await api.update(editingId.value, buildPayload());
    else await api.create(buildPayload());
    showMessage('题目已保存');
    resetForm();
    await refreshAll();
  } catch (err) {
    showError((err as Error).message);
  } finally {
    saving.value = false;
  }
};

const deleteQuestion = async (item: QuestionItem) => {
  if (!window.confirm('确定删除这道题吗？')) return;
  try {
    await api.remove(item.id);
    showMessage('题目已删除');
    await refreshAll();
  } catch (err) {
    showError((err as Error).message);
  }
};

const importJson = async () => {
  if (!importText.value.trim()) {
    showError('请先粘贴 JSON');
    return;
  }

  importing.value = true;
  try {
    const result = await api.importJson(importText.value);
    importResultJson.value = JSON.stringify(result.items ?? [], null, 2);
    importText.value = '';
    showMessage(`JSON 导入完成：新增 ${result.created}，更新 ${result.updated}`);
    await refreshAll();
  } catch (err) {
    showError((err as Error).message);
  } finally {
    importing.value = false;
  }
};

const selectPdf = (event: Event) => {
  pdfFile.value = (event.target as HTMLInputElement).files?.[0] ?? null;
};

const importPdf = async () => {
  if (!pdfFile.value) {
    showError('请先选择 PDF 文件');
    return;
  }

  importing.value = true;
  try {
    const data = new FormData();
    data.append('file', pdfFile.value);
    if (pdfYear.value.trim()) data.append('year', pdfYear.value.trim());

    const result = await api.importPdf(data);
    importResultJson.value = JSON.stringify(result.items ?? [], null, 2);
    showMessage(`PDF 识别并入库完成：共 ${result.total} 题`);
    await refreshAll();
  } catch (err) {
    showError((err as Error).message);
  } finally {
    importing.value = false;
  }
};

const import2025 = async () => {
  importing.value = true;
  try {
    const result = await api.import2025();
    importResultJson.value = JSON.stringify(result.items ?? [], null, 2);
    showMessage(`2025 真题导入完成：新增 ${result.created}，更新 ${result.updated}`);
    await refreshAll();
  } catch (err) {
    showError((err as Error).message);
  } finally {
    importing.value = false;
  }
};

onMounted(() => {
  void refreshAll();
});
</script>

<template>
  <main class="layout">
    <header class="topbar">
      <div>
        <p class="eyebrow">408 Admin</p>
        <h1>题库后台管理</h1>
      </div>
      <div class="api">接口：{{ API_BASE_URL }}</div>
    </header>

    <section class="stats">
      <div><strong>{{ stats.total }}</strong><span>总题数</span></div>
      <div><strong>{{ stats.published }}</strong><span>已发布</span></div>
      <div><strong>{{ stats.draft }}</strong><span>草稿</span></div>
      <div><strong>{{ total }}</strong><span>当前列表</span></div>
    </section>

    <p v-if="message" class="notice success">{{ message }}</p>
    <p v-if="error" class="notice error">{{ error }}</p>

    <section class="grid">
      <form class="panel editor" @submit.prevent="saveQuestion">
        <div class="panel-head">
          <h2>{{ editorTitle }}</h2>
          <button type="button" class="ghost" @click="resetForm">清空</button>
        </div>

        <div class="two-cols">
          <label>科目
            <select v-model="form.subject">
              <option v-for="item in subjectOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </label>
          <label>题型
            <select v-model="form.type">
              <option v-for="item in typeOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </label>
          <label>难度
            <input v-model.number="form.difficulty" type="number" min="1" max="5" />
          </label>
          <label>年份
            <input v-model="form.year" type="number" placeholder="例如 2025" />
          </label>
          <label>状态
            <select v-model="form.status">
              <option v-for="item in statusOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </label>
          <label>来源
            <input v-model="form.source" placeholder="PDF 或手动录入" />
          </label>
        </div>

        <label>题干
          <textarea v-model="form.stem" rows="5" placeholder="题目内容"></textarea>
        </label>
        <label>选项
          <textarea v-model="form.optionsText" rows="5" placeholder="每行一个选项，例如：A. 选项内容"></textarea>
        </label>
        <label>答案
          <input v-model="form.answerText" placeholder="单选 A，多选 AB，主观题填文字" />
        </label>
        <label>解析
          <textarea v-model="form.explanation" rows="4"></textarea>
        </label>
        <label>标签
          <input v-model="form.tagsText" placeholder="多个标签用逗号或顿号分隔" />
        </label>

        <button class="primary" type="submit" :disabled="saving">{{ saving ? '保存中...' : '保存题目' }}</button>
      </form>

      <aside class="side">
        <section class="panel">
          <h2>PDF / JSON 导入</h2>
          <label>上传 PDF 自动识别并入库
            <input type="file" accept=".pdf,application/pdf" @change="selectPdf" />
          </label>
          <div class="two-cols compact">
            <input v-model="pdfYear" type="number" placeholder="年份，可不填" />
            <button class="primary" type="button" :disabled="importing" @click="importPdf">识别 PDF</button>
          </div>
          <p class="muted">{{ pdfFileName }}</p>
          <button class="ghost full" type="button" :disabled="importing" @click="import2025">一键导入 2025 真题</button>
          <label>粘贴 JSON 导入
            <textarea v-model="importText" rows="8" placeholder="粘贴 few-shot 生成的 JSON"></textarea>
          </label>
          <button class="primary full" type="button" :disabled="importing" @click="importJson">导入 JSON</button>
        </section>

        <section v-if="importResultJson" class="panel">
          <h2>最近识别 JSON</h2>
          <textarea class="json-output" readonly :value="importResultJson" rows="12"></textarea>
        </section>
      </aside>
    </section>

    <section class="panel">
      <div class="panel-head">
        <h2>题目列表</h2>
        <button type="button" class="ghost" :disabled="loading" @click="refreshAll">刷新</button>
      </div>
      <div class="filters">
        <input v-model="keyword" placeholder="搜索题干或来源" @keyup.enter="loadQuestions" />
        <select v-model="filterSubject">
          <option value="">全部科目</option>
          <option v-for="item in subjectOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
        </select>
        <input v-model="filterYear" type="number" placeholder="年份" @keyup.enter="loadQuestions" />
        <button type="button" class="primary" @click="loadQuestions">查询</button>
      </div>

      <div v-if="loading" class="empty">加载中...</div>
      <div v-else-if="!list.length" class="empty">暂无题目</div>
      <article v-for="item in list" v-else :key="item.id" class="question">
        <div class="question-main">
          <h3>{{ item.stem }}</h3>
          <p class="meta">
            {{ subjectLabels[item.subject] || item.subject }} /
            {{ typeLabels[item.type] || item.type }} /
            难度 {{ item.difficulty }} /
            {{ statusLabels[item.status] || item.status }} /
            {{ item.year || '无年份' }}
          </p>
          <p v-if="item.options?.length" class="options">
            {{ item.options.map(option => `${option.key}. ${option.content}`).join('  ') }}
          </p>
          <p class="meta">答案：{{ formatAnswer(item.answer) || '暂无' }}；来源：{{ item.source || '后台录入' }}</p>
        </div>
        <div class="actions">
          <button type="button" class="ghost" @click="editQuestion(item)">编辑</button>
          <button type="button" class="danger" @click="deleteQuestion(item)">删除</button>
        </div>
      </article>
    </section>
  </main>
</template>
