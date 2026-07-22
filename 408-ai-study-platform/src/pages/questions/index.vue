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
    <view class="header-row hero-shell section">
      <view class="header-copy">
        <text class="header-kicker">QUESTION PRACTICE</text>
        <text class="header-title">刷题训练</text>
        <text class="header-desc">每日一练、自动评分、收藏回看，先把薄弱点暴露出来。</text>
      </view>
      <text class="progress">{{ progressText }}</text>
    </view>

    <view class="mode-strip section">
      <view class="mode-item active">
        <text class="mode-title">每日一练</text>
        <text class="mode-desc">当前模式</text>
      </view>
      <view class="mode-item">
        <text class="mode-title">随机刷题</text>
        <text class="mode-desc">待接入</text>
      </view>
      <view class="mode-item">
        <text class="mode-title">错题回收</text>
        <text class="mode-desc">待接入</text>
      </view>
    </view>

    <view v-if="loading" class="panel loading-card">
      <text class="loading-dot"></text>
      <text class="muted">正在加载今日练习...</text>
    </view>

    <view v-else-if="!currentQuestion" class="panel empty">
      <text class="empty-title">暂时没有题目</text>
      <text class="muted">你还没有结构化题库。先阅读固定真题 PDF 和答案解析，后续再从资料中生成题库。</text>
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
  padding: 34rpx 30rpx;
}

.header-copy {
  position: relative;
  z-index: 1;
  flex: 1;
  display: grid;
  gap: 10rpx;
}

.header-kicker {
  color: rgba(255, 255, 255, 0.76);
  font-size: 21rpx;
  font-weight: 900;
}

.header-title {
  color: #ffffff;
  font-size: 42rpx;
  font-weight: 900;
  line-height: 1.25;
}

.header-desc {
  color: rgba(255, 255, 255, 0.86);
  font-size: 25rpx;
  line-height: 1.6;
}

.progress {
  position: relative;
  z-index: 1;
  min-width: 96rpx;
  padding: 10rpx 14rpx;
  border-radius: 8px;
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.26);
  background: rgba(255, 255, 255, 0.16);
  font-size: 28rpx;
  font-weight: 800;
  line-height: 1.4;
  text-align: center;
}

.mode-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14rpx;
}

.mode-item {
  min-height: 112rpx;
  padding: 18rpx 12rpx;
  border: 1px solid rgba(226, 232, 240, 0.94);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 8rpx 22rpx rgba(15, 23, 42, 0.05);
  box-sizing: border-box;
}

.mode-item.active {
  border-color: rgba(37, 99, 235, 0.38);
  background: linear-gradient(135deg, #eff6ff, #ecfeff);
}

.mode-title {
  display: block;
  color: #111827;
  font-size: 25rpx;
  font-weight: 900;
  line-height: 1.35;
}

.mode-desc {
  display: block;
  margin-top: 8rpx;
  color: #64748b;
  font-size: 21rpx;
  line-height: 1.4;
}

.loading-card {
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

.question-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.tag {
  padding: 8rpx 16rpx;
  border-radius: 8px;
  background: linear-gradient(135deg, #dbeafe, #ccfbf1);
  color: #1d4ed8;
  font-size: 24rpx;
  font-weight: 700;
}

.source {
  color: #64748b;
  font-size: 24rpx;
}

.stem {
  display: block;
  margin-bottom: 22rpx;
  color: #111827;
  font-size: 31rpx;
  font-weight: 700;
  line-height: 1.75;
}

.option {
  display: flex;
  gap: 18rpx;
  align-items: flex-start;
  min-height: 82rpx;
  padding: 20rpx;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 14rpx;
  background: linear-gradient(180deg, #ffffff, #f8fafc);
  box-sizing: border-box;
  box-shadow: 0 8rpx 20rpx rgba(15, 23, 42, 0.04);
  transition: transform 160ms ease, border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
}

.option:active {
  transform: scale(0.99);
}

.option.selected {
  border-color: #2563eb;
  background: linear-gradient(135deg, #eff6ff, #ecfeff);
  box-shadow: 0 12rpx 26rpx rgba(37, 99, 235, 0.10);
}

.option.disabled {
  opacity: 0.86;
}

.option-key {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: #e2e8f0;
  color: #334155;
  font-weight: 800;
}

.option.selected .option-key {
  background: linear-gradient(135deg, #2563eb, #14b8a6);
  color: #ffffff;
}

.option-text {
  flex: 1;
  color: #334155;
  font-size: 27rpx;
  line-height: 1.65;
}

.actions {
  display: grid;
  grid-template-columns: 1fr 168rpx;
  gap: 16rpx;
  margin-top: 22rpx;
}

.analysis {
  display: grid;
  gap: 14rpx;
  margin-top: 26rpx;
  padding: 24rpx;
  border: 1px solid rgba(187, 247, 208, 0.86);
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(240, 253, 244, 0.95), rgba(255, 251, 235, 0.82));
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.72);
}

.result {
  color: #15803d;
  font-size: 32rpx;
  font-weight: 800;
}

.result.wrong {
  color: #dc2626;
}

.analysis-title {
  color: #111827;
  font-weight: 800;
}

.analysis-text {
  color: #334155;
  line-height: 1.75;
}

.empty {
  display: grid;
  gap: 20rpx;
  text-align: left;
}

.empty-title {
  color: #111827;
  font-size: 32rpx;
  font-weight: 800;
}

</style>

