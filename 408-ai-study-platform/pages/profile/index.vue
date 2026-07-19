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
  gap: 16rpx;
}
</style>
