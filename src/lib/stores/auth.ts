// GMD Medical Platform - Auth Store
import { writable } from 'svelte/store';
import type { User } from '$lib/db/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>({
    user: null,
    isAuthenticated: false
  });

  return {
    subscribe,
    login: (user: User) => {
      set({
        user,
        isAuthenticated: true
      });
      // Salva in sessionStorage per persistenza
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('gmd_user', JSON.stringify(user));
      }
    },
    logout: () => {
      set({
        user: null,
        isAuthenticated: false
      });
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('gmd_user');
        sessionStorage.removeItem('gmd_ambulatorio');
      }
    },
    restore: () => {
      if (typeof window !== 'undefined') {
        const storedUser = sessionStorage.getItem('gmd_user');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          set({
            user,
            isAuthenticated: true
          });
        }
      }
    }
  };
}

export const authStore = createAuthStore();
