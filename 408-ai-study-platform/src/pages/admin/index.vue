<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { API_BASE_URL, http } from '../../services/http';

interface QuestionItem {
  id: string;
  stem: string;
  subject: string;
  type: string;
  difficulty: number;
  options: Array<{ key: string; content: string }>;
  answer: string | string[];
  explanation: string;
  source: string;
  year: number | null;
  status: string;
  tags?: string[];
}

interface ApiResponse<T> {
  code: number | string;
  message: string;
  data: T;
}

interface ImportResult {
  created: number;
  updated: number;
  total: number;
}

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

const subjectLabelMap = Object.fromEntries(subjectOptions.map(item => [item.value, item.label]));
const typeLabelMap = Object.fromEntries(typeOptions.map(item => [item.value, item.label]));
const statusLabelMap = Object.fromEntries(statusOptions.map(item => [item.value, item.label]));

const list = ref<QuestionItem[]>([]);
const total = ref(0);
const loading = ref(false);
const saving = ref(false);
const importing = ref(false);
const importingPdf = ref(false);
const importing2025 = ref(false);
const keyword = ref('');
const importText = ref('');
const editingId = ref('');
const pdfFile = ref<File | null>(null);
const pdfYear = ref('');

const form = reactive({
  subject: 'data_structure',
  type: 'single',
  stem: '',
  optionsText: '',
  answerText: '',
  explanation: '',
  difficulty: 3,
  year: '',
  source: '',
  tagsText: '',
  status: 'published'
});

const stats = ref({
  total: 0,
  published: 0,
  draft: 0,
  bySubject: [] as Array<{ subject: string; count: number }>,
  byType: [] as Array<{ type: string; count: number }>,
  byDifficulty: [] as Array<{ difficulty: number; count: number }>
});

const editorTitle = computed(() => (editingId.value ? '编辑题目' : '新建题目'));
const pdfFileName = computed(() => pdfFile.value?.name || '未选择 PDF');
const statsCards = computed(() => [
  { label: '总题数', value: stats.value.total },
  { label: '已发布', value: stats.value.published },
  { label: '草稿', value: stats.value.draft }
]);

const formatAnswer = (answer: string | string[]) => Array.isArray(answer) ? answer.join('、') : answer;

const resetForm = () => {
  editingId.value = '';
  form.subject = 'data_structure';
  form.type = 'single';
  form.stem = '';
  form.optionsText = '';
  form.answerText = '';
  form.explanation = '';
  form.difficulty = 3;
  form.year = '';
  form.source = '';
  form.tagsText = '';
  form.status = 'published';
};

const mapOptionsText = (options: QuestionItem['options']) => {
  if (!Array.isArray(options)) return '';
  return options.map(option => `${option.key}. ${option.content}`).join('\n');
};

const loadStats = async () => {
  stats.value = await http.get('/admin/questions/stats');
};

const loadQuestions = async () => {
  loading.value = true;
  try {
    const data = await http.get<{ items: QuestionItem[]; total: number }>('/admin/questions', {
      params: {
        keyword: keyword.value.trim(),
        page: 1,
        pageSize: 100
      }
    });
    list.value = data.items || [];
    total.value = data.total || 0;
  } finally {
    loading.value = false;
  }
};

const refreshAll = async () => {
  await Promise.all([loadStats(), loadQuestions()]);
};

const pickValue = (field: 'subject' | 'type' | 'status', event: { detail: { value: string } }) => {
  const options = field === 'subject' ? subjectOptions : field === 'type' ? typeOptions : statusOptions;
  const index = Number(event.detail.value);
  (form as any)[field] = options[index]?.value || options[0].value;
};

const fillEditor = (item: QuestionItem) => {
  editingId.value = item.id;
  form.subject = item.subject;
  form.type = item.type;
  form.stem = item.stem || '';
  form.optionsText = mapOptionsText(item.options || []);
  form.answerText = formatAnswer(item.answer || '');
  form.explanation = item.explanation || '';
  form.difficulty = Number(item.difficulty || 3);
  form.year = item.year ? String(item.year) : '';
  form.source = item.source || '';
  form.tagsText = Array.isArray(item.tags) ? item.tags.join('，') : '';
  form.status = item.status || 'published';
  uni.pageScrollTo({ scrollTop: 0, duration: 200 });
};

const submitQuestion = async () => {
  if (!form.stem.trim()) {
    uni.showToast({ title: '题干不能为空', icon: 'none' });
    return;
  }

  saving.value = true;
  try {
    const payload = {
      subject: form.subject,
      type: form.type,
      stem: form.stem,
      options: form.optionsText,
      answer: form.answerText,
      explanation: form.explanation,
      difficulty: Number(form.difficulty),
      year: form.year ? Number(form.year) : null,
      source: form.source,
      tags: form.tagsText,
      status: form.status
    };

    if (editingId.value) {
      await http.put(`/admin/questions/${editingId.value}`, payload);
    } else {
      await http.post('/admin/questions', payload);
    }

    uni.showToast({ title: '保存成功', icon: 'success' });
    resetForm();
    await refreshAll();
  } catch (error) {
    uni.showToast({ title: (error as Error).message || '保存失败', icon: 'none' });
  } finally {
    saving.value = false;
  }
};

const deleteQuestionServer = async (item: QuestionItem) => {
  const confirmed = await new Promise<boolean>(resolve => {
    uni.showModal({
      title: '删除题目',
      content: '确定删除这道题吗？',
      success: modal => resolve(Boolean(modal.confirm))
    });
  });
  if (!confirmed) return;

  try {
    await http.delete(`/admin/questions/${item.id}`);
    uni.showToast({ title: '已删除', icon: 'success' });
    await refreshAll();
  } catch (error) {
    uni.showToast({ title: (error as Error).message || '删除失败', icon: 'none' });
  }
};

const importJson = async () => {
  if (!importText.value.trim()) {
    uni.showToast({ title: '请先粘贴 JSON', icon: 'none' });
    return;
  }

  importing.value = true;
  try {
    await http.post('/admin/questions/import', { jsonText: importText.value });
    uni.showToast({ title: '导入成功', icon: 'success' });
    importText.value = '';
    await refreshAll();
  } catch (error) {
    uni.showToast({ title: (error as Error).message || '导入失败', icon: 'none' });
  } finally {
    importing.value = false;
  }
};

const pickPdfFile = (event: Event) => {
  const input = event.target as HTMLInputElement;
  pdfFile.value = input.files?.[0] || null;
};

const importPdf = async () => {
  if (!pdfFile.value) {
    uni.showToast({ title: '请先选择 PDF', icon: 'none' });
    return;
  }

  importingPdf.value = true;
  try {
    const formData = new FormData();
    formData.append('file', pdfFile.value);
    if (pdfYear.value.trim()) formData.append('year', pdfYear.value.trim());

    const response = await fetch(`${API_BASE_URL}/admin/questions/import-pdf`, {
      method: 'POST',
      body: formData
    });
    const body = await response.json() as ApiResponse<ImportResult>;
    if (!response.ok || body?.code !== 0) throw new Error(body?.message || 'PDF 导入失败');

    uni.showToast({ title: `导入 ${body.data.total} 题`, icon: 'success' });
    pdfFile.value = null;
    await refreshAll();
  } catch (error) {
    uni.showToast({ title: (error as Error).message || 'PDF 导入失败', icon: 'none' });
  } finally {
    importingPdf.value = false;
  }
};

const import2025 = async () => {
  importing2025.value = true;
  try {
    const data = await http.post<{ created: number; updated: number; total: number }>('/admin/questions/import-2025');
    uni.showToast({ title: `导入 ${data.total} 题`, icon: 'success' });
    await refreshAll();
  } catch (error) {
    uni.showToast({ title: (error as Error).message || '导入 2025 失败', icon: 'none' });
  } finally {
    importing2025.value = false;
  }
};

onMounted(() => {
  void refreshAll();
});
</script>

<template>
  <view class="page admin-page">
    <view class="hero-shell section header">
      <view class="header-copy">
        <text class="eyebrow">ADMIN</text>
        <text class="title">题库管理</text>
        <text class="muted">直接打开就能用，无账号无密码。这里负责上传 PDF 自动识别，或导入 PDF 生成的 JSON，并维护数据库题库。</text>
      </view>
      <view class="header-badge">
        <text class="badge-value">{{ total }}</text>
        <text class="badge-label">题目</text>
      </view>
    </view>

    <view class="stats-grid section">
      <view v-for="card in statsCards" :key="card.label" class="stat-card soft-card">
        <text class="stat-value">{{ card.value }}</text>
        <text class="stat-label">{{ card.label }}</text>
      </view>
    </view>

    <view class="panel section">
      <view class="section-head">
        <text class="card-title">筛选题目</text>
        <u-button text="刷新" :loading="loading" @click="refreshAll" />
      </view>
      <input v-model="keyword" class="input" placeholder="按题干或来源搜索" />
      <view class="button-row">
        <u-button text="查询" type="primary" @click="loadQuestions" />
        <u-button text="清空" @click="keyword = ''; loadQuestions()" />
        <u-button text="新建题目" @click="resetForm" />
      </view>
    </view>

    <view class="panel section">
      <text class="card-title">上传 PDF 自动导入</text>
      <view class="upload-box">
        <!-- #ifdef H5 -->
        <input class="file-input" type="file" accept=".pdf,application/pdf" @change="pickPdfFile" />
        <!-- #endif -->
        <!-- #ifndef H5 -->
        <text class="muted">PDF 上传入口请在浏览器后台使用。</text>
        <!-- #endif -->
        <input v-model="pdfYear" class="input" type="number" maxlength="4" placeholder="年份，可不填" />
        <text class="muted">{{ pdfFileName }}</text>
      </view>
      <view class="button-row">
        <u-button type="primary" :loading="importingPdf" text="识别 PDF 并导入数据库" @click="importPdf" />
        <u-button :loading="importing2025" text="导入 2025 真题" @click="import2025" />
      </view>
    </view>

    <view class="panel section">
      <text class="card-title">导入 PDF JSON</text>
      <textarea v-model="importText" class="textarea" placeholder="粘贴 run_annotator.py --pdf 生成的 JSON 文本" />
      <u-button type="primary" :loading="importing" text="导入到数据库" @click="importJson" />
    </view>

    <view class="panel section editor">
      <view class="section-head">
        <text class="card-title">{{ editorTitle }}</text>
        <u-button text="重置" @click="resetForm" />
      </view>

      <view class="field">
        <text class="label">科目</text>
        <picker mode="selector" :range="subjectOptions" range-key="label" @change="pickValue('subject', $event)">
          <view class="picker">{{ subjectLabelMap[form.subject] || form.subject }}</view>
        </picker>
      </view>

      <view class="field">
        <text class="label">题型</text>
        <picker mode="selector" :range="typeOptions" range-key="label" @change="pickValue('type', $event)">
          <view class="picker">{{ typeLabelMap[form.type] || form.type }}</view>
        </picker>
      </view>

      <view class="field">
        <text class="label">难度</text>
        <input v-model.number="form.difficulty" class="input" type="number" maxlength="1" />
      </view>

      <view class="field">
        <text class="label">年份</text>
        <input v-model="form.year" class="input" type="number" maxlength="4" />
      </view>

      <view class="field">
        <text class="label">来源</text>
        <input v-model="form.source" class="input" placeholder="如 PDF 文件名或手工录入来源" />
      </view>

      <view class="field">
        <text class="label">题干</text>
        <textarea v-model="form.stem" class="textarea small" placeholder="题干内容" />
      </view>

      <view class="field">
        <text class="label">选项</text>
        <textarea v-model="form.optionsText" class="textarea small" placeholder="每行一项，如 A. 选项内容" />
      </view>

      <view class="field">
        <text class="label">答案</text>
        <input v-model="form.answerText" class="input" placeholder="单选填 A，多选填 AB，主观题填文本" />
      </view>

      <view class="field">
        <text class="label">解析</text>
        <textarea v-model="form.explanation" class="textarea small" placeholder="题目解析" />
      </view>

      <view class="field">
        <text class="label">标签</text>
        <input v-model="form.tagsText" class="input" placeholder="多个标签用逗号分隔" />
      </view>

      <view class="field">
        <text class="label">状态</text>
        <picker mode="selector" :range="statusOptions" range-key="label" @change="pickValue('status', $event)">
          <view class="picker">{{ statusLabelMap[form.status] || form.status }}</view>
        </picker>
      </view>

      <u-button type="primary" :loading="saving" text="保存题目" @click="submitQuestion" />
    </view>

    <view class="panel section">
      <view class="section-head">
        <text class="card-title">题目列表</text>
        <text class="muted">共 {{ list.length }} 条</text>
      </view>

      <view v-if="loading" class="muted">加载中...</view>
      <view v-else class="item-list">
        <view v-for="item in list" :key="item.id" class="item-card">
          <view class="item-head">
            <text class="item-title">{{ item.stem }}</text>
          </view>
          <text class="item-meta">
            {{ subjectLabelMap[item.subject] || item.subject }} ·
            {{ typeLabelMap[item.type] || item.type }} ·
            难度 {{ item.difficulty }} ·
            {{ statusLabelMap[item.status] || item.status }}
          </text>
          <text class="item-meta">来源：{{ item.source || '后台录入' }} · 选项 {{ item.options?.length || 0 }} 个</text>
          <text class="item-meta">答案：{{ formatAnswer(item.answer) || '暂无' }}</text>

          <view class="action-row">
            <u-button size="small" text="编辑" @click="fillEditor(item)" />
            <u-button size="small" type="error" text="删除" @click="deleteQuestionServer(item)" />
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.admin-page {
  display: grid;
  gap: 18rpx;
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
  padding: 32rpx 28rpx;
}

.header-copy {
  flex: 1;
  display: grid;
  gap: 8rpx;
}

.title {
  color: #fff;
  font-size: 40rpx;
  font-weight: 900;
  line-height: 1.25;
}

.header-badge {
  display: grid;
  place-items: center;
  flex: 0 0 120rpx;
  height: 120rpx;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.16);
}

.badge-value {
  color: #fff;
  font-size: 34rpx;
  font-weight: 900;
}

.badge-label {
  color: rgba(255, 255, 255, 0.8);
  font-size: 22rpx;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14rpx;
}

.stat-card {
  padding: 18rpx 12rpx;
  text-align: center;
}

.stat-value {
  color: #1d4ed8;
  font-size: 34rpx;
  font-weight: 900;
}

.stat-label {
  color: #64748b;
  font-size: 24rpx;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.button-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
}

.upload-box {
  display: grid;
  gap: 12rpx;
  margin: 12rpx 0;
}

.file-input {
  width: 100%;
  box-sizing: border-box;
  padding: 20rpx;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 8px;
  background: #fff;
  color: #111827;
  font-size: 26rpx;
}

.input,
.textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 8px;
  background: #fff;
  color: #111827;
  font-size: 28rpx;
}

.input {
  height: 84rpx;
  padding: 0 20rpx;
}

.textarea {
  min-height: 180rpx;
  padding: 18rpx 20rpx;
}

.textarea.small {
  min-height: 150rpx;
}

.editor {
  display: grid;
  gap: 14rpx;
}

.field {
  display: grid;
  gap: 8rpx;
}

.label {
  color: #475569;
  font-size: 24rpx;
  font-weight: 700;
}

.picker {
  display: flex;
  align-items: center;
  min-height: 84rpx;
  padding: 0 20rpx;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 8px;
  background: #fff;
  font-size: 28rpx;
  color: #111827;
}

.item-list {
  display: grid;
  gap: 14rpx;
}

.item-card {
  display: grid;
  gap: 8rpx;
  padding: 20rpx;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 8px;
  background: #fff;
}

.item-title {
  color: #111827;
  font-size: 28rpx;
  font-weight: 800;
  line-height: 1.5;
}

.item-meta {
  color: #64748b;
  font-size: 23rpx;
  line-height: 1.5;
}

.action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
  margin-top: 8rpx;
}
</style>
