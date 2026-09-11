import { createSSRApp } from 'vue';
import { createPinia } from 'pinia';
import uviewPlus from 'uview-plus';
import App from './App.vue';

declare const wx: any;

export function createApp() {
  // #ifdef MP-WEIXIN
  if (typeof wx !== 'undefined' && wx.cloud) {
    wx.cloud.init({
      env: import.meta.env.VITE_CLOUD_ENV || 'cloudbase-d8gk6gtnw00fe55a2',
      traceUser: true
    });
  }
  // #endif

  const app = createSSRApp(App);
  app.use(createPinia());
  app.use(uviewPlus);
  return { app };
}
