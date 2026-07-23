<script setup lang="ts">
import { ref } from 'vue';
import { http } from '../../services/http';
import { useAuthStore } from '../../stores/auth';

const auth = useAuthStore();
const question = ref('');
const answer = ref('');
const loading = ref(false);

const promptTips = ['选项逐项解析', '考点定位', '易错点提醒'];

const askTeacher = async () => {
  if (!question.value.trim()) {
    uni.showToast({ title: '请输入题目或疑问', icon: 'none' });
    return;
  }

  loading.value = true;
  try {
    await auth.ensureLogin();
    const result = await http.post<{ content: string }>('/ai/agent/teacher', {
      payload: { question: question.value }
    });
    answer.value = result.content;
  } catch (error) {
    uni.showToast({ title: 'AI 服务暂不可用', icon: 'none' });
    console.warn(error);
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <view class="page">
    <view class="ai-hero hero-shell section">
      <view class="hero-copy">
        <text class="hero-kicker">AI TEACHER</text>
        <text class="hero-title">AI 讲题</text>
        <text class="hero-desc">粘贴 408 题目或输入疑问，按答案、解析、考点、易错点和建议输出。</text>
      </view>
      <view class="teacher-badge">
        <text class="badge-main">24h</text>
        <text class="badge-sub">答疑</text>
      </view>
    </view>

    <view class="panel section form">
      <view class="form-head">
        <text class="card-title">输入题目或知识点</text>
        <text class="muted">建议粘贴完整题干和选项，AI 解析会更稳定。</text>
      </view>
      <view class="tip-row">
        <text v-for="tip in promptTips" :key="tip" class="tip-pill">{{ tip }}</text>
      </view>
      <u-textarea v-model="question" placeholder="粘贴题目，或输入你卡住的知识点" height="180" />
      <u-button type="primary" :loading="loading" text="发送" @click="askTeacher" />
    </view>

    <view v-if="loading && !answer" class="panel answer waiting">
      <text class="loading-dot"></text>
      <text class="muted">AI 正在整理解析...</text>
      <view class="typing">
        <text></text>
        <text></text>
        <text></text>
      </view>
    </view>

    <view v-if="answer" class="panel answer">
      <text class="answer-title">解析结果</text>
      <text>{{ answer }}</text>
    </view>
  </view>
</template>

<style scoped>
.ai-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 22rpx;
  padding: 34rpx 30rpx;
}

.hero-copy {
  position: relative;
  z-index: 1;
  flex: 1;
  display: grid;
  gap: 10rpx;
}

.hero-kicker {
  color: rgba(255, 255, 255, 0.76);
  font-size: 21rpx;
  font-weight: 900;
}

.hero-title {
  color: #ffffff;
  font-size: 42rpx;
  font-weight: 900;
  line-height: 1.25;
}

.hero-desc {
  color: rgba(255, 255, 255, 0.86);
  font-size: 25rpx;
  line-height: 1.65;
}

.teacher-badge {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  flex: 0 0 118rpx;
  height: 118rpx;
  border: 1px solid rgba(255, 255, 255, 0.26);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.16);
  animation: softFloat 4s ease-in-out infinite;
}

.badge-main {
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 900;
  line-height: 1.1;
}

.badge-sub {
  color: rgba(255, 255, 255, 0.78);
  font-size: 21rpx;
}

.form {
  display: grid;
  gap: 18rpx;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.98));
}

.form-head {
  display: grid;
  gap: 2rpx;
}

.form :deep(.u-textarea) {
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px rgba(226, 232, 240, 0.7);
}

.tip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.tip-pill {
  padding: 8rpx 14rpx;
  border-radius: 8px;
  color: #1d4ed8;
  background: linear-gradient(135deg, #eff6ff, #ecfeff);
  font-size: 22rpx;
  font-weight: 800;
}

.answer {
  display: grid;
  gap: 16rpx;
  color: #334155;
  line-height: 1.75;
  white-space: pre-wrap;
  border-color: rgba(191, 219, 254, 0.78);
  background: linear-gradient(135deg, #ffffff 0%, #eff6ff 56%, #f0fdfa 100%);
}

.answer-title {
  color: #111827;
  font-size: 31rpx;
  font-weight: 900;
  line-height: 1.35;
}

.answer text {
  font-size: 28rpx;
}

.waiting {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.loading-dot {
  width: 18rpx;
  height: 18rpx;
  border-radius: 50%;
  background: #2563eb;
  animation: gentlePulse 1.2s ease-in-out infinite;
}

.typing {
  display: flex;
  gap: 7rpx;
  margin-left: auto;
}

.typing text {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: #2563eb;
  animation: gentlePulse 1.1s ease-in-out infinite;
}

.typing text:nth-child(2) {
  animation-delay: 160ms;
}

.typing text:nth-child(3) {
  animation-delay: 320ms;
}
</style>

