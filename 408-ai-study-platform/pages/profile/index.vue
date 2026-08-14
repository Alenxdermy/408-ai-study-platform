<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useAuthStore } from '../../stores/auth';
import { useStudyStore } from '../../stores/study';

const auth = useAuthStore();
const study = useStudyStore();
const nickname = computed(() => String(auth.user?.nickname ?? '408 考生'));
const loginStatus = computed(() => auth.token ? '已登录' : '未登录');
const studyStats = computed(() => study.dashboard.studyStats ?? {
  wrongBookCount: 0,
  favoriteCount: 0,
  totalAnswered: 0,
  correctAnswered: 0,
  accuracy: 0,
  weakSubjects: [],
  favoriteSubjects: [],
  report: '还没有作答记录。建议先完成每日一练，系统会自动生成薄弱科目和学习报告。'
});
const wrongBookCount = computed(() => studyStats.value.wrongBookCount ?? 0);
const favoriteCount = computed(() => studyStats.value.favoriteCount ?? 0);
const totalAnswered = computed(() => studyStats.value.totalAnswered ?? 0);
const accuracy = computed(() => studyStats.value.accuracy ?? 0);
const weakSubjects = computed(() => studyStats.value.weakSubjects ?? []);
const favoriteSubjects = computed(() => studyStats.value.favoriteSubjects ?? []);
const weakestSubject = computed(() => weakSubjects.value[0]?.label ?? '暂无');
const reportText = computed(() => studyStats.value.report);
const dashboardCards = computed(() => [
  { label: '错题', value: wrongBookCount.value, desc: '未掌握' },
  { label: '收藏', value: favoriteCount.value, desc: '已收藏' },
  { label: '正确率', value: `${accuracy.value}%`, desc: `${totalAnswered.value} 次作答` },
  { label: '薄弱科目', value: weakestSubject.value, desc: '优先复盘' }
]);
const chartStyle = computed(() => {
  const wrong = wrongBookCount.value;
  const favorite = favoriteCount.value;
  const correct = studyStats.value.correctAnswered ?? 0;
  const total = Math.max(wrong + favorite + correct, 1);
  const wrongDeg = Math.round((wrong / total) * 360);
  const favoriteDeg = wrongDeg + Math.round((favorite / total) * 360);
  return {
    background: `conic-gradient(#dc2626 0deg ${wrongDeg}deg, #2563eb ${wrongDeg}deg ${favoriteDeg}deg, #16a34a ${favoriteDeg}deg 360deg)`
  };
});

const login = async () => {
  await auth.ensureLogin();
  await study.loadDashboard();
  uni.showToast({ title: '登录成功', icon: 'success' });
};

const refreshDashboard = async () => {
  if (auth.token) await study.loadDashboard();
};

onMounted(async () => {
  await refreshDashboard();
});

onShow(() => {
  void refreshDashboard();
});
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

    <view class="panel section dashboard-panel">
      <view class="panel-head">
        <view>
          <text class="eyebrow">DASHBOARD</text>
          <text class="card-title">用户看板</text>
        </view>
        <text class="status-pill">{{ loginStatus }}</text>
      </view>

      <view class="dashboard-body">
        <view class="pie-wrap">
          <view class="pie-chart" :style="chartStyle">
            <view class="pie-hole">
              <text class="pie-main">{{ accuracy }}%</text>
              <text class="pie-sub">正确率</text>
            </view>
          </view>
          <view class="legend">
            <text><text class="dot red"></text>错题 {{ wrongBookCount }}</text>
            <text><text class="dot blue"></text>收藏 {{ favoriteCount }}</text>
            <text><text class="dot green"></text>正确 {{ studyStats.correctAnswered }}</text>
          </view>
        </view>

        <view class="dashboard-grid">
          <view v-for="item in dashboardCards" :key="item.label" class="dashboard-card">
            <text class="dashboard-label">{{ item.label }}</text>
            <text class="dashboard-value">{{ item.value }}</text>
            <text class="dashboard-desc">{{ item.desc }}</text>
          </view>
        </view>
      </view>

      <view class="report-box">
        <text class="report-title">学习报告</text>
        <text class="report-text">{{ reportText }}</text>
      </view>

      <view class="subject-list">
        <view class="subject-column">
          <text class="subject-title">薄弱科目</text>
          <text v-if="!weakSubjects.length" class="muted">暂无错题数据</text>
          <view v-for="item in weakSubjects" :key="item.subject" class="subject-row">
            <text>{{ item.label }}</text>
            <text>{{ item.count }} 题</text>
          </view>
        </view>
        <view class="subject-column">
          <text class="subject-title">收藏分布</text>
          <text v-if="!favoriteSubjects.length" class="muted">暂无收藏数据</text>
          <view v-for="item in favoriteSubjects" :key="item.subject" class="subject-row">
            <text>{{ item.label }}</text>
            <text>{{ item.count }} 题</text>
          </view>
        </view>
      </view>
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

.dashboard-panel {
  display: grid;
  gap: 22rpx;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.status-pill {
  flex-shrink: 0;
  padding: 8rpx 16rpx;
  border-radius: 8px;
  color: #1d4ed8;
  background: #eff6ff;
  font-size: 23rpx;
  font-weight: 800;
}

.dashboard-body {
  display: grid;
  grid-template-columns: 240rpx 1fr;
  gap: 22rpx;
  align-items: center;
}

.pie-wrap {
  display: grid;
  justify-items: center;
  gap: 14rpx;
}

.pie-chart {
  display: grid;
  place-items: center;
  width: 210rpx;
  height: 210rpx;
  border-radius: 50%;
}

.pie-hole {
  display: grid;
  place-items: center;
  width: 122rpx;
  height: 122rpx;
  border-radius: 50%;
  background: #ffffff;
}

.pie-main {
  color: #111827;
  font-size: 34rpx;
  font-weight: 900;
}

.pie-sub,
.legend,
.dashboard-label,
.dashboard-desc {
  color: #64748b;
  font-size: 22rpx;
}

.legend {
  display: grid;
  gap: 8rpx;
}

.dot {
  display: inline-block;
  width: 14rpx;
  height: 14rpx;
  margin-right: 8rpx;
  border-radius: 50%;
}

.dot.red { background: #dc2626; }
.dot.blue { background: #2563eb; }
.dot.green { background: #16a34a; }

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14rpx;
}

.dashboard-card {
  display: grid;
  gap: 7rpx;
  min-height: 126rpx;
  padding: 18rpx;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.dashboard-value {
  color: #111827;
  font-size: 30rpx;
  font-weight: 900;
  line-height: 1.25;
  word-break: break-all;
}

.report-box {
  display: grid;
  gap: 10rpx;
  padding: 20rpx;
  border-radius: 8px;
  background: #f8fafc;
}

.report-title,
.subject-title {
  color: #111827;
  font-size: 26rpx;
  font-weight: 900;
}

.report-text {
  color: #334155;
  font-size: 25rpx;
  line-height: 1.65;
}

.subject-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

.subject-column {
  display: grid;
  gap: 10rpx;
}

.subject-row {
  display: flex;
  justify-content: space-between;
  gap: 12rpx;
  padding: 14rpx 0;
  border-bottom: 1px solid #e2e8f0;
  color: #334155;
  font-size: 24rpx;
}

@media screen and (max-width: 360px) {
  .dashboard-body,
  .subject-list {
    grid-template-columns: 1fr;
  }
}
</style>
