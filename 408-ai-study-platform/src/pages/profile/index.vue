<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '../../stores/auth';

const auth = useAuthStore();
const nickname = computed(() => String(auth.user?.nickname ?? '408 考生'));

const login = async () => {
  await auth.ensureLogin();
  uni.showToast({ title: '登录成功', icon: 'success' });
};
</script>

<template>
  <view class="page">
    <view class="panel section profile-card">
      <text class="title">{{ nickname }}</text>
      <text class="muted">学习统计、连续签到、成就系统</text>
      <u-button v-if="!auth.token" size="small" type="primary" text="登录" @click="login" />
    </view>

    <view class="panel">
      <u-cell-group>
        <u-cell title="学习报告" value="待生成" />
        <u-cell title="错题本" value="0 题" />
        <u-cell title="收藏夹" value="0 题" />
      </u-cell-group>
    </view>
  </view>
</template>

<style scoped>
.profile-card {
  display: grid;
  gap: 18rpx;
  padding: 34rpx 28rpx;
  border-color: rgba(191, 219, 254, 0.76);
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.95), rgba(20, 184, 166, 0.9), rgba(245, 158, 11, 0.78)),
    #2563eb;
  background-size: 190% 190%;
  box-shadow: 0 18rpx 42rpx rgba(37, 99, 235, 0.16);
  animation: heroGradient 10s ease-in-out infinite;
}

.profile-card .title,
.profile-card .muted {
  color: #ffffff;
}

.profile-card .muted {
  color: rgba(255, 255, 255, 0.86);
}

.panel:not(.profile-card) {
  padding: 10rpx 0;
}

.panel :deep(.u-cell) {
  background: transparent;
}

.panel :deep(.u-cell__body) {
  padding: 26rpx 28rpx;
}

.panel :deep(.u-cell__title-text) {
  color: #111827;
  font-weight: 700;
}

.panel :deep(.u-cell__value) {
  color: #2563eb;
  font-weight: 700;
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

