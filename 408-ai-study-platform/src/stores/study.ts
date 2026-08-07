import { defineStore } from 'pinia';
import { ref } from 'vue';
import { http } from '../services/http';

interface DashboardData {
  user?: Record<string, unknown>;
  recentRecords?: Array<Record<string, unknown>>;
  studyStats?: {
    wrongBookCount: number;
    favoriteCount: number;
  };
}

interface CheckinResult {
  user: Record<string, unknown>;
  checkedToday: boolean;
  alreadyCheckedToday: boolean;
}

export const useStudyStore = defineStore('study', () => {
  const dashboard = ref<DashboardData>({});

  const loadDashboard = async () => {
    dashboard.value = await http.get<DashboardData>('/study/dashboard');
  };

  const checkin = async () => {
    const result = await http.post<CheckinResult>('/study/checkin');
    dashboard.value = {
      ...dashboard.value,
      user: result.user
    };
    return result;
  };

  return { dashboard, loadDashboard, checkin };
});
