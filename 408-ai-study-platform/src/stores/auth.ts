import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { http } from '../services/http';
import { clearSession, readSession, saveSession, type AuthSession, type SessionUser } from '../services/session';

interface LoginPayload {
  phone: string;
  password: string;
}

interface RegisterPayload extends LoginPayload {
  nickname: string;
}

interface StudyTargetPayload {
  targetScore: number;
  examDate: string | null;
}

interface LoginResult {
  token: string;
  user: SessionUser;
}

let listenersBound = false;

export const useAuthStore = defineStore('auth', () => {
  const session = readSession();
  const token = ref<string>(session.token);
  const user = ref<SessionUser | null>(session.user);
  const syncing = ref(false);

  const syncFromStorage = () => {
    const current = readSession();
    token.value = current.token;
    user.value = current.user;
  };

  const bindSessionListeners = () => {
    if (listenersBound || typeof uni.$on !== 'function') return;
    uni.$on('auth:session-changed', syncFromStorage);
    uni.$on('auth:session-cleared', syncFromStorage);
    listenersBound = true;
  };

  const persistLogin = (data: AuthSession | LoginResult) => {
    saveSession({ token: data.token, user: data.user });
    syncFromStorage();
  };

  const login = async (payload: LoginPayload) => {
    const data = await http.post<LoginResult>('/auth/login', payload);
    persistLogin(data);
    return data.user;
  };

  const register = async (payload: RegisterPayload) => {
    const data = await http.post<LoginResult>('/auth/register', payload);
    persistLogin(data);
    return data.user;
  };

  const mockLogin = async () => {
    const data = await http.post<LoginResult>('/auth/mock-login', { nickname: '408 考生' });
    persistLogin(data);
    return data.user;
  };

  const wechatLogin = async () => {
    const loginResult = await uni.login({ provider: 'weixin' });
    const code = Array.isArray(loginResult) ? loginResult[1]?.code : loginResult.code;
    if (!code) throw new Error('微信登录凭证获取失败');

    const data = await http.post<LoginResult>('/auth/wechat-login', { code });
    persistLogin(data);
    return data.user;
  };

  const refreshProfile = async () => {
    if (!token.value) return null;
    const profile = await http.get<SessionUser>('/auth/me');
    user.value = profile;
    saveSession({ token: token.value, user: profile });
    return profile;
  };

  const updateStudyTarget = async (payload: StudyTargetPayload) => {
    const profile = await http.post<SessionUser>('/auth/target', payload);
    user.value = profile;
    if (token.value) {
      saveSession({ token: token.value, user: profile });
    }
    return profile;
  };

  const ensureSession = async () => {
    if (!token.value) return false;

    syncing.value = true;
    try {
      await refreshProfile();
      return true;
    } catch (error) {
      clearSession();
      syncFromStorage();
      console.warn('登录态已失效', error);
      return false;
    } finally {
      syncing.value = false;
    }
  };

  const ensureLogin = async () => {
    if (token.value) {
      return ensureSession();
    }

    if (import.meta.env.DEV) {
      try {
        await mockLogin();
        return true;
      } catch (error) {
        console.warn('开发态游客登录失败', error);
      }
    }

    return false;
  };

  const logout = () => {
    clearSession();
    syncFromStorage();
  };

  const setSession = (data: AuthSession) => {
    persistLogin(data);
  };

  bindSessionListeners();

  return {
    token,
    user,
    syncing,
    isLoggedIn: computed(() => Boolean(token.value)),
    login,
    register,
    mockLogin,
    wechatLogin,
    refreshProfile,
    updateStudyTarget,
    ensureSession,
    ensureLogin,
    logout,
    setSession
  };
});
