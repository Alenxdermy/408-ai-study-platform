<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useAuthStore } from '../../stores/auth';
import { useStudyStore } from '../../stores/study';
import { useCountUp, useRipple, useScrollReveal } from '../../composables/useMotion';

type AuthMode = 'login' | 'register';

const auth = useAuthStore();
const study = useStudyStore();
const mode = ref<AuthMode>('login');
const submitting = ref(false);
const savingTarget = ref(false);

const loginForm = reactive({
  phone: '',
  password: ''
});

const registerForm = reactive({
  phone: '',
  password: '',
  nickname: ''
});

const targetForm = reactive({
  targetScore: 120,
  examDate: ''
});

const statsSource = computed(() => auth.user?.stats ?? {
  totalQuestions: 0,
  correctQuestions: 0,
  studyMinutes: 0,
  streakDays: 0,
  lastCheckInAt: null
});

const totalQuestions = useCountUp(0, 750);
const correctQuestions = useCountUp(0, 750);
const studyMinutes = useCountUp(0, 750);

watch(statsSource, stats => {
  totalQuestions.run(stats.totalQuestions ?? 0);
  correctQuestions.run(stats.correctQuestions ?? 0);
  studyMinutes.run(stats.studyMinutes ?? 0);
}, { immediate: true, deep: true });

watch(() => auth.user, user => {
  targetForm.targetScore = Number(user?.targetScore ?? 120);
  targetForm.examDate = user?.examDate ? String(user.examDate).slice(0, 10) : '';
}, { immediate: true });

const nickname = computed(() => String(auth.user?.nickname ?? '408 考生'));
const phoneLabel = computed(() => {
  const phone = String(auth.user?.phone ?? '');
  if (!phone) return '暂未绑定手机号';
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
});
const loginStatus = computed(() => auth.isLoggedIn ? '已登录' : '未登录');
const targetScore = computed(() => auth.user?.targetScore ?? 120);
const examDate = computed(() => auth.user?.examDate ? String(auth.user?.examDate).slice(0, 10) : '未设置');
const streakDays = computed(() => auth.user?.stats?.streakDays ?? 0);
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

const milestoneCards = computed(() => [
  { title: '目标分数', value: `${targetScore.value}` },
  { title: '连续打卡', value: `${streakDays.value} 天` },
  { title: '考试日期', value: examDate.value }
]);

const summaryCards = computed(() => [
  { value: totalQuestions.current.value, label: '总刷题数' },
  { value: correctQuestions.current.value, label: '正确题数' },
  { value: `${studyMinutes.current.value}m`, label: '学习时长' }
]);
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

const switchMode = (nextMode: AuthMode, event?: MouseEvent | TouchEvent) => {
  if (event) useRipple(event, 'rgba(37, 99, 235, 0.16)');
  mode.value = nextMode;
};

const submitLogin = async (event?: MouseEvent | TouchEvent) => {
  if (event) useRipple(event);
  if (!loginForm.phone.trim() || !loginForm.password.trim()) {
    uni.showToast({ title: '请填写手机号和密码', icon: 'none' });
    return;
  }

  submitting.value = true;
  try {
    await auth.login({
      phone: loginForm.phone.trim(),
      password: loginForm.password
    });
    uni.showToast({ title: '登录成功', icon: 'success' });
  } catch (error) {
    uni.showToast({ title: (error as Error).message || '登录失败', icon: 'none' });
  } finally {
    submitting.value = false;
  }
};

const submitRegister = async (event?: MouseEvent | TouchEvent) => {
  if (event) useRipple(event);
  if (!registerForm.phone.trim() || !registerForm.password.trim() || !registerForm.nickname.trim()) {
    uni.showToast({ title: '请完整填写注册信息', icon: 'none' });
    return;
  }

  submitting.value = true;
  try {
    await auth.register({
      phone: registerForm.phone.trim(),
      password: registerForm.password,
      nickname: registerForm.nickname.trim()
    });
    uni.showToast({ title: '注册成功', icon: 'success' });
    mode.value = 'login';
  } catch (error) {
    uni.showToast({ title: (error as Error).message || '注册失败', icon: 'none' });
  } finally {
    submitting.value = false;
  }
};

const onExamDateChange = (event: { detail: { value: string } }) => {
  targetForm.examDate = event.detail.value;
};

const saveTarget = async (event?: MouseEvent | TouchEvent) => {
  if (event) useRipple(event);
  if (!auth.isLoggedIn) {
    uni.showToast({ title: '请先登录', icon: 'none' });
    return;
  }
  if (targetForm.targetScore < 1 || targetForm.targetScore > 150) {
    uni.showToast({ title: '目标分数需在 1-150 之间', icon: 'none' });
    return;
  }

  savingTarget.value = true;
  try {
    await auth.updateStudyTarget({
      targetScore: Number(targetForm.targetScore),
      examDate: targetForm.examDate || null
    });
    uni.showToast({ title: '目标已保存', icon: 'success' });
  } catch (error) {
    uni.showToast({ title: (error as Error).message || '保存失败', icon: 'none' });
  } finally {
    savingTarget.value = false;
  }
};

const signOut = (event?: MouseEvent | TouchEvent) => {
  if (event) useRipple(event);
  auth.logout();
  uni.showToast({ title: '已退出登录', icon: 'success' });
};

const refreshDashboard = async () => {
  if (!auth.token) return;
  const valid = await auth.ensureSession();
  if (valid) await study.loadDashboard();
};

onMounted(async () => {
  useScrollReveal();
  await refreshDashboard();
});

onShow(() => {
  void refreshDashboard();
});
</script>

<template>
  <view class="page profile-page">
    <view class="profile-card hero-shell section">
      <view class="avatar">
        <text>{{ nickname.slice(0, 1) }}</text>
      </view>
      <view class="profile-copy">
        <text class="profile-kicker">{{ loginStatus }}</text>
        <text class="profile-name">{{ nickname }}</text>
        <text class="profile-desc">{{ phoneLabel }} · 学习信息会保存在当前账号下。</text>
      </view>
      <view v-if="auth.isLoggedIn" class="profile-action">
        <u-button
          size="small"
          type="warning"
          text="退出"
          :custom-style="{ width: '116rpx', height: '58rpx', margin: '0', borderRadius: '8px' }"
          @click="signOut"
        />
      </view>
    </view>

    <view v-if="!auth.isLoggedIn" class="panel section auth-panel">
      <view class="auth-switch">
        <view class="auth-tab" :class="{ active: mode === 'login' }" @click="switchMode('login', $event)">
          <text>登录</text>
        </view>
        <view class="auth-tab" :class="{ active: mode === 'register' }" @click="switchMode('register', $event)">
          <text>注册</text>
        </view>
      </view>

      <view v-if="mode === 'login'" class="auth-form">
        <text class="card-title">登录账号</text>
        <input v-model="loginForm.phone" class="auth-input" type="number" maxlength="11" placeholder="手机号" />
        <input v-model="loginForm.password" class="auth-input" type="password" maxlength="32" placeholder="密码" />
        <u-button type="primary" :loading="submitting" text="登录" @click="submitLogin" />
      </view>

      <view v-else class="auth-form">
        <text class="card-title">创建账号</text>
        <input v-model="registerForm.nickname" class="auth-input" maxlength="32" placeholder="昵称" />
        <input v-model="registerForm.phone" class="auth-input" type="number" maxlength="11" placeholder="手机号" />
        <input v-model="registerForm.password" class="auth-input" type="password" maxlength="32" placeholder="密码（至少 6 位）" />
        <u-button type="primary" :loading="submitting" text="注册并登录" @click="submitRegister" />
      </view>
    </view>

    <view v-else class="panel section target-panel">
      <view class="section-head compact">
        <view class="target-title">
          <text class="eyebrow">TARGET</text>
          <text class="card-title">备考目标</text>
        </view>
        <view class="target-action">
          <u-button
            size="small"
            type="primary"
            :loading="savingTarget"
            text="保存"
            :custom-style="{ width: '132rpx', height: '58rpx', margin: '0', borderRadius: '8px' }"
            @click="saveTarget"
          />
        </view>
      </view>

      <view class="target-form">
        <view class="field-row">
          <text class="field-label">目标分数</text>
          <input v-model.number="targetForm.targetScore" class="target-input" type="number" maxlength="3" />
          <text class="field-suffix">分</text>
        </view>
        <picker mode="date" :value="targetForm.examDate" @change="onExamDateChange">
          <view class="field-row date-row">
            <text class="field-label">考试日期</text>
            <text class="date-value">{{ targetForm.examDate || '请选择日期' }}</text>
          </view>
        </picker>
      </view>
    </view>

    <view class="panel section dashboard-panel">
      <view class="section-head compact">
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
.profile-page {
  overflow: hidden;
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 34rpx 28rpx;
}

.avatar,
.profile-copy,
.profile-action {
  position: relative;
  z-index: 1;
}

.avatar {
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
  flex: 1;
  min-width: 0;
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

.profile-action {
  flex: 0 0 116rpx;
  width: 116rpx;
  min-width: 116rpx;
}

.profile-action :deep(.u-button),
.target-action :deep(.u-button) {
  width: 100% !important;
  min-width: 0 !important;
  padding: 0 !important;
  line-height: 1 !important;
}

.auth-panel,
.target-panel {
  display: grid;
  gap: 20rpx;
}

.auth-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
}

.auth-tab {
  min-height: 80rpx;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: #f8fafc;
  color: #64748b;
  font-size: 28rpx;
  font-weight: 800;
}

.auth-tab.active {
  color: #1d4ed8;
  background: linear-gradient(135deg, #eff6ff, #ecfeff);
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.16);
}

.auth-form,
.target-form {
  display: grid;
  gap: 14rpx;
}

.auth-input,
.target-input {
  width: 100%;
  height: 88rpx;
  padding: 0 22rpx;
  box-sizing: border-box;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 8px;
  background: #ffffff;
  color: #111827;
  font-size: 28rpx;
}

.field-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  min-height: 92rpx;
  padding: 0 20rpx;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 8px;
  background: #ffffff;
  box-sizing: border-box;
}

.target-input {
  flex: 1;
  height: 72rpx;
  padding: 0;
  border: 0;
  text-align: right;
  font-weight: 900;
}

.field-label {
  flex: 0 0 150rpx;
  color: #64748b;
  font-size: 26rpx;
  font-weight: 800;
}

.field-suffix,
.date-value {
  color: #111827;
  font-size: 28rpx;
  font-weight: 900;
}

.date-row {
  justify-content: space-between;
}

.section-head.compact {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.target-title {
  flex: 1;
  min-width: 0;
}

.target-title .card-title {
  margin-bottom: 0;
  white-space: nowrap;
}

.target-action {
  flex: 0 0 132rpx;
  width: 132rpx;
  min-width: 132rpx;
}

.dashboard-panel {
  display: grid;
  gap: 22rpx;
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
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.06);
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

.pie-sub {
  color: #64748b;
  font-size: 21rpx;
}

.legend {
  display: grid;
  gap: 8rpx;
  color: #64748b;
  font-size: 22rpx;
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

.dashboard-label,
.dashboard-desc {
  color: #64748b;
  font-size: 22rpx;
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
  .profile-card {
    align-items: center;
    gap: 16rpx;
    padding: 30rpx 22rpx;
  }

  .profile-action {
    flex-basis: 104rpx;
    width: 104rpx;
    min-width: 104rpx;
  }

  .dashboard-body,
  .subject-list {
    grid-template-columns: 1fr;
  }
}
</style>
