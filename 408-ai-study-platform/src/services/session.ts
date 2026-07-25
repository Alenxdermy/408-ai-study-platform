export interface SessionUser {
  id: string;
  nickname: string;
  avatarUrl?: string;
  phone?: string | null;
  targetScore?: number;
  examDate?: string | null;
  status?: 'active' | 'disabled';
  stats?: {
    totalQuestions: number;
    correctQuestions: number;
    studyMinutes: number;
    streakDays: number;
    lastCheckInAt: string | null;
  };
  achievements?: Array<{ code: string; name: string; unlockedAt: string }>;
}

export interface AuthSession {
  token: string;
  user: SessionUser;
}

export const readSession = () => ({
  token: uni.getStorageSync('token') || '',
  user: uni.getStorageSync('user') || null
});

export const saveSession = (session: AuthSession) => {
  uni.setStorageSync('token', session.token);
  uni.setStorageSync('user', session.user);
  uni.$emit('auth:session-changed');
};

export const clearSession = () => {
  uni.removeStorageSync('token');
  uni.removeStorageSync('user');
  uni.$emit('auth:session-cleared');
};
