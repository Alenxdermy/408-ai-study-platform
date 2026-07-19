<script setup lang="ts">
import { computed, ref } from 'vue';
import { API_BASE_URL, http } from '../../services/http';
import { useAuthStore } from '../../stores/auth';

interface ResourceDocument {
  _id: string;
  title: string;
  description: string;
  category: string;
  originalName: string;
  size: number;
  viewCount: number;
  downloadCount: number;
  parseStatus: 'pending' | 'parsed' | 'failed';
  parseError?: string;
  textPreview?: string;
  wordCount?: number;
  summary?: string;
  summaryStatus: 'pending' | 'generated' | 'skipped' | 'failed';
  summaryError?: string;
  createdAt: string;
}

interface ChooseFileResult {
  path: string;
  name: string;
}

const auth = useAuthStore();
const resources = ref<ResourceDocument[]>([]);
const loading = ref(false);
const uploading = ref(false);
const summarizingId = ref('');
const keyword = ref('');
const category = ref('all');
const yearFilter = ref('all');

const categoryOptions = [
  { name: '全部', value: 'all' },
  { name: '真题', value: 'paper' },
  { name: '答案', value: 'answer' },
  { name: '通用', value: 'general' },
  { name: '数据结构', value: 'data_structure' },
  { name: '计算机网络', value: 'computer_network' },
  { name: '操作系统', value: 'os' },
  { name: '组成原理', value: 'computer_organization' }
];

const yearOptions = computed(() => {
  const years = new Set<string>();
  resources.value.forEach(item => {
    const match = item.title.match(/(20\d{2})/);
    if (match) years.add(match[1]);
  });
  const yearList = Array.from(years).sort((a, b) => b.localeCompare(a));
  return [{ name: '全部年份', value: 'all' }, ...yearList.map(y => ({ name: `${y}年`, value: y }))];
});

const filteredResources = computed(() => {
  let filtered = resources.value;
  
  if (yearFilter.value !== 'all') {
    filtered = filtered.filter(item => item.title.includes(yearFilter.value));
  }
  
  return filtered;
});

const uploadHint = computed(() => uploading.value ? '上传中...' : '上传 PDF');

const formatSize = (size: number) => {
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)}KB`;
  return `${(size / 1024 / 1024).toFixed(1)}MB`;
};

const parseStatusText = (item: ResourceDocument) => {
  if (item.parseStatus === 'parsed') return `已解析${item.wordCount ? ` · ${item.wordCount} 字` : ''}`;
  if (item.parseStatus === 'failed') return '解析失败';
  return '等待解析';
};

const summaryStatusText = (item: ResourceDocument) => {
  if (item.summaryStatus === 'generated') return 'AI 摘要';
  if (item.summaryStatus === 'skipped') return '未配置 AI Key，摘要待生成';
  if (item.summaryStatus === 'failed') return '摘要生成失败';
  return '摘要生成中';
};

const loadResources = async () => {
  loading.value = true;
  try {
    resources.value = await http.get<ResourceDocument[]>('/resources', {
      params: { keyword: keyword.value || undefined, category: category.value || undefined }
    });
  } catch (error) {
    uni.showToast({ title: '资料加载失败', icon: 'none' });
    console.warn(error);
  } finally {
    loading.value = false;
  }
};

const choosePdfFile = async (): Promise<ChooseFileResult | null> => {
  // #ifdef MP-WEIXIN
  const chooseMessageFile = (uni as unknown as {
    chooseMessageFile: (options: {
      count: number;
      type: 'file';
      extension: string[];
      success: (result: { tempFiles: Array<{ path: string; name: string }> }) => void;
      fail: (error: UniApp.GeneralCallbackResult) => void;
    }) => void;
  }).chooseMessageFile;

  return new Promise((resolve, reject) => {
    chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['pdf'],
      success: result => {
        const file = result.tempFiles[0];
        resolve(file ? { path: file.path, name: file.name } : null);
      },
      fail: reject
    });
  });
  // #endif

  // #ifdef H5
  const chooseFile = (uni as unknown as {
    chooseFile: (options: {
      count: number;
      extension: string[];
      success: (result: { tempFiles: Array<{ path: string; name: string }> }) => void;
      fail: (error: UniApp.GeneralCallbackResult) => void;
    }) => void;
  }).chooseFile;

  return new Promise((resolve, reject) => {
    chooseFile({
      count: 1,
      extension: ['.pdf'],
      success: result => {
        const file = result.tempFiles[0];
        resolve(file ? { path: file.path, name: file.name } : null);
      },
      fail: reject
    });
  });
  // #endif
};

const parseUploadResponse = (rawData: string) => {
  try {
    return JSON.parse(rawData) as { code: number | string; message?: string };
  } catch {
    return { code: 'PARSE_ERROR', message: rawData };
  }
};

const choosePdf = async () => {
  await auth.ensureLogin();
  uploading.value = true;

  try {
    const file = await choosePdfFile();
    if (!file) return;

    await new Promise<void>((resolve, reject) => {
      uni.uploadFile({
        url: `${API_BASE_URL}/resources/pdf`,
        filePath: file.path,
        name: 'file',
        header: { Authorization: `Bearer ${auth.token}` },
        formData: { title: file.name.replace(/\.pdf$/i, ''), category: category.value },
        success: response => {
          const body = parseUploadResponse(String(response.data || ''));
          if (response.statusCode >= 200 && response.statusCode < 300 && body.code === 0) {
            resolve();
            return;
          }
          reject(new Error(body.message || '上传失败'));
        },
        fail: reject
      });
    });

    uni.showToast({ title: '上传成功', icon: 'success' });
    await loadResources();
  } catch (error) {
    uni.showToast({ title: '上传失败', icon: 'none' });
    console.warn(error);
  } finally {
    uploading.value = false;
  }
};

const generateSummary = async (id: string) => {
  await auth.ensureLogin();
  summarizingId.value = id;
  try {
    await http.post(`/resources/${id}/summary`);
    uni.showToast({ title: '摘要已生成', icon: 'success' });
    await loadResources();
  } catch (error) {
    uni.showToast({ title: '摘要生成失败', icon: 'none' });
    console.warn(error);
  } finally {
    summarizingId.value = '';
  }
};

const openPdf = (id: string) => {
  const url = `${API_BASE_URL}/resources/${id}/read`;

  // #ifdef H5
  window.open(url, '_blank');
  // #endif

  // #ifdef MP-WEIXIN
  uni.showLoading({ title: '打开中...' });
  uni.downloadFile({
    url,
    success: result => {
      uni.openDocument({
        filePath: result.tempFilePath,
        fileType: 'pdf',
        showMenu: true,
        complete: () => uni.hideLoading()
      });
    },
    fail: error => {
      uni.hideLoading();
      uni.showToast({ title: '打开失败', icon: 'none' });
      console.warn(error);
    }
  });
  // #endif
};

const downloadPdf = (id: string) => {
  const url = `${API_BASE_URL}/resources/${id}/download`;

  // #ifdef H5
  window.open(url, '_blank');
  // #endif

  // #ifdef MP-WEIXIN
  uni.showLoading({ title: '保存中...' });
  uni.downloadFile({
    url,
    success: result => {
      uni.saveFile({
        tempFilePath: result.tempFilePath,
        success: () => uni.showToast({ title: '已保存', icon: 'success' }),
        fail: error => {
          uni.showToast({ title: '保存失败', icon: 'none' });
          console.warn(error);
        },
        complete: () => uni.hideLoading()
      });
    },
    fail: error => {
      uni.hideLoading();
      uni.showToast({ title: '下载失败', icon: 'none' });
      console.warn(error);
    }
  });
  // #endif
};

const changeCategory = (index: number) => {
  category.value = categoryOptions[index].value;
  void loadResources();
};

const changeYear = (index: number) => {
  yearFilter.value = yearOptions.value[index].value;
};

const getResourceType = (item: ResourceDocument): string => {
  if (item.title.includes('答案') || item.originalName.includes('answer')) {
    return 'answer';
  }
  if (item.title.match(/20\d{2}/)) {
    return 'paper';
  }
  return item.category;
};

const getTypeLabel = (item: ResourceDocument): string => {
  const type = getResourceType(item);
  const option = categoryOptions.find(opt => opt.value === type);
  return option?.name || '通用';
};

const getTypeColor = (item: ResourceDocument): string => {
  const type = getResourceType(item);
  if (type === 'paper') return '#2563eb';
  if (type === 'answer') return '#10b981';
  return '#667085';
};

void loadResources();
</script>

<template>
  <view class="page">
    <view class="section header-row">
      <view class="header-text">
        <text class="title">408 真题资料库</text>
        <text class="muted">2009-2025年真题及答案，支持在线阅读、下载保存和 AI 摘要生成</text>
      </view>
      <u-button size="small" type="primary" :loading="uploading" :text="uploadHint" @click="choosePdf" />
    </view>

    <view class="panel section filters">
      <u-search v-model="keyword" placeholder="搜索资料" :show-action="false" @search="loadResources" />
      <u-subsection :list="categoryOptions" key-name="name" mode="subsection" @change="changeCategory" />
      <u-subsection v-if="yearOptions.length > 1" :list="yearOptions" key-name="name" mode="subsection" @change="changeYear" />
    </view>

    <view v-if="loading" class="panel">
      <text class="muted">加载中...</text>
    </view>

    <view v-else-if="!filteredResources.length" class="panel empty">
      <text class="empty-title">暂无符合条件的资料</text>
      <text class="muted">可以先上传公开教材章节、课程讲义或自己整理的真题解析。资料库会成为后续 RAG 和自动出题的数据来源。</text>
    </view>

    <view v-for="item in filteredResources" v-else :key="item._id" class="panel resource-card">
      <view class="resource-main">
        <view class="resource-header">
          <text class="resource-title">{{ item.title }}</text>
          <view class="type-tag" :style="{ background: getTypeColor(item) }">
            <text class="type-text">{{ getTypeLabel(item) }}</text>
          </view>
        </view>
        <text class="muted">{{ item.description || item.originalName }}</text>
        <view class="resource-meta-row">
          <text class="meta">{{ formatSize(item.size) }}</text>
          <text class="meta-divider">·</text>
          <text class="meta">阅读 {{ item.viewCount }}</text>
          <text class="meta-divider">·</text>
          <text class="meta">下载 {{ item.downloadCount }}</text>
        </view>
        <text class="status" :class="{ failed: item.parseStatus === 'failed' }">{{ parseStatusText(item) }}</text>
      </view>

      <view v-if="item.summary || item.textPreview || item.summaryError" class="summary-box">
        <text class="summary-title">{{ summaryStatusText(item) }}</text>
        <text v-if="item.summary" class="summary-text">{{ item.summary }}</text>
        <text v-else-if="item.summaryError" class="summary-text">{{ item.summaryError }}</text>
        <text v-else class="summary-text">{{ item.textPreview }}</text>
      </view>

      <view class="resource-actions">
        <u-button size="small" text="预览" @click="openPdf(item._id)" />
        <u-button size="small" text="下载" @click="downloadPdf(item._id)" />
        <u-button
          size="small"
          type="primary"
          text="AI 摘要"
          :loading="summarizingId === item._id"
          @click="generateSummary(item._id)"
        />
      </view>
    </view>
  </view>
</template>

<style scoped>
.header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.header-text {
  flex: 1;
}

.filters {
  display: grid;
  gap: 18rpx;
}

.empty {
  display: grid;
  gap: 14rpx;
}

.empty-title {
  color: #182033;
  font-size: 32rpx;
  font-weight: 700;
}

.resource-card {
  display: grid;
  gap: 20rpx;
  margin-bottom: 20rpx;
}

.resource-main {
  display: grid;
  gap: 10rpx;
}

.resource-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.resource-title {
  flex: 1;
  color: #182033;
  font-size: 32rpx;
  font-weight: 700;
  line-height: 1.5;
}

.type-tag {
  padding: 6rpx 16rpx;
  border-radius: 6rpx;
  flex-shrink: 0;
}

.type-text {
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 600;
}

.resource-meta-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex-wrap: wrap;
}

.meta,
.status {
  color: #667085;
  font-size: 24rpx;
}

.meta-divider {
  color: #d0d5dd;
  font-size: 24rpx;
}

.status.failed {
  color: #dc2626;
}

.summary-box {
  display: grid;
  gap: 8rpx;
  padding: 18rpx;
  border-radius: 8px;
  background: #f8fafc;
}

.summary-title {
  color: #2563eb;
  font-size: 26rpx;
  font-weight: 700;
}

.summary-text {
  color: #344054;
  font-size: 26rpx;
  line-height: 1.7;
}

.resource-actions {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16rpx;
}
</style>
