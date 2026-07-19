import { defineStore } from 'pinia';
import { ref } from 'vue';
import { http } from '../services/http';

interface LoginResult {
  token: string;
  user: Record<string, unknown>;
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(uni.getStorageSync('token') || '');
  const user = ref<Record<string, unknown> | null>(uni.getStorageSync('user') || null);

  const persistLogin = (data: LoginResult) => {
    token.value = data.token;
    user.value = data.user;
    uni.setStorageSync('token', data.token);
    uni.setStorageSync('user', data.user);
  };

  const mockLogin = async () => {
    const data = await http.post<LoginResult>('/auth/mock-login', { nickname: '408 考生' });
    persistLogin(data);
  };

  const wechatLogin = async () => {
    const loginResult = await uni.login({ provider: 'weixin' });
    const code = Array.isArray(loginResult) ? loginResult[1]?.code : loginResult.code;
    if (!code) throw new Error('微信登录凭证获取失败');

    const data = await http.post<LoginResult>('/auth/wechat-login', { code });
    persistLogin(data);
  };

  const ensureLogin = async () => {
    if (token.value) return;

    // #ifdef MP-WEIXIN
    try {
      await wechatLogin();
      return;
    } catch (error) {
      console.warn('微信登录未配置，已切换为开发登录', error);
    }
    // #endif

    await mockLogin();
  };

  const logout = () => {
    token.value = '';
    user.value = null;
    uni.removeStorageSync('token');
    uni.removeStorageSync('user');
  };

  return { token, user, mockLogin, wechatLogin, ensureLogin, logout };
});
