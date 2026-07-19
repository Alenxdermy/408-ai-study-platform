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
  padding: 34rpx 0 10rpx;
}

.subtitle {
  display: block;
  margin-top: 12rpx;
  color: #344054;
  font-size: 28rpx;
  line-height: 1.6;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
}

.metric-card {
  min-height: 132rpx;
  padding: 20rpx 12rpx;
  border: 1px solid #e5e9f2;
  border-radius: 8px;
  background: #ffffff;
  box-sizing: border-box;
  text-align: center;
}

.metric {
  display: block;
  color: #2563eb;
  font-size: 40rpx;
  font-weight: 700;
  line-height: 1.2;
}

.card-title {
  display: block;
  margin-bottom: 12rpx;
  color: #182033;
  font-size: 30rpx;
  font-weight: 700;
}
</style>
