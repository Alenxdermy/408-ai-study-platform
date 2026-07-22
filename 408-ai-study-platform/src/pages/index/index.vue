<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useAuthStore } from '../../stores/auth';
import { useStudyStore } from '../../stores/study';

const auth = useAuthStore();
const study = useStudyStore();
const loading = ref(false);

const recentCount = computed(() => study.dashboard.recentRecords?.length ?? 0);

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
</script>

<template>
  <view class="page">
    <view class="hero section">
      <text class="title">408 AI 导师</text>
      <text class="subtitle">AI + 刷题 + PDF 资料库 + 学习规划</text>
    </view>

    <view class="metrics section">
      <view class="metric-card">
        <text class="metric">10</text>
        <text class="muted">每日一练</text>
      </view>
      <view class="metric-card">
        <text class="metric">30min</text>
        <text class="muted">建议学习</text>
      </view>
      <view class="metric-card">
        <text class="metric">{{ recentCount }}</text>
        <text class="muted">近期记录</text>
      </view>
    </view>

    <view class="panel section">
      <text class="card-title">今日计划</text>
      <text class="muted">先完成基础刷题，再阅读 PDF 资料，最后用 AI 讲题整理易错点。</text>
    </view>

    <view class="panel section">
      <text class="card-title">AI 推荐</text>
      <text class="muted">没有题库时，先上传教材章节、讲义或真题 PDF，建立资料库后再逐步生成题库。</text>
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
  overflow: hidden;
  padding: 42rpx 28rpx 34rpx;
  border: 1px solid rgba(191, 219, 254, 0.86);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.95), rgba(20, 184, 166, 0.88) 58%, rgba(245, 158, 11, 0.82)),
    #2563eb;
  background-size: 180% 180%;
  box-shadow: 0 18rpx 42rpx rgba(37, 99, 235, 0.18);
  animation: heroGradient 9s ease-in-out infinite, softRise 360ms ease-out both;
}

.hero::after {
  content: "";
  position: absolute;
  left: 28rpx;
  right: 28rpx;
  bottom: 0;
  height: 4rpx;
  background: rgba(255, 255, 255, 0.55);
  animation: gentlePulse 2.6s ease-in-out infinite;
}

.hero .title,
.hero .subtitle {
  position: relative;
  z-index: 1;
  color: #ffffff;
}

.hero .title {
  font-size: 46rpx;
  text-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.16);
}

.subtitle {
  display: block;
  margin-top: 14rpx;
  color: rgba(255, 255, 255, 0.88);
  font-size: 28rpx;
  line-height: 1.6;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
}

.metric-card {
  position: relative;
  min-height: 144rpx;
  padding: 22rpx 12rpx;
  border: 1px solid rgba(226, 232, 240, 0.94);
  border-radius: 8px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: 0 10rpx 26rpx rgba(15, 23, 42, 0.06);
  box-sizing: border-box;
  text-align: center;
  overflow: hidden;
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

.metric {
  display: block;
  color: #1d4ed8;
  font-size: 42rpx;
  font-weight: 800;
  line-height: 1.2;
}

.card-title {
  display: block;
  margin-bottom: 12rpx;
  color: #111827;
  font-size: 31rpx;
  font-weight: 800;
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

