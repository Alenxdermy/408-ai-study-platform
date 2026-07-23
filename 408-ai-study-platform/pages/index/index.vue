<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useAuthStore } from '../../stores/auth';
import { useStudyStore } from '../../stores/study';

const auth = useAuthStore();
const study = useStudyStore();
const loading = ref(false);

const recentCount = computed(() => study.dashboard.recentRecords?.length ?? 0);
const nickname = computed(() => String(auth.user?.nickname ?? '408 考生'));

const statCards = computed(() => [
  { value: '10', label: '每日一练', tone: 'blue' },
  { value: '30min', label: '建议学习', tone: 'teal' },
  { value: String(recentCount.value), label: '近期记录', tone: 'amber' }
]);

const todaySteps = [
  { title: '基础刷题', desc: '完成今日练习，快速暴露薄弱知识点', index: '01' },
  { title: '真题阅读', desc: '查看 PDF 真题和答案，建立题感', index: '02' },
  { title: 'AI 复盘', desc: '把卡住的问题交给 AI 讲题整理', index: '03' }
];

const quickActions = [
  { title: '刷题训练', desc: '每日一练与自动解析', action: 'questions' },
  { title: '真题资料', desc: '2009-2025 PDF', action: 'resources' },
  { title: 'AI 讲题', desc: '答案、考点、易错点', action: 'ai' }
];

const focusCards = [
  { title: '资料入库', value: '34', desc: '真题与答案' },
  { title: '学习闭环', value: '3步', desc: '刷题-阅读-复盘' }
];

onMounted(async () => {
  loading.value = true;
  try {
    await auth.ensureLogin();
    await study.loadDashboard();
  } catch (error) {
    console.warn('首页数据加载失败', error);
  } finally {
    loading.value = false;
  }
});

const goQuestions = () => uni.switchTab({ url: '/pages/questions/index' });
const goResources = () => uni.switchTab({ url: '/pages/resources/index' });
const goAi = () => uni.switchTab({ url: '/pages/ai/index' });

const handleQuickAction = (action: string) => {
  if (action === 'questions') goQuestions();
  if (action === 'resources') goResources();
  if (action === 'ai') goAi();
};
</script>

<template>
  <view class="page">
    <view class="hero hero-shell section">
      <view class="hero-main">
        <text class="hero-kicker">408 AI STUDY</text>
        <text class="hero-title">今天从一个清晰计划开始</text>
        <text class="hero-subtitle">{{ nickname }}，按“刷题 - 真题 - AI复盘”完成今日学习闭环。</text>
      </view>
      <view class="hero-badge">
        <text class="badge-value">AI</text>
        <text class="badge-label">导师在线</text>
      </view>
      <view class="hero-footer">
        <view class="hero-progress">
          <text class="progress-label">今日建议进度</text>
          <view class="progress-track"><view class="progress-fill"></view></view>
        </view>
        <text class="progress-percent">68%</text>
      </view>
    </view>

    <view class="metrics section">
      <view v-for="item in statCards" :key="item.label" class="metric-card" :class="item.tone">
        <text class="metric">{{ item.value }}</text>
        <text class="metric-label">{{ item.label }}</text>
      </view>
    </view>

    <view class="panel section plan-panel">
      <view class="section-head">
        <view>
          <text class="eyebrow">TODAY</text>
          <text class="card-title">今日学习路径</text>
        </view>
        <text class="status-pill">{{ loading ? '同步中' : '已就绪' }}</text>
      </view>

      <view class="step-list">
        <view v-for="step in todaySteps" :key="step.index" class="step-item">
          <text class="step-index">{{ step.index }}</text>
          <view class="step-copy">
            <text class="step-title">{{ step.title }}</text>
            <text class="muted">{{ step.desc }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="quick-grid section">
      <view
        v-for="item in quickActions"
        :key="item.title"
        class="quick-card soft-card"
        @click="handleQuickAction(item.action)"
      >
        <text class="quick-title">{{ item.title }}</text>
        <text class="quick-desc">{{ item.desc }}</text>
      </view>
    </view>

    <view class="focus-grid section">
      <view v-for="item in focusCards" :key="item.title" class="focus-card soft-card">
        <text class="focus-value">{{ item.value }}</text>
        <view class="focus-copy">
          <text class="focus-title">{{ item.title }}</text>
          <text class="focus-desc">{{ item.desc }}</text>
        </view>
      </view>
    </view>

    <view class="panel section recommendation">
      <text class="eyebrow">AI RECOMMEND</text>
      <text class="card-title">没有题库也能推进</text>
      <text class="muted">先使用固定真题 PDF 进行阅读和下载，后续再从真题、讲义或章节资料中抽取结构化题库。</text>
    </view>

    <view class="button-row">
      <u-button type="primary" text="开始刷题" :loading="loading" @click="goQuestions" />
      <u-button text="打开 PDF 资料库" @click="goResources" />
      <u-button text="问 AI 导师" @click="goAi" />
    </view>
  </view>
</template>

<style scoped>
.hero {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 22rpx;
  flex-wrap: wrap;
  padding: 40rpx 30rpx 32rpx;
}

.hero-main {
  position: relative;
  z-index: 1;
  flex: 1;
  display: grid;
  gap: 12rpx;
}

.hero-kicker {
  color: rgba(255, 255, 255, 0.76);
  font-size: 22rpx;
  font-weight: 800;
  line-height: 1.2;
}

.hero-title {
  color: #ffffff;
  font-size: 46rpx;
  font-weight: 900;
  line-height: 1.25;
}

.hero-subtitle {
  color: rgba(255, 255, 255, 0.88);
  font-size: 27rpx;
  line-height: 1.65;
}

.hero-badge {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  flex: 0 0 132rpx;
  height: 132rpx;
  border: 1px solid rgba(255, 255, 255, 0.26);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.16);
  animation: softFloat 4s ease-in-out infinite;
}

.badge-value {
  color: #ffffff;
  font-size: 38rpx;
  font-weight: 900;
  line-height: 1.1;
}

.badge-label {
  color: rgba(255, 255, 255, 0.78);
  font-size: 21rpx;
}

.hero-footer {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 18rpx;
  width: 100%;
  margin-top: 6rpx;
  padding: 18rpx;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.13);
  box-sizing: border-box;
}

.hero-progress {
  flex: 1;
  display: grid;
  gap: 10rpx;
}

.progress-label {
  color: rgba(255, 255, 255, 0.82);
  font-size: 22rpx;
  font-weight: 700;
}

.progress-track {
  position: relative;
  overflow: hidden;
  height: 12rpx;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.22);
}

.progress-fill {
  position: relative;
  overflow: hidden;
  width: 68%;
  height: 100%;
  border-radius: 8px;
  background: linear-gradient(90deg, #ffffff, #ccfbf1);
}

.progress-fill::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  width: 36%;
  background: linear-gradient(90deg, transparent, rgba(37, 99, 235, 0.28), transparent);
  animation: progressSweep 2.4s ease-in-out infinite;
}

.progress-percent {
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 900;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
}

.metric-card {
  position: relative;
  min-height: 142rpx;
  padding: 22rpx 12rpx;
  border: 1px solid rgba(226, 232, 240, 0.94);
  border-radius: 8px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: 0 10rpx 26rpx rgba(15, 23, 42, 0.06);
  box-sizing: border-box;
  text-align: center;
  overflow: hidden;
  animation: softRise 460ms ease-out both;
}

.metric-card::after {
  content: "";
  position: absolute;
  left: 18rpx;
  right: 18rpx;
  bottom: 0;
  height: 4rpx;
  background: #2563eb;
}

.metric-card.teal::after {
  background: #14b8a6;
}

.metric-card.amber::after {
  background: #f59e0b;
}

.metric {
  display: block;
  color: #1d4ed8;
  font-size: 40rpx;
  font-weight: 900;
  line-height: 1.2;
}

.metric-label {
  display: block;
  margin-top: 10rpx;
  color: #64748b;
  font-size: 24rpx;
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.status-pill {
  flex-shrink: 0;
  padding: 8rpx 16rpx;
  border-radius: 8px;
  color: #0f766e;
  background: #ccfbf1;
  font-size: 22rpx;
  font-weight: 800;
}

.step-list {
  display: grid;
  gap: 14rpx;
}

.step-item {
  position: relative;
  overflow: hidden;
  display: flex;
  gap: 16rpx;
  padding: 18rpx;
  border-radius: 8px;
  background: linear-gradient(135deg, #f8fafc, #eff6ff);
}

.step-item::after {
  content: "";
  position: absolute;
  left: 45rpx;
  top: 78rpx;
  bottom: -10rpx;
  width: 2rpx;
  background: linear-gradient(180deg, rgba(37, 99, 235, 0.3), transparent);
}

.step-index {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 56rpx;
  height: 56rpx;
  border-radius: 8px;
  color: #ffffff;
  background: linear-gradient(135deg, #2563eb, #14b8a6);
  font-size: 22rpx;
  font-weight: 900;
}

.step-copy {
  flex: 1;
  display: grid;
  gap: 4rpx;
}

.step-title {
  color: #111827;
  font-size: 28rpx;
  font-weight: 800;
  line-height: 1.45;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
}

.quick-card {
  min-height: 156rpx;
  padding: 22rpx 16rpx;
}

.quick-card:active {
  transform: scale(0.99);
}

.quick-title {
  display: block;
  color: #111827;
  font-size: 27rpx;
  font-weight: 900;
  line-height: 1.35;
}

.quick-desc {
  display: block;
  margin-top: 10rpx;
  color: #64748b;
  font-size: 22rpx;
  line-height: 1.5;
}

.focus-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

.focus-card {
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-height: 128rpx;
  padding: 22rpx 18rpx;
}

.focus-value {
  display: grid;
  place-items: center;
  flex: 0 0 72rpx;
  height: 72rpx;
  border-radius: 8px;
  color: #ffffff;
  background: linear-gradient(135deg, #2563eb, #14b8a6);
  font-size: 27rpx;
  font-weight: 900;
}

.focus-copy {
  flex: 1;
  display: grid;
  gap: 4rpx;
}

.focus-title {
  color: #111827;
  font-size: 27rpx;
  font-weight: 900;
}

.focus-desc {
  color: #64748b;
  font-size: 22rpx;
}

.recommendation {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(239, 246, 255, 0.96), rgba(240, 253, 250, 0.9));
}
</style>
