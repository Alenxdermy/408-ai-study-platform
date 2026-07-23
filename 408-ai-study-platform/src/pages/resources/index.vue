<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { API_BASE_URL, http } from '../../services/http';

type ResourceKind = 'paper' | 'answer';

interface ResourceDocument {
  id: string;
  title: string;
  description: string;
  category: ResourceKind | string;
  originalName: string;
  mimeType: string;
  size: number;
  viewCount: number;
  downloadCount: number;
}

interface PdfResource {
  id: string;
  year: string;
  kind: ResourceKind;
  title: string;
  description: string;
  fileName: string;
  size: number;
  viewCount: number;
  downloadCount: number;
}

interface YearResourceGroup {
  year: string;
  items: PdfResource[];
}

const keyword = ref('');
const category = ref('all');
const loading = ref(false);
const resources = ref<PdfResource[]>([]);

const categoryOptions = [
  { name: '全部', value: 'all' },
  { name: '真题', value: 'paper' },
  { name: '答案', value: 'answer' }
];

const extractYear = (document: ResourceDocument) => {
  const source = `${document.title} ${document.originalName}`;
  const matched = source.match(/20\d{2}/);
  return matched?.[0] ?? '其他';
};

const normalizeKind = (categoryName: string): ResourceKind => categoryName === 'answer' ? 'answer' : 'paper';

const mapResource = (document: ResourceDocument): PdfResource => ({
  id: document.id,
  year: extractYear(document),
  kind: normalizeKind(document.category),
  title: document.title,
  description: document.description,
  fileName: document.originalName,
  size: document.size,
  viewCount: document.viewCount,
  downloadCount: document.downloadCount
});

const loadResources = async () => {
  loading.value = true;
  try {
    const data = await http.get<ResourceDocument[]>('/resources', {
      params: {
        category: category.value,
        keyword: keyword.value.trim()
      }
    });
    resources.value = data
      .filter(item => item.mimeType === 'application/pdf' && (item.category === 'paper' || item.category === 'answer'))
      .map(mapResource)
      .sort((a, b) => {
        const yearDiff = b.year.localeCompare(a.year);
        if (yearDiff !== 0) return yearDiff;
        return a.kind === 'paper' ? -1 : 1;
      });
  } catch (error) {
    uni.showToast({ title: '资料加载失败', icon: 'none' });
    console.warn('load resources failed', error);
  } finally {
    loading.value = false;
  }
};

let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch([keyword, category], () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    void loadResources();
  }, 260);
});

onMounted(() => {
  void loadResources();
});

const filteredYearGroups = computed<YearResourceGroup[]>(() => {
  const years = Array.from(new Set(resources.value.map(item => item.year))).sort((a, b) => b.localeCompare(a));
  return years.map(year => ({
    year,
    items: resources.value.filter(item => item.year === year)
  }));
});

const paperCount = computed(() => resources.value.filter(item => item.kind === 'paper').length);
const answerCount = computed(() => resources.value.filter(item => item.kind === 'answer').length);
const visibleCount = computed(() => resources.value.length);

const formatSize = (size: number) => {
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)}KB`;
  return `${(size / 1024 / 1024).toFixed(1)}MB`;
};

const getTypeLabel = (kind: ResourceKind) => kind === 'paper' ? '真题' : '答案';

const getTypeClass = (kind: ResourceKind) => kind === 'paper' ? 'paper' : 'answer';

const buildPdfUrl = (item: PdfResource, action: 'preview' | 'download') => {
  const endpoint = action === 'preview' ? 'read' : 'download';
  return `${API_BASE_URL}/resources/${encodeURIComponent(item.id)}/${endpoint}`;
};

const getNetworkErrorMessage = (error: UniApp.GeneralCallbackResult) => {
  const errMsg = String(error.errMsg || '');
  if (errMsg.includes('url not in domain list')) return '请在微信开发者工具中勾选不校验合法域名';
  if (errMsg.includes('fail')) return '请确认后端已启动，且小程序能访问接口地址';
  return 'PDF 打开失败';
};

const openDownloadedPdf = (filePath: string) => {
  if (!filePath) {
    uni.hideLoading();
    uni.showToast({ title: '文件路径无效', icon: 'none' });
    return;
  }

  uni.openDocument({
    filePath,
    fileType: 'pdf',
    showMenu: true,
    success: () => uni.hideLoading(),
    fail: error => {
      uni.hideLoading();
      uni.showToast({ title: '微信无法打开该 PDF', icon: 'none' });
      console.warn('openDocument failed', error);
    }
  });
};

const openPdf = (item: PdfResource) => {
  const url = buildPdfUrl(item, 'preview');

  // #ifdef H5
  window.open(url, '_blank');
  // #endif

  // #ifdef MP-WEIXIN
  uni.showLoading({ title: '打开中...' });
  uni.downloadFile({
    url,
    timeout: 60000,
    header: { Accept: 'application/pdf' },
    success: result => {
      if (result.statusCode !== 200) {
        uni.hideLoading();
        uni.showToast({ title: `文件获取失败 ${result.statusCode}`, icon: 'none' });
        return;
      }

      openDownloadedPdf(result.tempFilePath);
      void loadResources();
    },
    fail: error => {
      uni.hideLoading();
      uni.showToast({ title: getNetworkErrorMessage(error), icon: 'none' });
      console.warn('downloadFile preview failed', { url, error });
    }
  });
  // #endif
};

const downloadPdf = (item: PdfResource) => {
  const url = buildPdfUrl(item, 'download');

  // #ifdef H5
  window.open(url, '_blank');
  // #endif

  // #ifdef MP-WEIXIN
  uni.showLoading({ title: '下载中...' });
  uni.downloadFile({
    url,
    timeout: 60000,
    header: { Accept: 'application/pdf' },
    success: result => {
      if (result.statusCode !== 200) {
        uni.hideLoading();
        uni.showToast({ title: `下载失败 ${result.statusCode}`, icon: 'none' });
        return;
      }

      uni.saveFile({
        tempFilePath: result.tempFilePath,
        success: saveResult => {
          uni.hideLoading();
          void loadResources();
          uni.showModal({
            title: '下载完成',
            content: 'PDF 已保存，可在微信文档菜单中打开、转发或收藏。',
            confirmText: '打开',
            cancelText: '知道了',
            success: modal => {
              if (modal.confirm) openDownloadedPdf(saveResult.savedFilePath);
            }
          });
        },
        fail: error => {
          uni.hideLoading();
          uni.showToast({ title: '保存失败', icon: 'none' });
          console.warn('saveFile failed', error);
        }
      });
    },
    fail: error => {
      uni.hideLoading();
      uni.showToast({ title: getNetworkErrorMessage(error), icon: 'none' });
      console.warn('downloadFile save failed', { url, error });
    }
  });
  // #endif
};

const changeCategory = (index: number) => {
  category.value = categoryOptions[index].value;
};
</script>

<template>
  <view class="page">
    <view class="header-section hero-shell section">
      <view class="header-content">
        <text class="header-kicker">PDF LIBRARY</text>
        <text class="page-title">408 真题资料库</text>
        <text class="page-subtitle">资料来自数据库记录，文件保存在本地资料目录，支持预览和下载</text>
      </view>
      <view class="header-stats">
        <text class="stat-number">{{ visibleCount }}</text>
        <text class="stat-label">当前显示</text>
      </view>
    </view>

    <view class="metrics section">
      <view class="metric-card">
        <text class="metric-value">{{ paperCount }}</text>
        <text class="metric-label">真题</text>
      </view>
      <view class="metric-card">
        <text class="metric-value">{{ answerCount }}</text>
        <text class="metric-label">答案</text>
      </view>
      <view class="metric-card">
        <text class="metric-value">2009-2025</text>
        <text class="metric-label">年份覆盖</text>
      </view>
    </view>

    <view class="panel section filters">
      <view class="filter-head">
        <text class="card-title">资料筛选</text>
        <text class="muted">点击下方年份可查看对应真题与答案</text>
      </view>
      <u-search v-model="keyword" placeholder="搜索年份、真题、答案" :show-action="false" />
      <u-subsection :list="categoryOptions" key-name="name" mode="subsection" @change="changeCategory" />
    </view>

    <view v-if="loading" class="panel empty-state">
      <text class="empty-title">正在加载资料</text>
      <text class="muted">正在从数据库读取 PDF 资源记录...</text>
      <view class="skeleton-list">
        <text class="skeleton-line wide"></text>
        <text class="skeleton-line"></text>
        <text class="skeleton-line short"></text>
      </view>
    </view>

    <view v-else-if="!filteredYearGroups.length" class="panel empty-state">
      <text class="empty-title">暂无符合条件的资料</text>
      <text class="muted">请先运行 npm run resources:sync，或调整搜索词和资料类型。</text>
    </view>

    <view v-else class="year-list">
      <view v-for="group in filteredYearGroups" :key="group.year" class="panel year-card">
        <view class="year-header">
          <view class="year-title-wrap">
            <text class="year-dot"></text>
            <text class="year-title">{{ group.year }} 年</text>
          </view>
          <text class="year-count">{{ group.items.length }} 份资料</text>
        </view>

        <view class="pdf-list">
          <view v-for="item in group.items" :key="item.id" class="pdf-row">
            <view class="pdf-status-line" :class="getTypeClass(item.kind)"></view>
            <view class="pdf-main">
              <text class="type-tag" :class="getTypeClass(item.kind)">{{ getTypeLabel(item.kind) }}</text>
              <view class="pdf-text">
                <text class="pdf-title">{{ item.title }}</text>
                <text class="pdf-desc">{{ item.description }} · {{ formatSize(item.size) }}</text>
                <text class="pdf-meta">预览 {{ item.viewCount }} 次 · 下载 {{ item.downloadCount }} 次</text>
              </view>
            </view>
            <view class="pdf-actions">
              <u-button size="small" text="预览" @click="openPdf(item)" />
              <u-button size="small" type="primary" text="下载" @click="downloadPdf(item)" />
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.header-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22rpx;
  padding: 34rpx 30rpx;
}

.header-content {
  position: relative;
  z-index: 1;
  flex: 1;
  display: grid;
  gap: 8rpx;
}

.header-kicker {
  color: rgba(255, 255, 255, 0.76);
  font-size: 21rpx;
  font-weight: 900;
}

.page-title {
  color: #ffffff;
  font-size: 40rpx;
  font-weight: 800;
  line-height: 1.35;
}

.page-subtitle {
  color: rgba(255, 255, 255, 0.86);
  font-size: 26rpx;
  line-height: 1.6;
}

.header-stats {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  min-width: 124rpx;
  padding: 18rpx 14rpx;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.18);
  animation: softFloat 4.2s ease-in-out infinite;
}

.stat-number {
  color: #ffffff;
  font-size: 36rpx;
  font-weight: 800;
  line-height: 1.2;
}

.stat-label {
  color: rgba(255, 255, 255, 0.78);
  font-size: 22rpx;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
}

.metric-card {
  position: relative;
  overflow: hidden;
  min-height: 122rpx;
  padding: 20rpx 10rpx;
  border: 1px solid rgba(226, 232, 240, 0.94);
  border-radius: 8px;
  background: linear-gradient(180deg, #ffffff, #f8fafc);
  box-shadow: 0 10rpx 26rpx rgba(15, 23, 42, 0.06);
  text-align: center;
  box-sizing: border-box;
  animation: softRise 440ms ease-out both;
}

.metric-card::after {
  content: "";
  position: absolute;
  left: 18rpx;
  right: 18rpx;
  bottom: 0;
  height: 4rpx;
  background: linear-gradient(90deg, #2563eb, #14b8a6, #f59e0b);
}

.metric-value {
  display: block;
  color: #1d4ed8;
  font-size: 32rpx;
  font-weight: 800;
  line-height: 1.25;
}

.metric-label {
  display: block;
  margin-top: 8rpx;
  color: #64748b;
  font-size: 24rpx;
}

.filters {
  display: grid;
  gap: 18rpx;
}

.filter-head {
  display: grid;
  gap: 2rpx;
}

.empty-state {
  display: grid;
  gap: 14rpx;
}

.skeleton-list {
  display: grid;
  gap: 14rpx;
  margin-top: 8rpx;
}

.skeleton-line.wide {
  width: 92%;
}

.skeleton-line {
  width: 74%;
}

.skeleton-line.short {
  width: 48%;
}

.empty-title {
  color: #111827;
  font-size: 32rpx;
  font-weight: 800;
}

.year-list {
  display: grid;
  gap: 20rpx;
}

.year-card {
  display: grid;
  gap: 20rpx;
  animation: softRise 420ms ease-out both;
}

.year-card:nth-child(2n) {
  animation-delay: 80ms;
}

.year-card:nth-child(3n) {
  animation-delay: 140ms;
}

.year-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.year-title {
  color: #111827;
  font-size: 34rpx;
  font-weight: 800;
  line-height: 1.35;
}

.year-title-wrap {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.year-dot {
  width: 18rpx;
  height: 18rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #2563eb, #14b8a6);
  box-shadow: 0 0 0 8rpx rgba(37, 99, 235, 0.08);
}

.year-count {
  flex-shrink: 0;
  padding: 8rpx 16rpx;
  border-radius: 8px;
  color: #1d4ed8;
  background: #eff6ff;
  font-size: 22rpx;
  font-weight: 700;
}

.pdf-list {
  display: grid;
  gap: 14rpx;
}

.pdf-row {
  position: relative;
  overflow: hidden;
  display: grid;
  gap: 16rpx;
  padding: 22rpx 20rpx 20rpx;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 8px;
  background: linear-gradient(180deg, #ffffff, #f8fafc);
  box-shadow: 0 8rpx 22rpx rgba(15, 23, 42, 0.04);
  transition: transform 160ms ease, border-color 160ms ease;
}

.pdf-status-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 5rpx;
  background: linear-gradient(90deg, #2563eb, #14b8a6);
}

.pdf-status-line.answer {
  background: linear-gradient(90deg, #10b981, #f59e0b);
}

.pdf-row:active {
  transform: scale(0.99);
  border-color: rgba(37, 99, 235, 0.38);
}

.pdf-main {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
}

.pdf-text {
  flex: 1;
  display: grid;
  gap: 6rpx;
}

.pdf-title {
  color: #111827;
  font-size: 30rpx;
  font-weight: 800;
  line-height: 1.45;
}

.pdf-desc,
.pdf-meta {
  color: #64748b;
  font-size: 24rpx;
  line-height: 1.6;
}

.pdf-meta {
  color: #94a3b8;
}

.type-tag {
  flex-shrink: 0;
  padding: 8rpx 16rpx;
  border-radius: 8px;
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 800;
}

.type-tag.paper {
  background: linear-gradient(135deg, #2563eb, #14b8a6);
}

.type-tag.answer {
  background: linear-gradient(135deg, #10b981, #f59e0b);
}

.pdf-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
  padding-top: 2rpx;
}
</style>
