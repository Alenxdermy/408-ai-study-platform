<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '../../stores/auth';

const auth = useAuthStore();
const nickname = computed(() => String(auth.user?.nickname ?? '408 考生'));
const loginStatus = computed(() => auth.token ? '已登录' : '未登录');
const milestoneCards = [
  { title: '今日状态', value: '待学习' },
  { title: '资料进度', value: '34份' }
];

const login = async () => {
  await auth.ensureLogin();
  uni.showToast({ title: '登录成功', icon: 'success' });
};
</script>

<template>
  <view class="page">
    <view class="profile-card hero-shell section">
      <view class="avatar">
        <text>{{ nickname.slice(0, 1) }}</text>
      </view>
      <view class="profile-copy">
        <text class="profile-kicker">{{ loginStatus }}</text>
        <text class="profile-name">{{ nickname }}</text>
        <text class="profile-desc">学习统计、连续签到、成就系统</text>
      </view>
      <u-button v-if="!auth.token" size="small" type="primary" text="登录" @click="login" />
    </view>

    <view class="summary-grid section">
      <view class="summary-card soft-card">
        <text class="summary-value">0</text>
        <text class="summary-label">错题</text>
      </view>
      <view class="summary-card soft-card">
        <text class="summary-value">0</text>
        <text class="summary-label">收藏</text>
      </view>
      <view class="summary-card soft-card">
        <text class="summary-value">0</text>
        <text class="summary-label">成就</text>
      </view>
    </view>

    <view class="milestone-grid section">
      <view v-for="item in milestoneCards" :key="item.title" class="milestone-card soft-card">
        <text class="milestone-title">{{ item.title }}</text>
        <text class="milestone-value">{{ item.value }}</text>
      </view>
    </view>

    <view class="panel section">
      <text class="card-title list-title">学习资产</text>
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
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 34rpx 28rpx;
}

.avatar {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  flex: 0 0 104rpx;
  height: 104rpx;
  border: 1px solid rgba(255, 255, 255, 0.34);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.18);
  animation: softFloat 4.2s ease-in-out infinite;
}

.avatar text {
  color: #ffffff;
  font-size: 42rpx;
  font-weight: 900;
}

.profile-copy {
  position: relative;
  z-index: 1;
  flex: 1;
  display: grid;
  gap: 6rpx;
}

.profile-kicker {
  color: rgba(255, 255, 255, 0.76);
  font-size: 22rpx;
  font-weight: 900;
}

.profile-name {
  color: #ffffff;
  font-size: 40rpx;
  font-weight: 900;
  line-height: 1.25;
}

.profile-desc {
  color: rgba(255, 255, 255, 0.86);
  font-size: 25rpx;
  line-height: 1.45;
}

.profile-card :deep(.u-button) {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
}

.summary-card {
  min-height: 122rpx;
  padding: 20rpx 10rpx;
  text-align: center;
}

.summary-card::after {
  content: "";
  position: absolute;
  left: 18rpx;
  right: 18rpx;
  bottom: 0;
  height: 4rpx;
  background: linear-gradient(90deg, #2563eb, #14b8a6, #f59e0b);
}

.summary-value {
  display: block;
  color: #1d4ed8;
  font-size: 36rpx;
  font-weight: 900;
  line-height: 1.25;
}

.summary-label {
  display: block;
  margin-top: 8rpx;
  color: #64748b;
  font-size: 24rpx;
}

.milestone-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

.milestone-card {
  display: grid;
  gap: 10rpx;
  min-height: 118rpx;
  padding: 22rpx 20rpx;
}

.milestone-title {
  color: #64748b;
  font-size: 24rpx;
  font-weight: 700;
}

.milestone-value {
  color: #111827;
  font-size: 32rpx;
  font-weight: 900;
}

.list-title {
  padding: 0 28rpx;
}

.panel {
  padding: 24rpx 0 10rpx;
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
</style>
