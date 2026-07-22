<script setup lang="ts">
import { ref } from 'vue';
import { http } from '../../services/http';
import { useAuthStore } from '../../stores/auth';

const auth = useAuthStore();
const question = ref('');
const answer = ref('');
const loading = ref(false);

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
    <view class="section">
      <text class="title">AI 讲题</text>
      <text class="muted">粘贴 408 题目或输入疑问，AI 会按答案、选项解析、考点、易错点和建议输出。</text>
    </view>

    <view class="panel section form">
      <u-textarea v-model="question" placeholder="粘贴题目，或输入你卡住的知识点" height="180" />
      <u-button type="primary" :loading="loading" text="发送" @click="askTeacher" />
    </view>

    <view v-if="answer" class="panel answer">
      <text>{{ answer }}</text>
    </view>
  </view>
</template>

<style scoped>
.section:first-child {
  padding: 30rpx;
  border-radius: 8px;
  border: 1px solid rgba(191, 219, 254, 0.76);
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.94), rgba(20, 184, 166, 0.88), rgba(245, 158, 11, 0.78)),
    #2563eb;
  background-size: 190% 190%;
  box-shadow: 0 18rpx 42rpx rgba(37, 99, 235, 0.16);
  animation: heroGradient 10s ease-in-out infinite;
}

.section:first-child .title,
.section:first-child .muted {
  color: #ffffff;
}

.section:first-child .muted {
  margin-top: 12rpx;
  color: rgba(255, 255, 255, 0.86);
}

.form {
  display: grid;
  gap: 18rpx;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.98));
}

.form :deep(.u-textarea) {
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px rgba(226, 232, 240, 0.7);
}

.answer {
  color: #334155;
  line-height: 1.75;
  white-space: pre-wrap;
  border-color: rgba(191, 219, 254, 0.78);
  background: linear-gradient(135deg, #ffffff 0%, #eff6ff 56%, #f0fdfa 100%);
}

.answer text {
  font-size: 28rpx;
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

