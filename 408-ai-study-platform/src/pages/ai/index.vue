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
.form {
  display: grid;
  gap: 18rpx;
}

.answer {
  color: #344054;
  line-height: 1.7;
  white-space: pre-wrap;
}
</style>
