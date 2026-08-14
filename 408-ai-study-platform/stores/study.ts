import { defineStore } from 'pinia';
import { ref } from 'vue';
import { http } from '../services/http';

interface DashboardData {
  user?: Record<string, unknown>;
  recentRecords?: Array<Record<string, unknown>>;
  studyStats?: {
    wrongBookCount: number;
    favoriteCount: number;
    totalAnswered: number;
    correctAnswered: number;
    accuracy: number;
    weakSubjects: Array<{ subject: string; label: string; count: number }>;
    favoriteSubjects: Array<{ subject: string; label: string; count: number }>;
    report: string;
  };
}

export const useStudyStore = defineStore('study', () => {
  const dashboard = ref<DashboardData>({});

  const loadDashboard = async () => {
    dashboard.value = await http.get<DashboardData>('/study/dashboard');
  };

  return { dashboard, loadDashboard };
});
