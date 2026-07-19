<script setup lang="ts">
import { computed, ref } from 'vue';
import { API_BASE_URL, http } from '../../services/http';
import { useAuthStore } from '../../stores/auth';

interface ResourceDocument {
  id: string;
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
      params: { keyword: keyword.value || undefined }
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
          formData: { title: file.name.replace(/\.pdf$/i, ''), category: 'general' },
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

void loadResources();
</script>

<template>
  <view class="page">
    <view class="header-section">
      <view class="header-content">
        <text class="page-title">PDF 资料库</text>
        <text class="page-subtitle">共 {{ resources.length }} 份资料</text>
      </view>
      <view class="header-action">
        <u-button size="default" type="primary" :loading="uploading" :text="uploadHint" @click="choosePdf" />
      </view>
    </view>

    <view class="search-section">
      <u-search v-model="keyword" placeholder="搜索资料（如：2025、answer）" :show-action="false" @search="loadResources" />
    </view>

    <view v-if="loading" class="content-section">
      <view class="loading-state">
        <text class="loading-text">加载中...</text>
      </view>
    </view>

    <view v-else-if="!resources.length" class="content-section">
      <view class="empty-state">
        <text class="empty-icon">📚</text>
        <text class="empty-title">暂无 PDF 资料</text>
        <text class="empty-desc">点击右上角「上传 PDF」添加您的学习资料</text>
      </view>
    </view>

    <view v-else class="content-section">
      <view class="resource-list">
        <view v-for="item in resources" :key="item.id" class="resource-card">
          <view class="card-header">
            <view class="card-icon">📄</view>
            <view class="card-title-wrap">
              <text class="card-title">{{ item.title }}</text>
              <text class="card-meta">{{ formatSize(item.size) }} · 阅读 {{ item.viewCount }} · 下载 {{ item.downloadCount }}</text>
            </view>
            <view class="card-status" :class="{ failed: item.parseStatus === 'failed' }">
              {{ parseStatusText(item) }}
            </view>
          </view>

          <view v-if="item.summary || item.textPreview || item.summaryError" class="card-summary">
            <text class="summary-label">{{ summaryStatusText(item) }}</text>
            <text v-if="item.summary" class="summary-content">{{ item.summary }}</text>
            <text v-else-if="item.summaryError" class="summary-content error">{{ item.summaryError }}</text>
            <text v-else class="summary-content">{{ item.textPreview }}</text>
          </view>

          <view class="card-actions">
            <u-button size="mini" type="default" text="阅读" @click="openPdf(item.id)" />
            <u-button size="mini" type="default" text="保存" @click="downloadPdf(item.id)" />
            <u-button
              size="mini"
              type="primary"
              text="生成摘要"
              :loading="summarizingId === item.id"
              @click="generateSummary(item.id)"
            />
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #f5f7fa;
  padding-bottom: 120rpx;
}

.header-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 30rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.page-title {
  color: #ffffff;
  font-size: 40rpx;
  font-weight: 700;
}

.page-subtitle {
  color: rgba(255, 255, 255, 0.8);
  font-size: 26rpx;
}

.header-action {
  flex-shrink: 0;
}

.search-section {
  padding: 24rpx 30rpx;
  background-color: #ffffff;
  margin: 0 20rpx;
  margin-top: -20rpx;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.08);
}

.content-section {
  padding: 24rpx 20rpx;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 100rpx 0;
}

.loading-text {
  color: #999999;
  font-size: 28rpx;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100rpx 40rpx;
  text-align: center;
}

.empty-icon {
  font-size: 100rpx;
  margin-bottom: 32rpx;
}

.empty-title {
  color: #333333;
  font-size: 34rpx;
  font-weight: 600;
  margin-bottom: 16rpx;
}

.empty-desc {
  color: #999999;
  font-size: 28rpx;
  line-height: 1.6;
}

.resource-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.resource-card {
  background-color: #ffffff;
  border-radius: 16rpx;
  padding: 28rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
  margin-bottom: 20rpx;
}

.card-icon {
  font-size: 48rpx;
  flex-shrink: 0;
}

.card-title-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.card-title {
  color: #182033;
  font-size: 32rpx;
  font-weight: 600;
}

.card-meta {
  color: #999999;
  font-size: 24rpx;
}

.card-status {
  color: #67c23a;
  font-size: 24rpx;
  padding: 6rpx 16rpx;
  background-color: #f0f9eb;
  border-radius: 20rpx;
  flex-shrink: 0;
}

.card-status.failed {
  color: #f56c6c;
  background-color: #fef0f0;
}

.card-summary {
  background-color: #f8fafc;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
}

.summary-label {
  display: block;
  color: #2563eb;
  font-size: 24rpx;
  font-weight: 600;
  margin-bottom: 10rpx;
}

.summary-content {
  color: #666666;
  font-size: 26rpx;
  line-height: 1.7;
}

.summary-content.error {
  color: #f56c6c;
}

.card-actions {
  display: flex;
  gap: 16rpx;
}

.card-actions :deep(.u-button) {
  flex: 1;
}
</style>