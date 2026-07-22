<script setup lang="ts">
import { computed, ref } from 'vue';
import { API_BASE_URL } from '../../services/http';

type FixedPdfKind = 'paper' | 'answer';

interface FixedPdfResource {
  id: string;
  year: string;
  kind: FixedPdfKind;
  title: string;
  description: string;
  group: 'papers-rebuild' | 'answers';
  fileName: string;
  size: number;
}

interface YearResourceGroup {
  year: string;
  items: FixedPdfResource[];
}

const keyword = ref('');
const category = ref('all');

const categoryOptions = [
  { name: '全部', value: 'all' },
  { name: '真题', value: 'paper' },
  { name: '答案', value: 'answer' }
];

const paperSizes: Record<string, number> = {
  '2009': 863836,
  '2010': 891051,
  '2011': 1044010,
  '2012': 860387,
  '2013': 1013658,
  '2014': 925216,
  '2015': 1093642,
  '2016': 1024044,
  '2017': 1153304,
  '2018': 1838144,
  '2019': 879667,
  '2020': 1293589,
  '2021': 866184,
  '2022': 1183597,
  '2023': 853848,
  '2024': 844959,
  '2025': 1053731
};

const answerSizes: Record<string, number> = {
  '2009': 2174705,
  '2010': 2212145,
  '2011': 2502317,
  '2012': 2339464,
  '2013': 2070543,
  '2014': 3007989,
  '2015': 1617182,
  '2016': 2374710,
  '2017': 1897944,
  '2018': 1732559,
  '2019': 2793294,
  '2020': 7242234,
  '2021': 8133056,
  '2022': 2065590,
  '2023': 533731,
  '2024': 1232336,
  '2025': 1248632
};

const years = Object.keys(paperSizes).sort((a, b) => b.localeCompare(a));

const resources: FixedPdfResource[] = years.flatMap(year => [
  {
    id: `${year}-paper`,
    year,
    kind: 'paper',
    title: `${year} 年真题`,
    description: `408 ${year} 年统考真题 PDF`,
    group: 'papers-rebuild',
    fileName: `${year}.pdf`,
    size: paperSizes[year]
  },
  {
    id: `${year}-answer`,
    year,
    kind: 'answer',
    title: `${year} 年答案`,
    description: `408 ${year} 年真题答案与解析 PDF`,
    group: 'answers',
    fileName: `${year}-answer.pdf`,
    size: answerSizes[year]
  }
]);

const filteredYearGroups = computed<YearResourceGroup[]>(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase();

  return years
    .map(year => {
      const items = resources.filter(item => {
        const matchKeyword = !normalizedKeyword
          || item.title.toLowerCase().includes(normalizedKeyword)
          || item.description.toLowerCase().includes(normalizedKeyword)
          || item.fileName.toLowerCase().includes(normalizedKeyword)
          || item.year.includes(normalizedKeyword);
        const matchCategory = category.value === 'all' || item.kind === category.value;
        return item.year === year && matchKeyword && matchCategory;
      });

      return { year, items };
    })
    .filter(group => group.items.length > 0);
});

const paperCount = computed(() => resources.filter(item => item.kind === 'paper').length);
const answerCount = computed(() => resources.filter(item => item.kind === 'answer').length);
const visibleCount = computed(() => filteredYearGroups.value.reduce((total, group) => total + group.items.length, 0));

const formatSize = (size: number) => {
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)}KB`;
  return `${(size / 1024 / 1024).toFixed(1)}MB`;
};

const getTypeLabel = (kind: FixedPdfKind) => kind === 'paper' ? '真题' : '答案';

const getTypeClass = (kind: FixedPdfKind) => kind === 'paper' ? 'paper' : 'answer';

const buildPdfUrl = (item: FixedPdfResource, action: 'preview' | 'download') => {
  const group = encodeURIComponent(item.group);
  const fileName = encodeURIComponent(item.fileName);
  return `${API_BASE_URL}/resources/static-pdfs/${group}/${fileName}/${action}`;
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

const openPdf = (item: FixedPdfResource) => {
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
    },
    fail: error => {
      uni.hideLoading();
      uni.showToast({ title: getNetworkErrorMessage(error), icon: 'none' });
      console.warn('downloadFile preview failed', { url, error });
    }
  });
  // #endif
};

const downloadPdf = (item: FixedPdfResource) => {
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
    <view class="header-section section">
      <view class="header-content">
        <text class="page-title">408 真题资料库</text>
        <text class="page-subtitle">固定收录 2009-2025 年真题与答案，支持预览和下载</text>
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
      <u-search v-model="keyword" placeholder="搜索年份、真题、答案" :show-action="false" />
      <u-subsection :list="categoryOptions" key-name="name" mode="subsection" @change="changeCategory" />
    </view>

    <view v-if="!filteredYearGroups.length" class="panel empty-state">
      <text class="empty-title">暂无符合条件的资料</text>
      <text class="muted">请调整搜索词或资料类型。</text>
    </view>

    <view v-else class="year-list">
      <view v-for="group in filteredYearGroups" :key="group.year" class="panel year-card">
        <view class="year-header">
          <text class="year-title">{{ group.year }} 年</text>
          <text class="year-count">{{ group.items.length }} 份资料</text>
        </view>

        <view class="pdf-list">
          <view v-for="item in group.items" :key="item.id" class="pdf-row">
            <view class="pdf-main">
              <text class="type-tag" :class="getTypeClass(item.kind)">{{ getTypeLabel(item.kind) }}</text>
              <view class="pdf-text">
                <text class="pdf-title">{{ item.title }}</text>
                <text class="pdf-desc">{{ item.description }} · {{ formatSize(item.size) }}</text>
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
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22rpx;
  padding: 34rpx 30rpx;
  border: 1px solid rgba(191, 219, 254, 0.72);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.96), rgba(20, 184, 166, 0.9) 58%, rgba(245, 158, 11, 0.84)),
    #2563eb;
  background-size: 190% 190%;
  box-shadow: 0 18rpx 42rpx rgba(37, 99, 235, 0.16);
  animation: heroGradient 10s ease-in-out infinite;
}

.header-content {
  flex: 1;
  display: grid;
  gap: 8rpx;
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
  display: grid;
  place-items: center;
  min-width: 124rpx;
  padding: 18rpx 14rpx;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.18);
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
  min-height: 122rpx;
  padding: 20rpx 10rpx;
  border: 1px solid rgba(226, 232, 240, 0.94);
  border-radius: 8px;
  background: linear-gradient(180deg, #ffffff, #f8fafc);
  box-shadow: 0 10rpx 26rpx rgba(15, 23, 42, 0.06);
  text-align: center;
  box-sizing: border-box;
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

.empty-state {
  display: grid;
  gap: 14rpx;
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
  display: grid;
  gap: 16rpx;
  padding: 20rpx;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 8px;
  background: linear-gradient(180deg, #ffffff, #f8fafc);
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

.pdf-desc {
  color: #64748b;
  font-size: 24rpx;
  line-height: 1.6;
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
}

@keyframes heroGradient {
  0%, 100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}
</style>

