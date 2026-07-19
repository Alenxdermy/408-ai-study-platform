<script setup lang="ts">
import { computed, ref } from 'vue';
import { http } from '../../services/http';
import { useAuthStore } from '../../stores/auth';

interface QuestionOption {
  key: string;
  content: string;
}

interface QuestionItem {
  _id: string;
  type: 'single' | 'multiple' | 'judge' | 'blank' | 'essay';
  stem: string;
  options: QuestionOption[];
  tags?: string[];
  source?: string;
}

interface AnswerResult {
  isCorrect: boolean;
  answer: string | string[];
  explanation: string;
  source?: string;
  tags?: string[];
}

const auth = useAuthStore();
const questions = ref<QuestionItem[]>([]);
const loading = ref(false);
const submitting = ref(false);
const currentIndex = ref(0);
const selected = ref<string[]>([]);
const result = ref<AnswerResult | null>(null);
const favorited = ref(false);

const currentQuestion = computed(() => questions.value[currentIndex.value]);
const progressText = computed(() => questions.value.length ? `${currentIndex.value + 1}/${questions.value.length}` : '0/0');
const canSubmit = computed(() => Boolean(currentQuestion.value && selected.value.length));

const resetAnswerState = () => {
  selected.value = [];
  result.value = null;
  favorited.value = false;
};

const loadDaily = async () => {
  loading.value = true;
  try {
    await auth.ensureLogin();
    questions.value = await http.get<QuestionItem[]>('/questions/daily');
    currentIndex.value = 0;
    resetAnswerState();
  } catch (error) {
    uni.showToast({ title: '题目加载失败', icon: 'none' });
    console.warn(error);
  } finally {
    loading.value = false;
  }
};

const chooseOption = (key: string) => {
  if (result.value || !currentQuestion.value) return;

  if (currentQuestion.value.type === 'multiple') {
    selected.value = selected.value.includes(key)
      ? selected.value.filter(item => item !== key)
      : [...selected.value, key];
    return;
  }

  selected.value = [key];
};

const submitAnswer = async () => {
  if (!currentQuestion.value || !canSubmit.value) return;

  submitting.value = true;
  try {
    const answer = currentQuestion.value.type === 'multiple' ? selected.value : selected.value[0];
    result.value = await http.post<AnswerResult>(`/questions/${currentQuestion.value._id}/answer`, { answer });
  } catch (error) {
    uni.showToast({ title: '提交失败', icon: 'none' });
    console.warn(error);
  } finally {
    submitting.value = false;
  }
};

const toggleFavorite = async () => {
  if (!currentQuestion.value) return;

  try {
    const data = await http.post<{ favorited: boolean }>(`/questions/${currentQuestion.value._id}/favorite`);
    favorited.value = data.favorited;
    uni.showToast({ title: data.favorited ? '已收藏' : '已取消', icon: 'success' });
  } catch (error) {
    uni.showToast({ title: '收藏失败', icon: 'none' });
    console.warn(error);
  }
};

const nextQuestion = () => {
  currentIndex.value = currentIndex.value < questions.value.length - 1 ? currentIndex.value + 1 : 0;
  resetAnswerState();
};

void loadDaily();
</script>

<template>
  <view class="page">
    <view class="section header-row">
      <view>
        <text class="title">刷题训练</text>
        <text class="muted">每日一练、随机训练、错题回收</text>
      </view>
      <text class="progress">{{ progressText }}</text>
    </view>

    <view v-if="loading" class="panel">
      <text class="muted">加载中...</text>
    </view>

    <view v-else-if="!currentQuestion" class="panel empty">
      <text class="empty-title">暂时没有题目</text>
      <text class="muted">你还没有题库。先在资料库上传 PDF，沉淀教材、讲义和真题解析，后续再生成结构化题库。</text>
      <u-button text="重新加载" @click="loadDaily" />
    </view>

    <view v-else class="panel section">
      <view class="question-meta">
        <text class="tag">{{ currentQuestion.type === 'multiple' ? '多选题' : '单选题' }}</text>
        <text class="source">{{ currentQuestion.source || '408 题库' }}</text>
      </view>

      <text class="stem">{{ currentQuestion.stem }}</text>

      <view
        v-for="option in currentQuestion.options"
        :key="option.key"
        class="option"
        :class="{ selected: selected.includes(option.key), disabled: Boolean(result) }"
        @click="chooseOption(option.key)"
      >
        <text class="option-key">{{ option.key }}</text>
        <text class="option-text">{{ option.content }}</text>
      </view>

      <view class="actions">
        <u-button type="primary" :disabled="!canSubmit || Boolean(result)" :loading="submitting" text="提交答案" @click="submitAnswer" />
        <u-button :text="favorited ? '已收藏' : '收藏'" @click="toggleFavorite" />
      </view>

      <view v-if="result" class="analysis">
        <text class="result" :class="{ wrong: !result.isCorrect }">{{ result.isCorrect ? '回答正确' : '回答错误' }}</text>
        <text class="muted">正确答案：{{ Array.isArray(result.answer) ? result.answer.join('、') : result.answer }}</text>
        <text class="analysis-title">解析</text>
        <text class="analysis-text">{{ result.explanation || '暂无解析' }}</text>
        <u-button text="下一题" @click="nextQuestion" />
      </view>
    </view>
  </view>
</template>

<style scoped>
.header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
}

.progress {
  min-width: 88rpx;
  color: #2563eb;
  font-size: 28rpx;
  font-weight: 700;
  line-height: 1.4;
  text-align: right;
}

.question-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18rpx;
}

.tag {
  padding: 6rpx 14rpx;
  border-radius: 6px;
  background: #e8f0ff;
  color: #1d4ed8;
  font-size: 24rpx;
}

.source {
  color: #667085;
  font-size: 24rpx;
}

.stem {
  display: block;
  margin-bottom: 18rpx;
  color: #182033;
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.7;
}

.option {
  display: flex;
  gap: 18rpx;
  align-items: flex-start;
  min-height: 76rpx;
  padding: 18rpx;
  border: 1px solid #edf0f5;
  border-radius: 8px;
  margin-bottom: 14rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.option.selected {
  border-color: #2563eb;
  background: #eff6ff;
}

.option.disabled {
  opacity: 0.82;
}

.option-key {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 42rpx;
  height: 42rpx;
  border-radius: 50%;
  background: #edf0f5;
  color: #344054;
  font-weight: 700;
}

.option.selected .option-key {
  background: #2563eb;
  color: #ffffff;
}

.option-text {
  flex: 1;
  color: #344054;
  line-height: 1.6;
}

.actions {
  display: grid;
  grid-template-columns: 1fr 160rpx;
  gap: 16rpx;
  margin-top: 20rpx;
}

.analysis {
  display: grid;
  gap: 12rpx;
  margin-top: 24rpx;
  padding-top: 24rpx;
  border-top: 1px solid #edf0f5;
}

.result {
  color: #15803d;
  font-size: 32rpx;
  font-weight: 700;
}

.result.wrong {
  color: #dc2626;
}

.analysis-title {
  color: #182033;
  font-weight: 700;
}

.analysis-text {
  color: #344054;
  line-height: 1.7;
}

.empty {
  display: grid;
  gap: 20rpx;
}

.empty-title {
  color: #182033;
  font-size: 32rpx;
  font-weight: 700;
}
</style>
