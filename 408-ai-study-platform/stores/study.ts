import { defineStore } from 'pinia';
import { ref } from 'vue';
import { http } from '../services/http';

interface DashboardData {
  user?: Record<string, unknown>;
  recentRecords?: Array<Record<string, unknown>>;
}

export const useStudyStore = defineStore('study', () => {
  const dashboard = ref<DashboardData>({});

  const loadDashboard = async () => {
    dashboard.value = await http.get<DashboardData>('/study/dashboard');
  };

  return { dashboard, loadDashboard };
});
